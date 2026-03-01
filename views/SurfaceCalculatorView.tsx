
import React, { useState, useCallback, useMemo } from 'react';
import { Point, CalculationResults, AppSettings, Annotation, Notification, Parcel } from '../types';
import { useParcels } from '../hooks/useParcels';
import PointManagementPanel from '../components/PointManagementPanel';
import SurveyTools from '../components/SurveyTools';
import GeminiDescription from '../components/GeminiDescription';
import ResultsDisplay from '../components/ResultsDisplay';
import ExportButton from '../components/ExportButton';
import { formatArea, convertDistance, getDistanceUnitLabel } from '../services/unitConversionService';
import { calculateDistances } from '../services/topographyService';

interface SurfaceCalculatorViewProps {
    parcels: Parcel[];
    activeParcelId: number | null;
    setActiveParcelId: (id: number | null) => void;
    parcelManager: ReturnType<typeof useParcels>;
    annotations: Annotation[];
    setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
    settings: AppSettings;
    onSettingsChange: (settings: AppSettings) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    setNotification: (message: string, type: Notification['type']) => void;
    highlightedPointId: number | null;
    setHighlightedPointId: (id: number | null) => void;
    results: CalculationResults | null;
    onOpenBornageSketch: () => void;
    onOpenTechnicalPV: () => void;
}

type Tab = 'data' | 'tools' | 'results';

const SurfaceCalculatorView: React.FC<SurfaceCalculatorViewProps> = (props) => {
    const { 
        parcels, activeParcelId, parcelManager, settings, setNotification, 
        undo, redo, canUndo, canRedo, highlightedPointId, setHighlightedPointId,
        results, onOpenBornageSketch, onOpenTechnicalPV, setActiveParcelId
    } = props;
    
    const [activeTab, setActiveTab] = useState<Tab>('data');
    
    const activeParcel = useMemo(() => parcels.find(p => p.id === activeParcelId), [parcels, activeParcelId]);
    const points = useMemo(() => activeParcel?.points || [], [activeParcel]);

    const setPoints = useCallback((action: React.SetStateAction<Point[]>) => {
      if (activeParcelId === null) return;
      parcelManager.updateParcelPoints(activeParcelId, action);
    }, [activeParcelId, parcelManager]);

    const perimeter = useMemo(() => {
        if (points.length < 2) return 0;
        const distances = calculateDistances(points, settings.coordinateSystem);
        return distances.reduce((acc, curr) => acc + curr.distance, 0);
    }, [points, settings.coordinateSystem]);

    return (
        <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#0F172A] overflow-hidden">
            {/* Header Summary Card */}
            <div className="flex-shrink-0 p-4 pb-0">
                <div className="bsport-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all">
                    <div>
                        <h2 className="bsport-label mb-1">Parcelle Active</h2>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: activeParcel?.color || '#ccc' }}></span>
                            <span className="text-lg font-bold text-[#0F172A] dark:text-white truncate max-w-[200px] sm:max-w-xs">{activeParcel?.name || 'Aucune parcelle'}</span>
                        </div>
                    </div>
                    
                    <div className="flex flex-row w-full md:w-auto items-center gap-4 md:gap-6 divide-x divide-[#E2E8F0] dark:divide-[#334155]">
                        <div className="px-2 md:px-4 first:pl-0 text-left md:text-right flex-1 md:flex-none">
                            <div className="bsport-label">Surface</div>
                            <div className="flex flex-col items-start md:items-end">
                                <div className="text-lg md:text-xl font-black text-[#4F46E5] whitespace-nowrap">
                                    {results ? formatArea(results.area, settings.areaUnit, settings.precision) : '---'}
                                </div>
                                {results && settings.areaUnit === 'ha_a_ca' && (
                                    <div className="text-xs text-gray-500 font-medium mt-0.5">
                                        {formatArea(results.area, 'squareMeters', settings.precision)}
                                    </div>
                                )}
                                {results && settings.areaUnit === 'squareMeters' && (
                                    <div className="text-xs text-gray-500 font-medium mt-0.5">
                                        {formatArea(results.area, 'ha_a_ca', settings.precision)}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="px-2 md:px-4 text-left md:text-right flex-1 md:flex-none">
                            <div className="bsport-label">Périmètre</div>
                            <div className="text-base md:text-lg font-bold text-[#0F172A] dark:text-gray-300 whitespace-nowrap">
                                {perimeter > 0 ? `${convertDistance(perimeter, settings.distanceUnit).toFixed(settings.precision)} ${getDistanceUnitLabel(settings.distanceUnit)}` : '---'}
                            </div>
                        </div>
                        <div className="px-2 md:px-4 text-left md:text-right flex-1 md:flex-none hidden sm:block">
                            <div className="bsport-label">Bornes</div>
                            <div className="text-base md:text-lg font-bold text-[#0F172A] dark:text-gray-300 whitespace-nowrap">
                                {points.length}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Navigation Tabs (Mobile & Tablet) */}
            <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-30 lg:hidden w-auto max-w-[90vw]">
                <div className="flex items-center p-1.5 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-white/20 dark:border-gray-700/30 shadow-2xl shadow-black/10 rounded-2xl transition-all hover:scale-[1.02] hover:bg-white/90 dark:hover:bg-gray-900/90">
                    <button
                        onClick={() => setActiveTab('data')}
                        className={`relative px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300 ${activeTab === 'data' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    >
                        Données
                    </button>
                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                    <button
                        onClick={() => setActiveTab('tools')}
                        className={`relative px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300 ${activeTab === 'tools' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    >
                        Calculs
                    </button>
                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                    <button
                        onClick={() => setActiveTab('results')}
                        className={`relative px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300 ${activeTab === 'results' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    >
                        Rapports
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-grow overflow-y-auto p-4 pb-40 md:pb-24 lg:pb-4 scroll-smooth">
                <div className="h-full flex flex-col lg:flex-row gap-6">
                    
                    {/* Left Column (Always visible on desktop, tabbed on mobile) */}
                    <div className={`lg:w-1/3 xl:w-1/4 h-full flex flex-col ${activeTab !== 'data' ? 'hidden lg:flex' : ''}`}>
                        <PointManagementPanel 
                            points={points}
                            setPoints={setPoints}
                            parcelManager={parcelManager}
                            activeParcelId={activeParcelId}
                            setActiveParcelId={setActiveParcelId}
                            getNextPointId={parcelManager.getNextPointId}
                            results={null} 
                            settings={settings}
                            undo={undo}
                            redo={redo}
                            canUndo={canUndo}
                            canRedo={canRedo}
                            setNotification={setNotification}
                            highlightedPointId={highlightedPointId}
                            setHighlightedPointId={setHighlightedPointId}
                            showResults={false}
                            showExports={false}
                        />
                    </div>

                    {/* Right Column (Tools & Results) */}
                    <div className="flex-1 space-y-6">
                        {/* Tools Section */}
                        <div className={`${activeTab !== 'tools' ? 'hidden lg:block' : ''}`}>
                            <div className="bsport-card">
                                <h3 className="bsport-label mb-4 border-b border-[#E2E8F0] dark:border-[#334155] pb-2">Outils Topographiques</h3>
                                <SurveyTools points={points} onAddPoints={(pts) => activeParcelId && parcelManager.addPoints(activeParcelId, pts)} />
                            </div>
                        </div>

                        {/* Results Section */}
                        <div className={`${activeTab !== 'results' ? 'hidden lg:block' : ''} space-y-6`}>
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                                    <h3 className="font-bold text-gray-800 dark:text-white flex items-center">
                                        <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                        Rapport Technique
                                    </h3>
                                </div>
                                <div className="p-4">
                                    {results ? (
                                        <ResultsDisplay results={results} settings={settings} points={points} />
                                    ) : (
                                        <p className="text-gray-500 italic text-center py-4">Pas assez de données pour afficher les résultats.</p>
                                    )}
                                </div>
                            </div>

                            {points.length >= 3 && results && (
                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                                    <GeminiDescription points={points} results={results} settings={settings} />
                                </div>
                            )}

                            {points.length > 0 && (
                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Exportation & Procès-Verbaux</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <button onClick={onOpenTechnicalPV} className="w-full bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold py-3 px-4 rounded-xl border border-blue-200 transition-colors flex items-center justify-center space-x-2 shadow-sm">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            <span>PV de Bornage</span>
                                        </button>
                                        <button onClick={onOpenBornageSketch} className="w-full bg-orange-50 text-orange-700 hover:bg-orange-100 font-bold py-3 px-4 rounded-xl border border-orange-200 transition-colors flex items-center justify-center space-x-2 shadow-sm">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                            <span>Croquis</span>
                                        </button>
                                        <div className="sm:col-span-2">
                                            <ExportButton points={points} results={results} settings={settings} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SurfaceCalculatorView;
