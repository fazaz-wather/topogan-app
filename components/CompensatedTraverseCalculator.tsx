import React, { useState } from 'react';
import { Point, AppSettings, Notification } from '../types';
import CalculationPanel from './CalculationPanel';
import { calculateBearing, calculateCompensatedTraverse, CompensatedTraverseResult, TraverseLeg } from '../services/topographyService';

interface CompensatedTraverseCalculatorProps {
    points: Point[];
    settings: AppSettings;
    onAddPoints: (points: { x: number, y: number }[]) => void;
    setNotification: (message: string, type: Notification['type']) => void;
}

type OrientationMethod = 'calculated' | 'manual';
type LegInput = { angle: string; distance: string };

const CompensatedTraverseCalculator: React.FC<CompensatedTraverseCalculatorProps> = ({ points, settings, onAddPoints, setNotification }) => {
    const [startPointId, setStartPointId] = useState<string>('');
    const [endPointId, setEndPointId] = useState<string>('');
    const [orientationMethod, setOrientationMethod] = useState<OrientationMethod>('calculated');
    const [orientationPointId, setOrientationPointId] = useState<string>('');
    const [manualBearing, setManualBearing] = useState<string>('');
    const [legs, setLegs] = useState<LegInput[]>([{ angle: '', distance: '' }]);
    const [result, setResult] = useState<CompensatedTraverseResult | null>(null);
    const [useAngularClosure, setUseAngularClosure] = useState<boolean>(false);
    const [closingReferencePointId, setClosingReferencePointId] = useState<string>('');
    const [measuredClosingAngle, setMeasuredClosingAngle] = useState<string>('');

    const isWGS84 = settings.coordinateSystem === 'wgs84';

    const handleLegChange = (index: number, field: keyof LegInput, value: string) => {
        const newLegs = [...legs];
        newLegs[index][field] = value;
        setLegs(newLegs);
    };
    const addLeg = () => setLegs([...legs, { angle: '', distance: '' }]);
    const removeLeg = (index: number) => {
        if (legs.length > 1) {
            setLegs(legs.filter((_, i) => i !== index));
        }
    };

    const handleCalculate = () => {
        setResult(null);
        const startPoint = points.find(p => p.id === parseInt(startPointId));
        const endPoint = points.find(p => p.id === parseInt(endPointId));

        if (!startPoint || !endPoint) {
            setNotification('Veuillez sélectionner des points de départ et d\'arrivée valides.', 'error');
            return;
        }

        let initialBearing: number;
        if (orientationMethod === 'calculated') {
            const orientationPoint = points.find(p => p.id === parseInt(orientationPointId));
            if (!orientationPoint) {
                setNotification('Veuillez sélectionner un point d\'orientation valide.', 'error');
                return;
            }
            initialBearing = calculateBearing(startPoint, orientationPoint, 'local');
        } else {
            initialBearing = parseFloat(manualBearing);
            if (isNaN(initialBearing)) {
                setNotification('Veuillez entrer un gisement de départ valide.', 'error');
                return;
            }
        }
        
        const parsedLegs: TraverseLeg[] = [];
        for (const leg of legs) {
            const angle = parseFloat(leg.angle);
            const distance = parseFloat(leg.distance);
            if (isNaN(angle) || isNaN(distance)) {
                setNotification('Veuillez vérifier que toutes les visées ont un angle et une distance valides.', 'error');
                return;
            }
            parsedLegs.push({ angle, distance });
        }
        
        const closingReferencePoint = useAngularClosure ? points.find(p => p.id === parseInt(closingReferencePointId)) : undefined;
        const closingAngle = useAngularClosure ? parseFloat(measuredClosingAngle) : undefined;
        
        if (useAngularClosure && (!closingReferencePoint || closingAngle === undefined || isNaN(closingAngle))) {
            setNotification('Veuillez fournir un point de référence et un angle de fermeture valides.', 'error');
            return;
        }

        const calculationResult = calculateCompensatedTraverse(
            startPoint, 
            endPoint, 
            initialBearing, 
            parsedLegs,
            closingReferencePoint,
            closingAngle
        );
        
        if (calculationResult) {
            setResult(calculationResult);
            setNotification('Cheminement compensé calculé avec succès.', 'success');
        } else {
            setNotification('Le calcul du cheminement a échoué. Vérifiez vos données.', 'error');
        }
    };
    
    const handleAddPoints = () => {
        if(result?.adjustedPoints) {
            onAddPoints(result.adjustedPoints);
            setNotification(`${result.adjustedPoints.length} points compensés ajoutés à la liste.`, 'success');
        }
    };
    
    const { precision } = settings;

    return (
        <CalculationPanel title="Cheminement Topographique Compensé">
            {isWGS84 ? (
                <div className="p-3 my-2 text-sm text-yellow-800 bg-yellow-100 dark:text-yellow-200 dark:bg-yellow-900/50 rounded-lg border border-yellow-300 dark:border-yellow-700">
                    <p>Cette fonctionnalité est conçue pour la topographie plane et n'est pas compatible avec WGS84. Veuillez choisir un système de coordonnées local ou projeté.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Points de Contrôle */}
                    <div className="grid grid-cols-2 gap-2">
                        <select value={startPointId} onChange={e => setStartPointId(e.target.value)} className="w-full text-sm p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" disabled={points.length < 2}>
                            <option value="">Pt de Départ...</option>
                            {points.map((p, i) => <option key={p.id} value={p.id}>B{i+1} (ID: {p.id})</option>)}
                        </select>
                        <select value={endPointId} onChange={e => setEndPointId(e.target.value)} className="w-full text-sm p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" disabled={points.length < 2}>
                            <option value="">Pt d'Arrivée...</option>
                             {points.map((p, i) => <option key={p.id} value={p.id}>B{i+1} (ID: {p.id})</option>)}
                        </select>
                    </div>

                    {/* Orientation */}
                    <fieldset className="p-2 border rounded-md dark:border-gray-600">
                        <legend className="text-xs px-1">Gisement de Départ</legend>
                        <div className="flex gap-4">
                            <label className="flex items-center text-sm gap-1"><input type="radio" value="calculated" checked={orientationMethod === 'calculated'} onChange={() => setOrientationMethod('calculated')} /> Calculé</label>
                            <label className="flex items-center text-sm gap-1"><input type="radio" value="manual" checked={orientationMethod === 'manual'} onChange={() => setOrientationMethod('manual')} /> Manuel</label>
                        </div>
                        {orientationMethod === 'calculated' ? (
                             <select value={orientationPointId} onChange={e => setOrientationPointId(e.target.value)} className="w-full text-sm mt-2 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" disabled={points.length < 2}>
                                <option value="">Pt d'Orientation...</option>
                                {points.filter(p => p.id !== parseInt(startPointId)).map((p, i) => <option key={p.id} value={p.id}>Point {p.id}</option>)}
                             </select>
                        ) : (
                            <input type="number" step="any" placeholder="Gisement (décimal)" value={manualBearing} onChange={e => setManualBearing(e.target.value)} className="w-full text-sm mt-2 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        )}
                    </fieldset>
                    
                    {/* Visées */}
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                        {legs.map((leg, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">S{index+1}</span>
                            <input type="number" step="any" value={leg.angle} onChange={e => handleLegChange(index, 'angle', e.target.value)} placeholder="Angle mesuré (deg)" required className="flex-1 w-full text-sm p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                            <input type="number" step="any" value={leg.distance} onChange={e => handleLegChange(index, 'distance', e.target.value)} placeholder="Distance" required className="flex-1 w-full text-sm p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                            <button type="button" onClick={() => removeLeg(index)} className="p-1 text-red-500 hover:text-red-700 disabled:opacity-50" disabled={legs.length <= 1}>&times;</button>
                          </div>
                        ))}
                    </div>
                     <button type="button" onClick={addLeg} className="text-sm text-blue-600 hover:text-blue-800">+ Ajouter une station</button>

                    {/* Angular Closure */}
                     <fieldset className="p-2 border rounded-md dark:border-gray-600">
                        <legend className="text-xs px-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={useAngularClosure} onChange={(e) => setUseAngularClosure(e.target.checked)} />
                                <span>Contrôle de Fermeture Angulaire</span>
                            </label>
                        </legend>
                        {useAngularClosure && (
                            <div className="mt-2 space-y-2">
                                <select value={closingReferencePointId} onChange={e => setClosingReferencePointId(e.target.value)} className="w-full text-sm p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" disabled={points.length < 3}>
                                    <option value="">Pt de Réf. Fermeture...</option>
                                    {points.filter(p => p.id !== parseInt(endPointId)).map((p,i) => <option key={p.id} value={p.id}>B{i+1} (ID: {p.id})</option>)}
                                </select>
                                <input type="number" step="any" placeholder="Angle mesuré à l'arrivée (deg)" value={measuredClosingAngle} onChange={e => setMeasuredClosingAngle(e.target.value)} className="w-full text-sm p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                            </div>
                        )}
                    </fieldset>

                     <button onClick={handleCalculate} disabled={points.length < 2} className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700 transition duration-200 disabled:bg-gray-400">Calculer et Compenser</button>
                    
                     {/* Résultats */}
                     {result && (
                        <div className="mt-4 space-y-3">
                            <div className="p-2 bg-gray-100 dark:bg-gray-900/50 rounded-md text-sm">
                                <h4 className="font-semibold">Rapport de Compensation</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                                    <div>
                                        <p>Erreur dX: {result.closingError.dx.toFixed(precision + 1)}</p>
                                        <p>Erreur dY: {result.closingError.dy.toFixed(precision + 1)}</p>
                                        <p>Erreur Linéaire: {result.closingError.total.toFixed(precision + 1)}</p>
                                        <p>Précision: 1 / {isFinite(result.relativePrecision) ? Math.round(result.relativePrecision).toLocaleString() : '∞'}</p>
                                    </div>
                                    {result.angularError && (
                                    <div>
                                        <p>Err. Angulaire: {result.angularError.degrees.toFixed(4)}°</p>
                                        <p>Correction/Sta: {-result.angularError.perStation.toFixed(4)}°</p>
                                    </div>
                                    )}
                                </div>
                            </div>
                            <div className="max-h-40 overflow-y-auto">
                                <table className="w-full text-xs text-left">
                                    <thead>
                                        <tr className="border-b dark:border-gray-600">
                                            <th className="p-1">Station</th>
                                            <th className="p-1">X Brut</th>
                                            <th className="p-1">Y Brut</th>
                                            <th className="p-1 font-bold text-green-600 dark:text-green-400">X Compensé</th>
                                            <th className="p-1 font-bold text-green-600 dark:text-green-400">Y Compensé</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.adjustedPoints.map((p, i) => (
                                            <tr key={i} className="border-b dark:border-gray-700 font-mono">
                                                <td className="p-1">S{i+1}</td>
                                                <td className="p-1">{result.unadjustedPoints[i].x.toFixed(precision)}</td>
                                                <td className="p-1">{result.unadjustedPoints[i].y.toFixed(precision)}</td>
                                                <td className="p-1 font-bold text-green-700 dark:text-green-400">{p.x.toFixed(precision)}</td>
                                                <td className="p-1 font-bold text-green-700 dark:text-green-400">{p.y.toFixed(precision)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <button onClick={handleAddPoints} className="w-full bg-green-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-700">Ajouter les points compensés</button>
                        </div>
                     )}
                </div>
            )}
        </CalculationPanel>
    );
};

export default CompensatedTraverseCalculator;
