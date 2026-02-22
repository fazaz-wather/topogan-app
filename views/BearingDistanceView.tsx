import React, { useState, useMemo } from 'react';
import { Point, AppSettings, Notification, Parcel } from '../types';
import { calculateDistanceBetweenPoints, calculateBearing, convertDecimalDegreesToDMS } from '../services/topographyService';
import { convertDistance, getDistanceUnitLabel } from '../services/unitConversionService';
import StandardViewLayout from '../components/StandardViewLayout';
import CalculationPanel from '../components/CalculationPanel';
import { useParcels } from '../hooks/useParcels';

interface BearingDistanceViewProps {
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

const BearingDistanceView: React.FC<BearingDistanceViewProps> = (props) => {
  const { points, settings } = props;
  const [pointAId, setPointAId] = useState<string>('');
  const [pointBId, setPointBId] = useState<string>('');
  
  const result = useMemo(() => {
    if (!pointAId || !pointBId) return null;
    
    const pointA = points.find(p => p.id === parseInt(pointAId));
    const pointB = points.find(p => p.id === parseInt(pointBId));

    if (!pointA || !pointB) return null;
    
    const rawDistance = calculateDistanceBetweenPoints(pointA, pointB, settings.coordinateSystem);
    const bearing = calculateBearing(pointA, pointB, settings.coordinateSystem);

    const displayedDistance = convertDistance(rawDistance, settings.distanceUnit);
    const distanceLabel = getDistanceUnitLabel(settings.distanceUnit);
    
    return {
      distance: displayedDistance,
      distanceLabel,
      bearing,
      bearingDMS: convertDecimalDegreesToDMS(bearing)
    };
  }, [pointAId, pointBId, points, settings.coordinateSystem, settings.distanceUnit]);

  return (
    <StandardViewLayout {...props}>
        <CalculationPanel title="Calcul de Gisement et Distance">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="point-a" className="block text-sm font-medium">Sommet de départ (A)</label>
                    <select
                        id="point-a"
                        value={pointAId}
                        onChange={e => setPointAId(e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        disabled={points.length < 1}
                    >
                        <option value="">Sélectionner un sommet</option>
                        {points.map((p, i) => <option key={p.id} value={p.id}>Sommet B{i+1} (ID: {p.id})</option>)}
                    </select>
                </div>
                 <div>
                    <label htmlFor="point-b" className="block text-sm font-medium">Sommet d'arrivée (B)</label>
                    <select
                        id="point-b"
                        value={pointBId}
                        onChange={e => setPointBId(e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        disabled={points.length < 1}
                    >
                        <option value="">Sélectionner un sommet</option>
                        {points.map((p, i) => <option key={p.id} value={p.id}>Sommet B{i+1} (ID: {p.id})</option>)}
                    </select>
                </div>
            </div>

            {result && (
                 <div className="p-4 mt-4 bg-blue-50 dark:bg-blue-900/50 rounded-lg shadow-inner">
                    <h3 className="text-md font-semibold mb-2 text-blue-800 dark:text-blue-200">Résultats</h3>
                    <div className="space-y-2 font-mono text-sm">
                        <p><strong>Distance A-B:</strong> {result.distance.toFixed(settings.precision)} {result.distanceLabel}</p>
                        <p><strong>Gisement A-B:</strong> {result.bearing.toFixed(settings.precision+2)}°</p>
                        <p><strong>Gisement (DMS):</strong> {result.bearingDMS}</p>
                    </div>
                 </div>
            )}
        </CalculationPanel>
    </StandardViewLayout>
  );
};

export default BearingDistanceView;