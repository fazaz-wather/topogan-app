import React, { useState, useMemo } from 'react';
import { Point, AppSettings, Notification, Parcel } from '../types';
import { calculateResection } from '../services/topographyService';
import { usePointsManager } from '../hooks/usePointsManager';
import StandardViewLayout from '../components/StandardViewLayout';
import CalculationPanel from '../components/CalculationPanel';
import { useParcels } from '../hooks/useParcels';

interface ResectionViewProps {
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

const ResectionView: React.FC<ResectionViewProps> = (props) => {
  const { points, setPoints, settings, setNotification, getNextPointId } = props;
  const [pA_id, setPA_id] = useState<string>('');
  const [pB_id, setPB_id] = useState<string>('');
  const [pC_id, setPC_id] = useState<string>('');
  const [angleAPB, setAngleAPB] = useState('');
  const [angleBPC, setAngleBPC] = useState('');
  const isWGS84 = settings.coordinateSystem === 'wgs84';

  const { addPoint } = usePointsManager(setPoints, setNotification, getNextPointId);

  const calculationResult = useMemo(() => {
    if (isWGS84) return { point: null, error: null };
    if (!pA_id || !pB_id || !pC_id || !angleAPB || !angleBPC) return { point: null, error: null };
    
    const pA = points.find(p => p.id === parseInt(pA_id));
    const pB = points.find(p => p.id === parseInt(pB_id));
    const pC = points.find(p => p.id === parseInt(pC_id));

    if (!pA || !pB || !pC) return { point: null, error: "Veuillez sélectionner 3 points de référence valides." };
    if (pA.id === pB.id || pB.id === pC.id || pA.id === pC.id) return { point: null, error: "Les 3 points de référence doivent être distincts." };

    const angAPB = parseFloat(angleAPB);
    const angBPC = parseFloat(angleBPC);
    if (isNaN(angAPB) || isNaN(angBPC)) return { point: null, error: "Les angles doivent être des valeurs numériques." };
    if (angAPB <= 0 || angBPC <= 0 || angAPB >= 180 || angBPC >= 180) return { point: null, error: "Les angles doivent être supérieurs à 0 et inférieurs à 180 degrés." };
    
    const station = calculateResection(pA, pB, pC, angAPB, angBPC);
    if (station === null) return { point: null, error: "Calcul impossible. La station se trouve peut-être sur le cercle dangereux passant par A, B et C." };

    return { point: station, error: null };
}, [points, pA_id, pB_id, pC_id, angleAPB, angleBPC, isWGS84]);

  const addStationPointToList = () => {
    if (calculationResult.point) addPoint(calculationResult.point);
  };
  
  const commonSelectClasses = "mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md";
  const commonInputClasses = "mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm";

  return (
    <StandardViewLayout {...props}>
        <CalculationPanel title="Calcul de Rétablissement (Relèvement)">
            {isWGS84 ? (
                <div className="p-3 my-2 text-sm text-yellow-800 bg-yellow-100 dark:text-yellow-200 dark:bg-yellow-900/50 rounded-lg border border-yellow-300 dark:border-yellow-700">
                    <p>L'outil "<strong>Rétablissement</strong>" est conçu pour la topographie plane et n'est pas compatible avec le système de coordonnées WGS84. Veuillez sélectionner un système projeté (Local ou Merchich) dans les paramètres pour utiliser cet outil.</p>
                </div>
            ) : (
                <>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Sélectionnez 3 points connus (A, B, C) et entrez les angles mesurés depuis la station P (APB et BPC).</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <select value={pA_id} onChange={e => setPA_id(e.target.value)} className={commonSelectClasses} disabled={points.length < 3}>
                            <option value="">Point A...</option>
                            {points.map(p => <option key={p.id} value={p.id}>Point {p.id}</option>)}
                        </select>
                        <select value={pB_id} onChange={e => setPB_id(e.target.value)} className={commonSelectClasses} disabled={points.length < 3}>
                            <option value="">Point B (central)...</option>
                            {points.filter(p => p.id !== parseInt(pA_id)).map(p => <option key={p.id} value={p.id}>Point {p.id}</option>)}
                        </select>
                         <select value={pC_id} onChange={e => setPC_id(e.target.value)} className={commonSelectClasses} disabled={points.length < 3}>
                            <option value="">Point C...</option>
                            {points.filter(p => p.id !== parseInt(pA_id) && p.id !== parseInt(pB_id)).map(p => <option key={p.id} value={p.id}>Point {p.id}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                             <label htmlFor="angleAPB" className="block text-sm font-medium">Angle APB (degrés)</label>
                             <input id="angleAPB" type="number" step="any" value={angleAPB} onChange={e => setAngleAPB(e.target.value)} placeholder="ex: 32.451" required className={commonInputClasses} />
                        </div>
                         <div>
                             <label htmlFor="angleBPC" className="block text-sm font-medium">Angle BPC (degrés)</label>
                             <input id="angleBPC" type="number" step="any" value={angleBPC} onChange={e => setAngleBPC(e.target.value)} placeholder="ex: 45.987" required className={commonInputClasses} />
                        </div>
                    </div>
                    {calculationResult.point && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/50 rounded-lg shadow-inner">
                            <h3 className="text-md font-semibold mb-2 text-blue-800 dark:text-blue-200">Coordonnées de la Station (P)</h3>
                            <div className="space-y-2 font-mono text-sm">
                                <p><strong>X:</strong> {calculationResult.point.x.toFixed(settings.precision)}</p>
                                <p><strong>Y:</strong> {calculationResult.point.y.toFixed(settings.precision)}</p>
                            </div>
                            <button onClick={addStationPointToList} className="mt-4 w-full bg-green-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-700 transition duration-200">
                                Ajouter P à la liste
                            </button>
                        </div>
                    )}
                    {calculationResult.error && (
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/50 rounded-lg shadow-inner">
                            <p className="font-semibold text-yellow-800 dark:text-yellow-200">{calculationResult.error}</p>
                        </div>
                    )}
                </>
            )}
        </CalculationPanel>
    </StandardViewLayout>
  );
};

export default ResectionView;