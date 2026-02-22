
import React, { useState } from 'react';
import { AppSettings, MapLayersVisibility, MapTileLayer, Parcel, MapTool, ImportedLayer } from '../types';
import { useParcels } from '../hooks/useParcels';

const basemaps: { id: MapTileLayer; label: string, color: string }[] = [
    { id: 'google_hybrid', label: 'Hybride', color: '#404040' },
    { id: 'osm', label: 'Plan', color: '#dcfce7' },
    { id: 'satellite', label: 'Satellite', color: '#3f6212' },
    { id: 'terrain', label: 'Relief', color: '#fde68a' },
    { id: 'dark', label: 'Sombre', color: '#1f2937' },
];

const creationTools: { id: MapTool, label: string, icon: React.ReactNode }[] = [
    // Le bouton 'point' a été déplacé dans la vue principale (MapView) comme bouton d'action principal
    { id: 'polygon', label: 'Tracer Parcelle', icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836l-8.5 4.75a1.25 1.25 0 000 2.168l8.5 4.75a1.25 1.25 0 001.3 0l8.5-4.75a1.25 1.25 0 000-2.168l-8.5-4.75a1.25 1.25 0 00-1.3 0z" /></svg> },
    { id: 'annotation', label: 'Annoter', icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75V4h2.25a.75.75 0 010 1.5H13v10.5a.75.75 0 01-1.5 0V5.5H8.75a.75.75 0 010-1.5H11V2.75A.75.75 0 0110 2zM3 3a1 1 0 00-1 1v12a1 1 0 001 1h14a1 1 0 001-1V4a1 1 0 00-1-1H3zm1 1h12v12H4V4z" clipRule="evenodd" /></svg> },
];

const measureTools: { id: MapTool, label: string, icon: React.ReactNode }[] = [
    { id: 'pan', label: 'Naviguer', icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>},
    { id: 'measure_line', label: 'Distance', icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
    { id: 'measure_area', label: 'Surface', icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20.6 14.667L5.333 20.8l-1.933-4.667L18.667 4 20.6 14.667z" strokeDasharray="3 3"/><path strokeLinecap="round" strokeLinejoin="round" d="M11 12.5a.5.5 0 100-1 .5.5 0 000 1zM11 12.5h-1"/></svg>},
    { id: 'measure_angle', label: 'Angle', icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 20l16-16m0 16V4H4" /><path d="M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" stroke="none" fill="currentColor"/></svg>},
];

const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void; label: string; color?: string }> = ({ checked, onChange, label, color }) => (
    <label className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50/50 dark:hover:bg-gray-700/30 cursor-pointer transition-all group">
        <span className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white font-medium transition-colors">
            {color && <span className="w-3 h-3 rounded-full shadow-sm ring-2 ring-black/5 dark:ring-white/10" style={{ backgroundColor: color }}></span>}
            <span className="truncate max-w-[140px]">{label}</span>
        </span>
        <div className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
            <div className="w-10 h-5.5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </div>
    </label>
);

const AccordionSection: React.FC<{ title: string, isOpen: boolean, onToggle: () => void, children: React.ReactNode, icon?: React.ReactNode }> = ({ title, isOpen, onToggle, children, icon }) => {
    return (
        <div className="border-b border-gray-100 dark:border-gray-700/40 last:border-0 overflow-hidden">
            <button 
                onClick={onToggle} 
                className={`w-full flex justify-between items-center py-3.5 px-4 text-left transition-all hover:bg-gray-50/50 dark:hover:bg-white/5 ${isOpen ? 'bg-gray-50/30 dark:bg-white/5' : ''}`}
            >
                <div className="flex items-center gap-3">
                    {icon && <span className={`${isOpen ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'} transition-colors`}>{icon}</span>}
                    <h4 className={`font-bold text-xs uppercase tracking-widest ${isOpen ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>{title}</h4>
                </div>
                <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-500' : 'text-gray-400'}`} 
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            <div 
                className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}
            >
                <div className="p-4 pt-2">
                    {children}
                </div>
            </div>
        </div>
    );
};

interface MapControlPanelProps {
  parcels: Parcel[];
  parcelManager: ReturnType<typeof useParcels>;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  visibility: MapLayersVisibility;
  setVisibility: React.Dispatch<React.SetStateAction<MapLayersVisibility>>;
  isPanelOpen: boolean;
  setIsPanelOpen: (isOpen: boolean) => void;
  onClearSketch: () => void;
  activeTool: MapTool;
  onToolSelect: (tool: MapTool) => void;
  onOpenGoTo: () => void;
  isTracking: boolean;
  onTrackingChange: (tracking: boolean) => void;
  onImportClick: () => void;
  importedLayers?: ImportedLayer[];
  onToggleImportedLayer?: (id: string) => void;
}

const MapControlPanel: React.FC<MapControlPanelProps> = ({ 
    parcels, parcelManager, settings, onSettingsChange, visibility, setVisibility, isPanelOpen, setIsPanelOpen, 
    onClearSketch, activeTool, onToolSelect, onOpenGoTo, isTracking, onTrackingChange, onImportClick,
    importedLayers = [], onToggleImportedLayer
}) => {
    const [openSections, setOpenSections] = useState({ tools: true, parcels: true, basemaps: false, layers: false, imported: true });

    const toggleSection = (section: keyof typeof openSections) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleLayerChange = (layer: MapTileLayer) => {
        onSettingsChange({ ...settings, mapTileLayer: layer });
    };

    const handleVisibilityToggle = (layer: keyof MapLayersVisibility) => {
        setVisibility(prev => ({ ...prev, [layer]: !prev[layer] }));
    };

    if (!isPanelOpen) {
        return (
             <div className="flex flex-col gap-2">
                <button 
                    onClick={() => setIsPanelOpen(true)}
                    title="Menu Outils"
                    className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl p-3.5 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 text-gray-700 dark:text-gray-200 hover:scale-105 active:scale-95 transition-all duration-200 group"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                </button>
                <button 
                    onClick={() => onTrackingChange(!isTracking)}
                    title={isTracking ? "Arrêter GPS" : "Suivre position GPS"}
                    className={`p-3.5 rounded-2xl shadow-xl border backdrop-blur-xl transition-all duration-200 hover:scale-105 active:scale-95 ${isTracking ? 'bg-blue-600 text-white border-blue-400 animate-pulse' : 'bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-200 border-gray-200/50 dark:border-gray-700/50'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
             </div>
        )
    }

    return (
        <div className="w-[90vw] sm:w-80 max-w-sm bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/30 overflow-hidden flex flex-col max-h-[calc(100vh-140px)] transition-all duration-500 ease-out animate-fade-slide-in">
            <div className="p-4 bg-white/50 dark:bg-white/5 border-b border-gray-100 dark:border-gray-700/50 flex justify-between items-center backdrop-blur-md">
                <div className="flex items-center space-x-3">
                     <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-blue-500/20">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" /></svg>
                     </div>
                    <span className="font-black text-sm text-gray-800 dark:text-white uppercase tracking-widest">Outils</span>
                </div>
                <button 
                    onClick={() => setIsPanelOpen(false)}
                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414 1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-grow py-2 space-y-1">
                <AccordionSection title="Actions" isOpen={openSections.tools} onToggle={() => toggleSection('tools')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => onTrackingChange(!isTracking)} className={`flex flex-col items-center justify-center gap-1.5 p-3 border rounded-xl transition-all shadow-sm group ${isTracking ? 'bg-indigo-600 border-indigo-400 text-white animate-pulse' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isTracking ? 'text-white' : 'text-indigo-500'} group-hover:scale-110 transition-transform`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                                <span className="text-[10px] font-bold uppercase tracking-tight">{isTracking ? 'GPS Actif' : 'Activer GPS'}</span>
                            </button>
                            <button onClick={onImportClick} className="flex flex-col items-center justify-center gap-1.5 p-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/20 transition-all shadow-sm group">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-500 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4 4V4" /></svg>
                                <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-tight">Importer</span>
                            </button>
                        </div>
                        
                        <div>
                            <span className="text-[9px] uppercase font-black text-gray-400 dark:text-gray-500 mb-2.5 block tracking-widest px-1">Outils de Levé</span>
                            <div className="grid grid-cols-2 gap-2">
                                {creationTools.map(tool => (
                                    <button key={tool.id} onClick={() => onToolSelect(activeTool === tool.id ? 'pan' : tool.id)} className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-200 border ${activeTool === tool.id ? 'bg-blue-500 dark:bg-blue-600 border-blue-400 dark:border-blue-500 text-white shadow-md scale-105' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-200 dark:hover:border-blue-900 hover:text-blue-600 dark:hover:text-blue-400'}`}>
                                        <div className="mb-1.5">{tool.icon}</div>
                                        <span className="text-[9px] font-bold uppercase">{tool.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <span className="text-[9px] uppercase font-black text-gray-400 dark:text-gray-500 mb-2.5 block tracking-widest px-1">Mesures</span>
                            <div className="grid grid-cols-4 gap-2">
                                {measureTools.map(tool => (
                                    <button key={tool.id} onClick={() => onToolSelect(activeTool === tool.id ? 'pan' : tool.id)} title={tool.label} className={`flex flex-col items-center justify-center p-2.5 rounded-2xl transition-all duration-200 border ${activeTool === tool.id ? 'bg-amber-500 border-amber-400 text-white shadow-md scale-105' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-amber-200 dark:hover:border-amber-900 hover:text-amber-600 dark:hover:text-amber-400'}`}>
                                        <div className="mb-1">{tool.icon}</div>
                                        <span className="text-[9px] font-bold uppercase">{tool.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button onClick={onClearSketch} className="w-full mt-2 text-center text-[10px] font-bold uppercase py-2.5 rounded-xl text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all border border-dashed border-red-200 dark:border-red-800/30">Effacer mesures</button>
                    </div>
                </AccordionSection>
                
                {importedLayers.length > 0 && (
                    <AccordionSection title="Couches GIS" isOpen={openSections.imported} onToggle={() => toggleSection('imported')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>}>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1 pt-1">
                            {importedLayers.map(layer => (
                                <ToggleSwitch key={layer.id} checked={layer.visible} onChange={() => onToggleImportedLayer && onToggleImportedLayer(layer.id)} label={layer.name} color={layer.color} />
                            ))}
                        </div>
                    </AccordionSection>
                )}

                <AccordionSection title="Couches de base" isOpen={openSections.basemaps} onToggle={() => toggleSection('basemaps')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}>
                    <div className="grid grid-cols-2 gap-3">
                        {basemaps.map(layer => (
                            <button key={layer.id} onClick={() => handleLayerChange(layer.id)} className={`relative group overflow-hidden rounded-xl border-2 transition-all duration-300 ${settings.mapTileLayer === layer.id ? 'border-blue-500 scale-[1.02] shadow-md' : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'}`}>
                                <div className="h-12 w-full" style={{ backgroundColor: layer.color }}></div>
                                <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/0 transition-all duration-300"><span className={`text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full backdrop-blur-sm shadow-sm ${settings.mapTileLayer === layer.id ? 'bg-blue-600 text-white' : 'bg-white/80 dark:bg-black/60 text-gray-800 dark:text-gray-100'}`}>{layer.label}</span></div>
                            </button>
                        ))}
                    </div>
                </AccordionSection>

                <AccordionSection title="Parcelles" isOpen={openSections.parcels} onToggle={() => toggleSection('parcels')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1 pt-1">
                        {parcels.length === 0 && <p className="text-[11px] text-gray-400 italic text-center py-2 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl">Aucune donnée vectorielle</p>}
                        {parcels.map(parcel => (
                            <ToggleSwitch key={parcel.id} checked={parcel.isVisible} onChange={() => parcelManager.updateParcel(parcel.id, { isVisible: !parcel.isVisible })} label={parcel.name} color={parcel.color} />
                        ))}
                    </div>
                </AccordionSection>
                
                <AccordionSection title="Affichage" isOpen={openSections.layers} onToggle={() => toggleSection('layers')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}>
                    <div className="space-y-1.5">
                        <ToggleSwitch checked={visibility.points} onChange={() => handleVisibilityToggle('points')} label="Numérotation Bornes" />
                        <ToggleSwitch checked={visibility.polygon} onChange={() => handleVisibilityToggle('polygon')} label="Contours & Surfaces" />
                        <ToggleSwitch checked={visibility.annotations} onChange={() => handleVisibilityToggle('annotations')} label="Textes d'Annotation" />
                    </div>
                </AccordionSection>
            </div>
            
            <div className="px-4 py-2.5 bg-gray-50/80 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 backdrop-blur-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Rendu actif</span>
                </div>
                <span className="text-[9px] font-bold text-gray-500">{parcels.length} Parcelles</span>
            </div>
        </div>
    )
};

export default MapControlPanel;
