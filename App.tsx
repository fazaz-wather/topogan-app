
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import WelcomeView from './components/WelcomeView';
import SurfaceCalculatorView from './views/SurfaceCalculatorView';
import CoordinateTransformationView from './views/CoordinateTransformationView';
import BornageSketchView from './components/BornageSketchView';
import TechnicalPVView from './views/TechnicalPVView';
import MappeCalculationView from './views/MappeCalculationView';
import PlaceholderView from './components/PlaceholderView';
import MapView from './views/MapView';
import SettingsModal from './components/SettingsModal';
import GoToModal from './components/GoToModal';
import Notification from './components/Notification';
import ParcelTabs from './components/ParcelTabs';
import { useHistoryState } from './hooks/useHistoryState';
import { useParcels } from './hooks/useParcels';
import { useGoTo } from './hooks/useGoTo';
import { AppSettings, View, Parcel, Point, Annotation, Notification as NotificationType, CalculationResults, ImportedLayer } from './types';
import { calculatePolygonArea, calculateDistances, calculateCentroid } from './services/topographyService';
import { saveAndShareFile } from './services/exportService';
import { loadAllLayers, saveAllLayers } from './services/storageService';

const initialSettings: AppSettings = {
  precision: 2,
  theme: 'system',
  mapTileLayer: 'google_hybrid',
  mapMarkerStyle: 'circle',
  distanceUnit: 'meters',
  areaUnit: 'ha_a_ca',
  coordinateSystem: 'lambert_sud_maroc',
  mapAutoFit: false,
};

const initialParcels: Parcel[] = [
    {
        id: 1,
        name: 'Parcelle 1',
        points: [],
        color: '#3b82f6',
        isVisible: true
    }
];

const App: React.FC = () => {
  const { 
      state: parcels, 
      setState: setParcels, 
      undo: undoParcels, 
      redo: redoParcels, 
      canUndo: canUndoParcels, 
      canRedo: canRedoParcels 
  } = useHistoryState<Parcel[]>(initialParcels);

  const [activeParcelId, setActiveParcelId] = useState<number | null>(1);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [settings, setSettings] = useState<AppSettings>(() => {
      const saved = localStorage.getItem('topogan-settings');
      return saved ? JSON.parse(saved) : initialSettings;
  });
  
  // State for Imported Layers (GIS) - Persisted via IndexedDB
  const [importedLayers, setImportedLayers] = useState<ImportedLayer[]>([]);
  // Flag to track if initial load from DB is complete
  const [isLayersLoaded, setIsLayersLoaded] = useState(false);

  const [currentView, setCurrentView] = useState<View>('WELCOME');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [notification, setNotificationState] = useState<NotificationType | null>(null);
  const [highlightedPointId, setHighlightedPointId] = useState<number | null>(null);
  
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [mapSearch, setMapSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showNotification = useCallback((message: string, type: NotificationType['type']) => {
      setNotificationState({ id: Date.now(), message, type });
  }, []);

  const parcelManager = useParcels(parcels, setParcels, showNotification);
  const { goToCoords, isGoToModalOpen, openGoToModal, closeGoToModal, handleGoTo } = useGoTo(showNotification);

  // Load Imported Layers from IndexedDB on mount
  useEffect(() => {
      const loadLayers = async () => {
          try {
              const layers = await loadAllLayers();
              setImportedLayers(layers);
          } catch (e) {
              console.error("Erreur chargement couches GIS", e);
              showNotification("Impossible de charger les couches GIS sauvegardées.", "error");
          } finally {
              setIsLayersLoaded(true);
          }
      };
      loadLayers();
  }, [showNotification]);

  // Persist Imported Layers to IndexedDB on change
  useEffect(() => {
      if (!isLayersLoaded) return; // Skip saving empty initial state

      const saveLayers = async () => {
          try {
              await saveAllLayers(importedLayers);
          } catch (e) {
              console.error("Erreur sauvegarde couches GIS", e);
              // IndexedDB quota error handling
              if (e instanceof DOMException && e.name === 'QuotaExceededError') {
                  showNotification("Espace de stockage plein. Les couches ne sont pas sauvegardées.", "error");
              }
          }
      };

      // Debounce pour éviter trop d'écritures successives
      const timer = setTimeout(saveLayers, 500);
      return () => clearTimeout(timer);
  }, [importedLayers, isLayersLoaded, showNotification]);

  useEffect(() => {
    const applyTheme = (theme: 'light' | 'dark') => {
      if (theme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    };
    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches ? 'dark' : 'light');
      const listener = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else applyTheme(settings.theme as 'light' | 'dark');
  }, [settings.theme]);

  useEffect(() => localStorage.setItem('topogan-settings', JSON.stringify(settings)), [settings]);

  useEffect(() => {
      const savedParcels = localStorage.getItem('topogan-parcels');
      if (savedParcels) {
          try { setParcels(JSON.parse(savedParcels)); } catch(e) { console.error("Load parcels error", e); }
      }
  }, []);
  useEffect(() => localStorage.setItem('topogan-parcels', JSON.stringify(parcels)), [parcels]);

  const activeParcel = useMemo(() => parcels.find(p => p.id === activeParcelId), [parcels, activeParcelId]);
  const points = useMemo(() => activeParcel?.points || [], [activeParcel]);

  const setPoints = useCallback((action: React.SetStateAction<Point[]>) => {
      if (activeParcelId === null) return;
      parcelManager.updateParcelPoints(activeParcelId, action);
  }, [activeParcelId, parcelManager]);

  const results: CalculationResults | null = useMemo(() => {
      if (points.length < 2) return null;
      return {
          area: calculatePolygonArea(points, settings.coordinateSystem),
          distances: calculateDistances(points, settings.coordinateSystem),
      };
  }, [points, settings.coordinateSystem]);

  const handleNavigate = (view: View) => {
      setCurrentView(view);
      setIsSidebarOpen(false);
  };

  const handleSaveProject = async () => {
      const dataToSave = { version: "1.0", parcels, settings, importedLayers };
      const filename = `${(activeParcel?.name || "projet").replace(/[^a-z0-9]/gi, '_')}.json`;
      try {
          await saveAndShareFile(JSON.stringify(dataToSave, null, 2), filename, 'application/json');
          showNotification("Projet sauvegardé.", "success");
      } catch (e) { showNotification("Erreur de sauvegarde.", "error"); }
  };

  const handleOpenProject = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const data = JSON.parse(event.target?.result as string);
              if (data.parcels) setParcels(data.parcels);
              if (data.settings) setSettings(prev => ({...prev, ...data.settings}));
              if (data.importedLayers) setImportedLayers(data.importedLayers);
              showNotification("Projet chargé avec succès.", "success");
          } catch (err) { showNotification("Format de fichier invalide.", "error"); }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const handleNewParcel = () => {
      const newParcel = parcelManager.addParcel();
      setActiveParcelId(newParcel.id);
      showNotification("Nouvelle parcelle créée.", "success");
      if (currentView === 'WELCOME') handleNavigate('SURFACE');
  };

  const handleMapSearchSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const term = mapSearch.toLowerCase().trim();
      if (!term) return;
      const foundParcel = parcels.find(p => p.name.toLowerCase().includes(term));
      if (foundParcel && foundParcel.points.length > 0) {
          const centroid = calculateCentroid(foundParcel.points);
          if (centroid) {
              handleGoTo(centroid, settings.coordinateSystem);
              showNotification(`Centré sur ${foundParcel.name}`, 'success');
              return;
          }
      }
      const parts = term.split(/[\s,;]+/).map(n => parseFloat(n)).filter(n => !isNaN(n));
      if (parts.length >= 2) {
          let x = parts[0]; let y = parts[1];
          if (settings.coordinateSystem === 'wgs84' && x > 0 && y < 0) {
               const temp = x; x = y; y = temp;
          }
          handleGoTo({ x, y }, settings.coordinateSystem);
      } else { showNotification("Aucun résultat trouvé.", "info"); }
  };

  const currentViewTitle = useMemo(() => {
      switch(currentView) {
          case 'WELCOME': return 'Tableau de bord';
          case 'SURFACE': return 'Surface & Bornes';
          case 'COORDINATE_TRANSFORMATION': return 'Transformations';
          case 'MAP': return 'Carte Interactive';
          case 'BORNAGE_SKETCH': return 'Croquis de Bornage';
          case 'TECHNICAL_PV': return 'Procès-Verbal';
          case 'CADASTRAL_PLAN': return 'Plan Cadastral';
          case 'MAPPE': return 'Mappe de Repérage';
          default: return 'Topogan';
      }
  }, [currentView]);

  const CurrentViewComponent = useMemo(() => {
      switch(currentView) {
          case 'SURFACE': return SurfaceCalculatorView;
          case 'COORDINATE_TRANSFORMATION': return CoordinateTransformationView;
          case 'MAPPE': return MappeCalculationView;
          case 'BORNAGE_SKETCH': return BornageSketchView;
          case 'TECHNICAL_PV': return TechnicalPVView;
          case 'MAP': return () => null; 
          default: return () => <PlaceholderView title={currentViewTitle} />;
      }
  }, [currentView, currentViewTitle]);

  const fitToParcel = useMemo(() => activeParcelId ? { id: activeParcelId, key: Date.now() } : null, [activeParcelId]);

  const commonViewProps = {
      parcels, activeParcelId, points, setPoints, parcelManager, setActiveParcelId, annotations, setAnnotations,
      results, settings, onSettingsChange: (s: AppSettings) => setSettings(s), undo: undoParcels, redo: redoParcels,
      canUndo: canUndoParcels, canRedo: canRedoParcels, setNotification: showNotification,
      highlightedPointId, setHighlightedPointId, goToCoords, fitToParcel, onOpenGoToModal: openGoToModal,
      onOpenBornageSketch: () => setCurrentView('BORNAGE_SKETCH'),
      onOpenTechnicalPV: () => setCurrentView('TECHNICAL_PV'),
      onOpenCadastralPlan: () => setCurrentView('CADASTRAL_PLAN'),
      onLoadProject: (d: any) => { 
          setParcels(d.parcels); 
          if (d.settings) setSettings(prev => ({...prev, ...d.settings})); 
          if (d.importedLayers) setImportedLayers(d.importedLayers);
      },
      getNextPointId: parcelManager.getNextPointId, onNavigate: handleNavigate,
      parcel: activeParcel, onClose: () => handleNavigate('SURFACE'),
      importedLayers, setImportedLayers // Pass imported layers to views
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <Sidebar currentView={currentView} onNavigate={handleNavigate} onOpenSettings={() => setIsSettingsModalOpen(true)} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        
        <div className="flex-1 flex flex-col min-w-0 relative">
          <header className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-30 gap-4 no-print">
            <div className="flex items-center gap-3 flex-shrink-0">
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
              </button>
              <h1 className="text-lg font-black tracking-tight uppercase md:text-xl truncate hidden sm:block">{currentViewTitle}</h1>
              <h1 className="text-lg font-black tracking-tight uppercase sm:hidden">{currentViewTitle.substring(0, 3)}..</h1>
            </div>

            <div className="flex-1 flex items-center justify-center sm:justify-end gap-2 max-w-2xl overflow-hidden">
                {currentView === 'WELCOME' && (
                    <>
                        <div className="relative w-full max-w-md group">
                            <input 
                                type="text" 
                                placeholder="Rechercher..." 
                                value={dashboardSearch}
                                onChange={(e) => setDashboardSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-1 hidden sm:block"></div>
                        <div className="flex gap-1 flex-shrink-0">
                            <button onClick={handleNewParcel} className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors" title="Nouveau Projet">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </button>
                            <button onClick={handleSaveProject} className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors" title="Sauvegarder">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                            </button>
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors" title="Ouvrir">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                            </button>
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleOpenProject} accept=".json" className="hidden" />
                    </>
                )}

                {currentView === 'MAP' && (
                    <form onSubmit={handleMapSearchSubmit} className="relative w-full max-w-md group">
                        <input 
                            type="text" 
                            placeholder="Aller à..." 
                            value={mapSearch}
                            onChange={(e) => setMapSearch(e.target.value)}
                            className="w-full pl-9 pr-10 py-2 bg-gray-100 dark:bg-gray-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                        <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        {mapSearch && (
                            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-blue-500 rounded-md text-white">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </button>
                        )}
                    </form>
                )}

                {currentView !== 'WELCOME' && currentView !== 'MAP' && (
                     <div className="hidden sm:block flex-1 mx-4">
                        <ParcelTabs parcels={parcels} activeParcelId={activeParcelId} setActiveParcelId={setActiveParcelId} parcelManager={parcelManager} />
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 no-print">
               <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors hidden sm:flex">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
               </button>
            </div>
          </header>

          <main className="flex-1 relative bg-gray-50 dark:bg-gray-950 overflow-hidden pb-16 md:pb-0">
            {currentView === 'WELCOME' ? (
                <div className="h-full overflow-y-auto animate-view"><WelcomeView {...commonViewProps} searchTerm={dashboardSearch} /></div>
            ) : currentView === 'MAPPE' ? (
                <MappeCalculationView {...commonViewProps} />
            ) : currentView === 'BORNAGE_SKETCH' ? (
                <div className="h-full w-full bg-white dark:bg-gray-950 animate-view"><BornageSketchView {...commonViewProps} /></div>
            ) : currentView === 'TECHNICAL_PV' ? (
                <div className="h-full w-full bg-white dark:bg-gray-950 animate-view"><TechnicalPVView {...commonViewProps} /></div>
            ) : (
                <div className="absolute inset-0 flex flex-col md:flex-row">
                    <div className="flex-1 relative z-0">
                        <MapView {...commonViewProps} currentView={currentView} />
                    </div>
                    {currentView !== 'MAP' && (
                        <div className="absolute inset-0 md:relative md:w-[450px] lg:w-[500px] z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-l border-gray-200 dark:border-gray-800 shadow-2xl animate-view">
                            <CurrentViewComponent {...commonViewProps} />
                        </div>
                    )}
                </div>
            )}
          </main>

          <BottomNav currentView={currentView} onNavigate={handleNavigate} />
        </div>

        {isSettingsModalOpen && <SettingsModal settings={settings} onSettingsChange={setSettings} onClose={() => setIsSettingsModalOpen(false)} parcels={parcels} parcelManager={parcelManager} />}
        {isGoToModalOpen && <GoToModal onClose={closeGoToModal} onGoTo={handleGoTo} parcels={parcels} coordinateSystem={settings.coordinateSystem} setNotification={showNotification} />}
        {notification && <Notification notification={notification} onClose={() => setNotificationState(null)} />}
      </div>
    </DndProvider>
  );
};

export default App;
