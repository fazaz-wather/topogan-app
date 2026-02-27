
import React, { useState, useEffect } from 'react';
import { AppSettings, Theme, MapTileLayer, MapMarkerStyle, DistanceUnit, AreaUnit, CoordinateSystem, Parcel } from '../types';
import { useParcels } from '../hooks/useParcels';

interface SettingsModalProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onClose: () => void;
  parcels: Parcel[];
  parcelManager: ReturnType<typeof useParcels>;
}

// Configuration par défaut demandée
const defaultSettings: AppSettings = {
  precision: 2,
  theme: 'system',
  mapTileLayer: 'google_hybrid',
  mapMarkerStyle: 'circle',
  distanceUnit: 'meters',
  areaUnit: 'ha_a_ca',
  coordinateSystem: 'lambert_sud_maroc',
  mapAutoFit: false,
};

const tileLayers: { id: MapTileLayer; label: string }[] = [
    { id: 'osm', label: 'Standard' },
    { id: 'dark', label: 'Sombre' },
    { id: 'satellite', label: 'Satellite' },
    { id: 'terrain', label: 'Terrain' },
    { id: 'google_hybrid', label: 'Google Hybride' },
];

const markerStyles: { id: MapMarkerStyle; label: string }[] = [
    { id: 'default', label: 'Épingle' },
    { id: 'circle', label: 'Cercle' },
];

const distanceUnits: { id: DistanceUnit; label: string }[] = [
    { id: 'meters', label: 'Mètres' },
    { id: 'feet', label: 'Pieds' },
    { id: 'kilometers', label: 'Kilomètres' },
    { id: 'miles', label: 'Miles' },
];

const areaUnits: { id: AreaUnit; label: string }[] = [
    { id: 'squareMeters', label: 'Mètres²' },
    { id: 'squareFeet', label: 'Pieds²' },
    { id: 'hectares', label: 'Hectares' },
    { id: 'acres', label: 'Acres' },
    { id: 'ha_a_ca', label: 'ha a ca'},
];

const coordinateSystems: { id: CoordinateSystem; label: string }[] = [
    { id: 'local', label: 'Local / Arbitraire' },
    { id: 'wgs84', label: 'WGS84 (Latitude/Longitude)' },
    { id: 'lambert_nord_maroc', label: 'Lambert Nord Maroc (QGIS)' },
    { id: 'lambert_sud_maroc', label: 'Lambert Sud Maroc (QGIS)' },
    { id: 'lambert_z1', label: 'Lambert Maroc: Zone 1' },
    { id: 'lambert_z2', label: 'Lambert Maroc: Zone 2' },
    { id: 'lambert_z3', label: 'Lambert Maroc: Zone 3' },
    { id: 'lambert_z4', label: 'Lambert Maroc: Zone 4' },
];


const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSettingsChange, onClose, parcels, parcelManager }) => {
  const [editingNames, setEditingNames] = useState<Record<number, string>>({});

  useEffect(() => {
    const initialNames = parcels.reduce((acc, parcel) => {
      acc[parcel.id] = parcel.name;
      return acc;
    }, {} as Record<number, string>);
    setEditingNames(initialNames);
  }, [parcels]);
  
  const handleNameChange = (id: number, newName: string) => {
    setEditingNames(prev => ({ ...prev, [id]: newName }));
  };
  
  const handleNameBlur = (id: number) => {
    const originalName = parcels.find(p => p.id === id)?.name;
    const newName = editingNames[id].trim();
    if (newName && newName !== originalName) {
      parcelManager.updateParcel(id, { name: newName });
    } else {
      setEditingNames(prev => ({ ...prev, [id]: originalName || '' }));
    }
  };
  
  const handleDeleteParcel = (id: number, name: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la parcelle "${name}" ? Cette action est irréversible.`)) {
      parcelManager.deleteParcel(id);
    }
  };

  const handleSettingChange = (key: keyof AppSettings, value: any) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const handleResetSettings = () => {
    if (window.confirm("Voulez-vous restaurer les paramètres par défaut ?\n(Lambert Sud, ha a ca, 2 décimales, auto-centrage désactivé)")) {
      onSettingsChange(defaultSettings);
    }
  };
  
  const handleResetApp = () => {
    if (window.confirm("Êtes-vous absolument sûr ?\nCette action supprimera DÉFINITIVEMENT toutes les parcelles, annotations et paramètres.\nCette action est irréversible.")) {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('topogan-')) {
                localStorage.removeItem(key);
            }
        });
        window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0F172A]/40 flex items-center justify-center z-[2000] p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col max-h-[90vh] border border-[#F1F5F9] dark:border-[#1E293B]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-[#F1F5F9] dark:border-[#1E293B] pb-4 mb-5 flex-shrink-0">
          <h2 className="text-xl font-bold text-[#0F172A] dark:text-white">Paramètres</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl text-[#64748B] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto pr-2 flex-grow custom-scrollbar">
          {/* General Settings */}
          <div className="space-y-4">
            <div>
              <label htmlFor="precision" className="bsport-label">Précision des décimales</label>
              <select
                id="precision"
                value={settings.precision}
                onChange={(e) => handleSettingChange('precision', parseInt(e.target.value, 10))}
                className="bsport-select"
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <p className="mt-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">Nombre de décimales pour les coordonnées, distances et surfaces.</p>
            </div>

            <div>
              <label className="bsport-label">Thème de l'application</label>
              <div className="grid grid-cols-3 gap-2">
                {(['light', 'dark', 'system'] as Theme[]).map(theme => (
                   <button 
                     key={theme} 
                     onClick={() => handleSettingChange('theme', theme)}
                     className={`px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${settings.theme === theme ? 'bg-[#4F46E5] text-white shadow-md shadow-[#4F46E5]/20' : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#E2E8F0] dark:hover:bg-[#334155]'}`}
                     >
                     {theme.charAt(0).toUpperCase() + theme.slice(1)}
                   </button>
                ))}
              </div>
            </div>
             
            <div className="border-t border-[#F1F5F9] dark:border-[#1E293B] pt-5">
              <label htmlFor="coordinate-system" className="bsport-label">Système de coordonnées</label>
              <select
                id="coordinate-system"
                value={settings.coordinateSystem}
                onChange={(e) => handleSettingChange('coordinateSystem', e.target.value as CoordinateSystem)}
                className="bsport-select"
              >
                {coordinateSystems.map(cs => <option key={cs.id} value={cs.id}>{cs.label}</option>)}
              </select>
              <p className="mt-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Choisissez le système pour l'entrée et les calculs. Les outils de topographie plane (Rayonnement, etc.) sont désactivés en WGS84.
              </p>
            </div>
          </div>

          {/* Unit Settings */}
          <div className="border-t border-[#F1F5F9] dark:border-[#1E293B] pt-5 space-y-5">
            <div>
              <label className="bsport-label">Unité de distance</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {distanceUnits.map(unit => (
                   <button 
                     key={unit.id} 
                     onClick={() => handleSettingChange('distanceUnit', unit.id)}
                     className={`px-2 py-2 text-[11px] font-semibold rounded-xl transition-all ${settings.distanceUnit === unit.id ? 'bg-[#4F46E5] text-white shadow-md shadow-[#4F46E5]/20' : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#E2E8F0] dark:hover:bg-[#334155]'}`}
                   >
                     {unit.label}
                   </button>
                ))}
              </div>
            </div>
            <div>
              <label className="bsport-label">Unité de surface</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {areaUnits.map(unit => (
                   <button 
                     key={unit.id} 
                     onClick={() => handleSettingChange('areaUnit', unit.id)}
                     className={`px-2 py-2 text-[11px] font-semibold rounded-xl transition-all ${settings.areaUnit === unit.id ? 'bg-[#4F46E5] text-white shadow-md shadow-[#4F46E5]/20' : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#E2E8F0] dark:hover:bg-[#334155]'}`}
                   >
                     {unit.label}
                   </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Parcel Management */}
          <div className="border-t border-[#F1F5F9] dark:border-[#1E293B] pt-5">
            <label className="bsport-label">Gestion des Parcelles</label>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
              {parcels.map(parcel => (
                <div key={parcel.id} className="flex items-center space-x-2 bg-[#F8FAFC] dark:bg-[#1E293B]/50 p-2.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155]">
                  <span className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: parcel.color }}></span>
                  <input
                    type="text"
                    value={editingNames[parcel.id] || ''}
                    onChange={(e) => handleNameChange(parcel.id, e.target.value)}
                    onBlur={() => handleNameBlur(parcel.id)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    className="flex-grow bg-transparent text-sm font-semibold text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 rounded px-1"
                  />
                  <button
                    onClick={() => handleDeleteParcel(parcel.id, parcel.name)}
                    disabled={parcels.length <= 1}
                    className="p-1.5 text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={parcels.length <= 1 ? "Impossible de supprimer la dernière parcelle" : "Supprimer la parcelle"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>


          {/* Map Settings */}
          <div className="border-t border-[#F1F5F9] dark:border-[#1E293B] pt-5 space-y-5">
             <div>
                <label className="bsport-label">Fond de carte</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {tileLayers.map(layer => (
                     <button 
                       key={layer.id} 
                       onClick={() => handleSettingChange('mapTileLayer', layer.id)}
                       className={`px-2 py-2 text-[11px] font-semibold rounded-xl transition-all ${settings.mapTileLayer === layer.id ? 'bg-[#4F46E5] text-white shadow-md shadow-[#4F46E5]/20' : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#E2E8F0] dark:hover:bg-[#334155]'}`}
                     >
                       {layer.label}
                     </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="bsport-label">Style des marqueurs</label>
                <div className="grid grid-cols-2 gap-2">
                  {markerStyles.map(style => (
                     <button 
                       key={style.id} 
                       onClick={() => handleSettingChange('mapMarkerStyle', style.id)}
                       className={`px-2 py-2 text-[11px] font-semibold rounded-xl transition-all ${settings.mapMarkerStyle === style.id ? 'bg-[#4F46E5] text-white shadow-md shadow-[#4F46E5]/20' : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#E2E8F0] dark:hover:bg-[#334155]'}`}
                     >
                       {style.label}
                     </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="flex justify-between items-center cursor-pointer">
                  <span className="text-sm font-semibold text-[#0F172A] dark:text-white">
                    Centrage automatique de la carte
                    <p className="mt-1 text-[11px] font-normal text-[#64748B] dark:text-[#94A3B8]">
                      Ajuste automatiquement le zoom pour afficher tous les points.
                    </p>
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.mapAutoFit}
                      onChange={(e) => handleSettingChange('mapAutoFit', e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-[#E2E8F0] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#4F46E5]/20 rounded-full peer dark:bg-[#334155] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#4F46E5]"></div>
                  </div>
                </label>
              </div>
          </div>
          
          {/* Danger Zone */}
          <div className="border-t border-[#F1F5F9] dark:border-[#1E293B] pt-5">
              <div className="p-5 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 rounded-2xl">
                <h4 className="font-bold text-red-600 dark:text-red-400 mb-3 text-sm">Zone de Danger</h4>
                <div className="space-y-2">
                    <button
                        onClick={handleResetSettings}
                        className="w-full text-sm font-semibold text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] hover:bg-[#F8FAFC] dark:hover:bg-[#334155] px-4 py-2.5 rounded-xl transition-colors"
                    >
                        Restaurer les paramètres par défaut
                    </button>
                    <button
                        onClick={handleResetApp}
                        className="bsport-btn-danger w-full"
                    >
                        Réinitialiser l'application (Effacer tout)
                    </button>
                </div>
              </div>
          </div>

        </div>

        <div className="mt-6 pt-5 border-t border-[#F1F5F9] dark:border-[#1E293B] flex justify-end flex-shrink-0">
            <button 
                onClick={onClose}
                className="bsport-btn-primary"
            >
                Fermer
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
