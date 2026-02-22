import React, { useState, FormEvent } from 'react';
import { Point, AppSettings, Notification, Parcel } from '../types';
import { calculateCoordinatesFromRadiation } from '../services/topographyService';
import { usePointsManager } from '../hooks/usePointsManager';
import StandardViewLayout from '../components/StandardViewLayout';
import CalculationPanel from '../components/CalculationPanel';
import { useParcels } from '../hooks/useParcels';

interface RadiationViewProps {
  parcels: Parcel[];
  activeParcelId: number | null;
  setActiveParcelId: (id: number | null) => void;
  parcelManager: ReturnType<typeof useParcels>;
  points: Point[];
  setPoints: (action: React.SetStateAction<Point[]>) => void;
  settings: AppSettings;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  setNotification: (message: string, type: Notification['type']) => void;
  highlightedPointId: number | null;
  setHighlightedPointId: (id: number | null) => void;
  getNextPointId: () => number;
}

const RadiationView: React.FC<RadiationViewProps> = (props) => {
  const { points, setPoints, settings, setNotification, getNextPointId } = props;
  const [stationId, setStationId] = useState('');
  const [azimuth, setAzimuth] = useState('');
  const [distance, setDistance] = useState('');
  const isWGS84 = settings.coordinateSystem === 'wgs84';

  const { addPoint } = usePointsManager(setPoints, setNotification, getNextPointId);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isWGS84) return;
    
    const station = points.find(p => p.id === parseInt(stationId));
    const az = parseFloat(azimuth);
    const dist = parseFloat(distance);

    if (!station || isNaN(az) || isNaN(dist)) {
        setNotification('Veuillez vérifier vos entrées. Station, azimut et distance sont requis.', 'error');
        return;
    }
    
    addPoint(calculateCoordinatesFromRadiation(station, az, dist));
    setAzimuth('');
    setDistance('');
  };

  return (
    <StandardViewLayout {...props}>
        <CalculationPanel title="Calcul de Sommet Rayonné">
            {isWGS84 ? (
                <div className="p-3 my-2 text-sm text-yellow-800 bg-yellow-100 dark:text-yellow-200 dark:bg-yellow-900/50 rounded-lg border border-yellow-300 dark:border-yellow-700">
                  <p>L'outil "<strong>Rayonnement</strong>" est conçu pour la topographie plane et n'est pas compatible avec le système de coordonnées WGS84. Veuillez sélectionner un système projeté (Local ou Merchich) dans les paramètres pour utiliser cet outil.</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label htmlFor="station" className="block text-sm font-medium">Station</label>
                        <select
                            id="station"
                            value={stationId}
                            onChange={e => setStationId(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            disabled={points.length < 1}
                            required
                        >
                            <option value="">Sélectionner une station</option>
                            {points.map((p, i) => <option key={p.id} value={p.id}>Sommet B{i+1} (ID: {p.id})</option>)}
                        </select>
                    </div>
                    <div className="flex space-x-2">
                        <div className="flex-1">
                             <label htmlFor="azimuth" className="block text-sm font-medium">Azimut (degrés)</label>
                             <input id="azimuth" type="number" step="any" value={azimuth} onChange={e => setAzimuth(e.target.value)} placeholder="ex: 45.123" required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm" />
                        </div>
                        <div className="flex-1">
                            <label htmlFor="distance" className="block text-sm font-medium">Distance</label>
                            <input id="distance" type="number" step="any" value={distance} onChange={e => setDistance(e.target.value)} placeholder="ex: 125.67" required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm" />
                        </div>
                    </div>
                    <button 
                        type="submit" 
                        disabled={points.length === 0}
                        className="w-full bg-green-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-700 transition duration-200 disabled:bg-gray-400 dark:disabled:bg-gray-600"
                    >
                        Ajouter le Sommet Rayonné
                    </button>
                </form>
            )}
        </CalculationPanel>
    </StandardViewLayout>
  );
};

export default RadiationView;