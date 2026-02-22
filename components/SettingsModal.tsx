
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[2000] p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3 mb-4 flex-shrink-0">
          <h2 className="text-xl font-bold">Paramètres</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto pr-2 flex-grow">
          {/* General Settings */}
          <div className="space-y-6">
            <label htmlFor="precision" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Précision des décimales</label>
            <select
              id="precision"
              value={settings.precision}
              onChange={(e) => handleSettingChange('precision', parseInt(e.target.value, 10))}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Nombre de décimales pour les coordonnées, distances et surfaces.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Thème de l'application</label>
            <div className="grid grid-cols-3 gap-2">
              {(['light', 'dark', 'system'] as Theme[]).map(theme => (
                 <button 
                   key={theme} 
                   onClick={() => handleSettingChange('theme', theme)}
                   className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${settings.theme === theme ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                   >
                   {theme.charAt(0).toUpperCase() + theme.slice(1)}
                 </button>
              ))}
            </div>
          </div>
           
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label htmlFor="coordinate-system" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Système de coordonnées</label>
            <select
              id="coordinate-system"
              value={settings.coordinateSystem}
              onChange={(e) => handleSettingChange('coordinateSystem', e.target.value as CoordinateSystem)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              {coordinateSystems.map(cs => <option key={cs.id} value={cs.id}>{cs.label}</option>)}
            </select>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Choisissez le système pour l'entrée et les calculs. Les outils de topographie plane (Rayonnement, etc.) sont désactivés en WGS84.
            </p>
          </div>

          {/* Unit Settings */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Unité de distance</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {distanceUnits.map(unit => (
                   <button 
                     key={unit.id} 
                     onClick={() => handleSettingChange('distanceUnit', unit.id)}
                     className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${settings.distanceUnit === unit.id ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                   >
                     {unit.label}
                   </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Unité de surface</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {areaUnits.map(unit => (
                   <button 
                     key={unit.id} 
                     onClick={() => handleSettingChange('areaUnit', unit.id)}
                     className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${settings.areaUnit === unit.id ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                   >
                     {unit.label}
                   </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Parcel Management */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Gestion des Parcelles</label>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {parcels.map(parcel => (
                <div key={parcel.id} className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700/50 p-2 rounded-md">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: parcel.color }}></span>
                  <input
                    type="text"
                    value={editingNames[parcel.id] || ''}
                    onChange={(e) => handleNameChange(parcel.id, e.target.value)}
                    onBlur={() => handleNameBlur(parcel.id)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    className="flex-grow bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
                  />
                  <button
                    onClick={() => handleDeleteParcel(parcel.id, parcel.name)}
                    disabled={parcels.length <= 1}
                    className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed"
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
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-6">
             <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fond de carte</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {tileLayers.map(layer => (
                     <button 
                       key={layer.id} 
                       onClick={() => handleSettingChange('mapTileLayer', layer.id)}
                       className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${settings.mapTileLayer === layer.id ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                     >
                       {layer.label}
                     </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Style des marqueurs</label>
                <div className="grid grid-cols-2 gap-2">
                  {markerStyles.map(style => (
                     <button 
                       key={style.id} 
                       onClick={() => handleSettingChange('mapMarkerStyle', style.id)}
                       className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${settings.mapMarkerStyle === style.id ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                     >
                       {style.label}
                     </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="flex justify-between items-center cursor-pointer">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Centrage automatique de la carte
                    <p className="mt-1 text-xs font-normal text-gray-500 dark:text-gray-400">
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
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </div>
                </label>
              </div>
          </div>
          
          {/* Danger Zone */}
          <div className="border-t border-red-500/50 dark:border-red-400/50 pt-4">
              <div className="p-4 border-2 border-dashed border-red-500/50 dark:border-red-400/50 rounded-lg">
                <h4 className="font-bold text-red-600 dark:text-red-400">Zone de Danger</h4>
                <div className="space-y-2 mt-3">
                    <button
                        onClick={handleResetSettings}
                        className="w-full text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2 rounded-md transition-colors"
                    >
                        Restaurer les paramètres par défaut
                    </button>
                    <button
                        onClick={handleResetApp}
                        className="w-full font-bold px-4 py-2 border rounded-md transition-colors danger-zone-button text-sm"
                    >
                        Réinitialiser l'application (Effacer tout)
                    </button>
                </div>
              </div>
          </div>

        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 text-right flex-shrink-0">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700"
            >
                Fermer
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
