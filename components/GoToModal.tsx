
import React, { useState, useMemo } from 'react';
import { CoordinateSystem, Parcel, Point, Notification } from '../types';
import { parseDMSToDD } from '../services/topographyService';
import { coordinateTransformationService } from '../services/coordinateTransformationService';

interface GoToModalProps {
  onClose: () => void;
  onGoTo: (coords: { x: number, y: number }, system: CoordinateSystem) => void;
  parcels: Parcel[];
  coordinateSystem: CoordinateSystem;
  setNotification: (message: string, type: Notification['type']) => void;
}

const coordinateSystems: { id: CoordinateSystem; label: string }[] = [
    { id: 'wgs84', label: 'WGS84 (Lon/Lat)' },
    { id: 'lambert_nord_maroc', label: 'Lambert Nord Maroc (QGIS)' },
    { id: 'lambert_sud_maroc', label: 'Lambert Sud Maroc (QGIS)' },
    { id: 'lambert_z1', label: 'Lambert Maroc: Zone 1' },
    { id: 'lambert_z2', label: 'Lambert Maroc: Zone 2' },
    { id: 'lambert_z3', label: 'Lambert Maroc: Zone 3' },
    { id: 'lambert_z4', label: 'Lambert Maroc: Zone 4' },
];

const GoToModal: React.FC<GoToModalProps> = ({ onClose, onGoTo, parcels, coordinateSystem, setNotification }) => {
    const [activeTab, setActiveTab] = useState<'coords' | 'point'>('coords');
    
    // Coords Tab State
    const [x, setX] = useState('');
    const [y, setY] = useState('');
    const [system, setSystem] = useState<CoordinateSystem>('lambert_sud_maroc');
    const [coordMode, setCoordMode] = useState<'dd' | 'dms'>('dd');
    const [dms, setDms] = useState({ latD: '', latM: '', latS: '', lonD: '', lonM: '', lonS: '' });

    // Point Tab State
    const [searchTerm, setSearchTerm] = useState('');

    const handleGetDirections = (targetCoords: { x: number, y: number }, targetSystem: CoordinateSystem) => {
        setNotification('Obtention de votre position...', 'info');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLon = position.coords.longitude;

                let targetWgsCoords = targetCoords;
                if (targetSystem !== 'wgs84') {
                    const transformed = coordinateTransformationService.transform(targetCoords, targetSystem, 'wgs84');
                    if (!transformed) {
                        setNotification(`Impossible de transformer les coordonnées de ${targetSystem}.`, 'error');
                        return;
                    }
                    targetWgsCoords = transformed;
                }
                
                const targetLat = targetWgsCoords.y;
                const targetLon = targetWgsCoords.x;

                const url = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLon}&destination=${targetLat},${targetLon}`;
                window.open(url, '_blank', 'noopener,noreferrer');
                onClose();
            },
            (error) => {
                let message = 'Erreur de géolocalisation.';
                if (error.code === 1) message = 'Accès à la localisation refusé.';
                setNotification(message, 'error');
            },
            { enableHighAccuracy: true }
        );
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const text = e.clipboardData.getData('text');
        if (!text) return;
        
        const parts = text.trim().split(/[\s,;\t]+/);
        const cleanParts = parts.filter(p => p !== '');

        if (cleanParts.length >= 2) {
            const val1 = parseFloat(cleanParts[0]);
            const val2 = parseFloat(cleanParts[1]);
            
            if (isNaN(val1) || isNaN(val2)) return;

            e.preventDefault();

            // Heuristic for WGS84: Detect "Lat, Lon" vs "Lon, Lat"
            // In Morocco: Lat ~21-36 (Pos), Lon ~-17 to -1 (Neg)
            if (system === 'wgs84') {
                if (val1 > 0 && val2 < 0) {
                    // Likely "Lat, Lon" -> Y, X
                    setY(val1.toString());
                    setX(val2.toString());
                    setNotification('Format détecté : Latitude (Y), Longitude (X)', 'info');
                } else {
                    // Default "Lon, Lat" -> X, Y
                    setX(val1.toString());
                    setY(val2.toString());
                    setNotification('Format détecté : Longitude (X), Latitude (Y)', 'info');
                }
            } else {
                // Projected: X, Y
                setX(val1.toString());
                setY(val2.toString());
                setNotification('Format détecté : X, Y', 'info');
            }
        }
    };

    const handleSubmitCoords = (e: React.FormEvent) => {
        e.preventDefault();
        let xVal: number, yVal: number;

        if (system === 'wgs84' && coordMode === 'dms') {
            yVal = parseDMSToDD(parseFloat(dms.latD), parseFloat(dms.latM), parseFloat(dms.latS));
            xVal = parseDMSToDD(parseFloat(dms.lonD), parseFloat(dms.lonM), parseFloat(dms.lonS));
        } else {
            xVal = parseFloat(x);
            yVal = parseFloat(y);
        }
        
        if (!isNaN(xVal) && !isNaN(yVal)) {
            onGoTo({ x: xVal, y: yVal }, system);
            onClose();
        }
    };
    
    const handleSubmitDirections = () => {
        let xVal: number, yVal: number;
        if (system === 'wgs84' && coordMode === 'dms') {
            yVal = parseDMSToDD(parseFloat(dms.latD), parseFloat(dms.latM), parseFloat(dms.latS));
            xVal = parseDMSToDD(parseFloat(dms.lonD), parseFloat(dms.lonM), parseFloat(dms.lonS));
        } else {
            xVal = parseFloat(x);
            yVal = parseFloat(y);
        }
        if (!isNaN(xVal) && !isNaN(yVal)) {
            handleGetDirections({ x: xVal, y: yVal }, system);
        } else {
            setNotification('Veuillez entrer des coordonnées valides.', 'error');
        }
    };

    const handlePointSelect = (point: Point) => {
        onGoTo({ x: point.x, y: point.y }, coordinateSystem);
        onClose();
    };

    const allPoints = useMemo(() => {
        return parcels.flatMap(p => p.points.map(pt => ({ ...pt, parcelName: p.name, parcelColor: p.color })))
    }, [parcels]);

    const filteredPoints = useMemo(() => {
        if (!searchTerm) return [];
        const lowerSearch = searchTerm.toLowerCase();
        return allPoints.filter(p => p.id.toString().includes(lowerSearch));
    }, [searchTerm, allPoints]);


    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[2000]" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6 m-4 flex flex-col" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4 flex-shrink-0">Aller à...</h2>
                
                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4 flex-shrink-0">
                    <button onClick={() => setActiveTab('coords')} className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${activeTab === 'coords' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Coordonnées</button>
                    <button onClick={() => setActiveTab('point')} className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${activeTab === 'point' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Borne existante</button>
                </div>

                <div className="overflow-y-auto pr-2 -mr-2 max-h-[70vh]">
                    {/* Coords Tab Content */}
                    {activeTab === 'coords' && (
                        <form onSubmit={handleSubmitCoords} className="space-y-4">
                            <div>
                                <label htmlFor="goto-system" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Système de coordonnées source</label>
                                <select id="goto-system" value={system} onChange={(e) => setSystem(e.target.value as CoordinateSystem)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md">
                                    {coordinateSystems.map(cs => <option key={cs.id} value={cs.id}>{cs.label}</option>)}
                                </select>
                            </div>
                            
                            {system === 'wgs84' && (
                                <div className="flex items-center justify-center space-x-2">
                                    <label className="text-sm">Format:</label>
                                    <button type="button" onClick={() => setCoordMode('dd')} className={`px-3 py-1 text-xs rounded-md ${coordMode === 'dd' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>DD</button>
                                    <button type="button" onClick={() => setCoordMode('dms')} className={`px-3 py-1 text-xs rounded-md ${coordMode === 'dms' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>DMS</button>
                                </div>
                            )}

                            {coordMode === 'dms' && system === 'wgs84' ? (
                                <>
                                    <div className="space-y-1">
                                        <label className="block text-sm font-medium">Latitude (Y)</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            <input type="number" step="any" value={dms.latD} onChange={e => setDms({...dms, latD: e.target.value})} placeholder="Deg" required className="block w-full px-2 py-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 border rounded-md" />
                                            <input type="number" step="any" value={dms.latM} onChange={e => setDms({...dms, latM: e.target.value})} placeholder="Min" required className="block w-full px-2 py-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 border rounded-md" />
                                            <input type="number" step="any" value={dms.latS} onChange={e => setDms({...dms, latS: e.target.value})} placeholder="Sec" required className="block w-full px-2 py-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 border rounded-md" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-sm font-medium">Longitude (X)</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            <input type="number" step="any" value={dms.lonD} onChange={e => setDms({...dms, lonD: e.target.value})} placeholder="Deg" required className="block w-full px-2 py-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 border rounded-md" />
                                            <input type="number" step="any" value={dms.lonM} onChange={e => setDms({...dms, lonM: e.target.value})} placeholder="Min" required className="block w-full px-2 py-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 border rounded-md" />
                                            <input type="number" step="any" value={dms.lonS} onChange={e => setDms({...dms, lonS: e.target.value})} placeholder="Sec" required className="block w-full px-2 py-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 border rounded-md" />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    <div className="flex-1">
                                        <label htmlFor="x-coord-goto" className="block text-sm font-medium">{system === 'wgs84' ? 'Longitude (X)' : 'Est (X)'}</label>
                                        <input 
                                            id="x-coord-goto" 
                                            type="number" 
                                            step="any" 
                                            value={x} 
                                            onChange={(e) => setX(e.target.value)} 
                                            onPaste={handlePaste}
                                            required 
                                            placeholder={system === 'wgs84' ? "-7.5898" : "350000"}
                                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm" 
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label htmlFor="y-coord-goto" className="block text-sm font-medium">{system === 'wgs84' ? 'Latitude (Y)' : 'Nord (Y)'}</label>
                                        <input 
                                            id="y-coord-goto" 
                                            type="number" 
                                            step="any" 
                                            value={y} 
                                            onChange={(e) => setY(e.target.value)} 
                                            onPaste={handlePaste}
                                            required 
                                            placeholder={system === 'wgs84' ? "33.5731" : "370000"}
                                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm" 
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
                                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Annuler</button>
                                <button type="button" onClick={handleSubmitDirections} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.428A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.409l-7-14z" /></svg>
                                    Itinéraire
                                </button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700">Aller</button>
                            </div>
                        </form>
                    )}

                    {/* Point Tab Content */}
                    {activeTab === 'point' && (
                        <div className="space-y-3">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Rechercher par ID de borne..."
                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
                            />
                            <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
                                {filteredPoints.length > 0 ? (
                                    <ul>
                                        {filteredPoints.map(p => (
                                            <li key={p.id} className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/50 border-b dark:border-gray-700 last:border-b-0">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <div className="font-bold flex items-center">
                                                            <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: p.parcelColor }}></span>
                                                            Borne ID: {p.id} <span className="font-normal text-xs ml-2">({p.parcelName})</span>
                                                        </div>
                                                        <div className="text-xs font-mono text-gray-500 dark:text-gray-400 pl-5">X: {p.x.toFixed(3)}, Y: {p.y.toFixed(3)}</div>
                                                    </div>
                                                    <div className="flex space-x-2">
                                                         <button onClick={() => handleGetDirections(p, coordinateSystem)} className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">Itinéraire</button>
                                                        <button onClick={() => handlePointSelect(p)} className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Aller</button>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="p-4 text-sm text-center text-gray-500">Aucune borne trouvée.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GoToModal;
