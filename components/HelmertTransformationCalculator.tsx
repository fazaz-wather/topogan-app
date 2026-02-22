
import React, { useState } from 'react';
import { AppSettings, Notification } from '../types';
import { calculateHelmertParameters, applyHelmertTransformation, HelmertControlPoint, HelmertResult } from '../services/topographyService';

interface HelmertTransformationCalculatorProps {
    settings: AppSettings;
    onAddPoints: (points: { x: number, y: number }[]) => void;
    setNotification: (message: string, type: Notification['type']) => void;
}

type ControlPointRow = {
    id: number;
    sourceX: string;
    sourceY: string;
    targetX: string;
    targetY: string;
};

const HelmertTransformationCalculator: React.FC<HelmertTransformationCalculatorProps> = ({ settings, onAddPoints, setNotification }) => {
    const [controlPoints, setControlPoints] = useState<ControlPointRow[]>([
        { id: 1, sourceX: '', sourceY: '', targetX: '', targetY: '' },
        { id: 2, sourceX: '', sourceY: '', targetX: '', targetY: '' },
    ]);
    const [result, setResult] = useState<HelmertResult | null>(null);
    const [pointsToTransform, setPointsToTransform] = useState('');
    const [transformedPoints, setTransformedPoints] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleControlPointChange = (id: number, field: keyof Omit<ControlPointRow, 'id'>, value: string) => {
        setControlPoints(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
        setResult(null); // Invalidate result if points change
    };

    const addControlPoint = () => {
        setControlPoints(prev => [...prev, { id: Date.now(), sourceX: '', sourceY: '', targetX: '', targetY: '' }]);
    };

    const removeControlPoint = (id: number) => {
        if (controlPoints.length > 2) {
            setControlPoints(prev => prev.filter(p => p.id !== id));
        } else {
            setNotification("Un minimum de 2 points de contrôle est requis.", "error");
        }
    };

    const handleCalculateParameters = () => {
        setError(null);
        setResult(null);
        const parsedPoints: HelmertControlPoint[] = [];
        for (const cp of controlPoints) {
            const sx = parseFloat(cp.sourceX);
            const sy = parseFloat(cp.sourceY);
            const tx = parseFloat(cp.targetX);
            const ty = parseFloat(cp.targetY);
            if ([sx, sy, tx, ty].some(isNaN)) {
                setError(`Données invalides pour le point ID ${cp.id}. Veuillez entrer des nombres valides.`);
                return;
            }
            parsedPoints.push({ source: { x: sx, y: sy }, target: { x: tx, y: ty } });
        }

        if (parsedPoints.length < 2) {
            setError("Au moins 2 points de contrôle sont nécessaires pour le calcul.");
            return;
        }

        const helmertResult = calculateHelmertParameters(parsedPoints);
        if (helmertResult) {
            setResult(helmertResult);
            setNotification("Paramètres de transformation calculés avec succès.", 'success');
        } else {
            setError("Calcul impossible. Vérifiez que les points de contrôle ne sont pas colinéaires.");
        }
    };

    const handleTransformPoints = () => {
        if (!result) {
            setNotification("Veuillez d'abord calculer les paramètres de transformation.", 'error');
            return;
        }
        const lines = pointsToTransform.trim().split('\n');
        const transformed: string[] = [];
        let errorCount = 0;

        lines.forEach(line => {
            const parts = line.trim().split(/[\s,;\t]+/);
            if (parts.length >= 2) {
                const x = parseFloat(parts[0]);
                const y = parseFloat(parts[1]);
                if (!isNaN(x) && !isNaN(y)) {
                    const transformedPoint = applyHelmertTransformation({ x, y }, result.parameters);
                    transformed.push(`${transformedPoint.x.toFixed(settings.precision)}\t${transformedPoint.y.toFixed(settings.precision)}`);
                } else {
                    errorCount++;
                }
            } else if (line.trim() !== '') {
                errorCount++;
            }
        });

        setTransformedPoints(transformed.join('\n'));
        if (errorCount > 0) {
            setNotification(`${errorCount} ligne(s) n'ont pas pu être traitée(s).`, 'error');
        }
    };

    const handleAddToList = () => {
        const pointsToAdd = transformedPoints.trim().split('\n').map(line => {
            const [x, y] = line.split(/[\s,;\t]+/).map(parseFloat);
            return { x, y };
        }).filter(p => !isNaN(p.x) && !isNaN(p.y));
        
        if (pointsToAdd.length > 0) {
            onAddPoints(pointsToAdd);
        } else {
            setNotification("Aucun point valide à ajouter.", 'info');
        }
    };

    const handleCopyResults = () => {
        navigator.clipboard.writeText(transformedPoints).then(() => {
            setNotification('Résultats copiés.', 'success');
        });
    };

    const commonInputClasses = "w-full text-sm p-1.5 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-600 focus:ring-1 focus:ring-blue-500 focus:outline-none";

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
                Calcule une transformation à 4 paramètres (Tx, Ty, Échelle, Rotation) à partir de points communs.
            </p>
            
            {/* Control Points */}
            <fieldset className="p-3 border rounded-md border-gray-300 dark:border-gray-600 space-y-2">
                <legend className="px-2 font-semibold text-sm">Points de Contrôle</legend>
                <div className="max-h-40 overflow-y-auto pr-2">
                    {controlPoints.map((p, index) => (
                        <div key={p.id} className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-2 items-center mb-2 text-xs">
                            <span className="font-mono text-gray-500">{index + 1}</span>
                            <input type="number" step="any" value={p.sourceX} onChange={e => handleControlPointChange(p.id, 'sourceX', e.target.value)} placeholder="Source X" className={commonInputClasses} />
                            <input type="number" step="any" value={p.sourceY} onChange={e => handleControlPointChange(p.id, 'sourceY', e.target.value)} placeholder="Source Y" className={commonInputClasses} />
                            <input type="number" step="any" value={p.targetX} onChange={e => handleControlPointChange(p.id, 'targetX', e.target.value)} placeholder="Cible X" className={commonInputClasses} />
                            <input type="number" step="any" value={p.targetY} onChange={e => handleControlPointChange(p.id, 'targetY', e.target.value)} placeholder="Cible Y" className={commonInputClasses} />
                            <button onClick={() => removeControlPoint(p.id)} disabled={controlPoints.length <= 2} className="text-red-500 disabled:opacity-30">&times;</button>
                        </div>
                    ))}
                </div>
                <button onClick={addControlPoint} className="text-sm text-blue-600 hover:text-blue-800">+ Ajouter un point de contrôle</button>
            </fieldset>

            <button onClick={handleCalculateParameters} className="w-full bg-[#3F3356] text-white font-semibold py-2 px-4 rounded-md hover:bg-[#4c3e69]">Calculer les Paramètres</button>
            
            {error && <div className="p-2 text-sm text-red-700 bg-red-100 dark:text-red-200 dark:bg-red-900/50 rounded-lg">{error}</div>}

            {/* Results */}
            {result && (
                <div className="space-y-3">
                    <fieldset className="p-3 border rounded-md border-gray-300 dark:border-gray-600">
                        <legend className="px-2 font-semibold text-sm">Paramètres et Qualité</legend>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm font-mono">
                            <p>Tx: {result.parameters.tx.toFixed(4)}</p>
                            <p>Ty: {result.parameters.ty.toFixed(4)}</p>
                            <p>Échelle: {result.parameters.scale.toFixed(6)}</p>
                            <p>Rotation: {result.parameters.rotation.toFixed(5)}°</p>
                            <p className="col-span-2 font-bold">RMSE: {result.rmse.toFixed(4)}</p>
                        </div>
                        <div className="text-xs mt-2 max-h-24 overflow-y-auto">
                            <p className="font-semibold">Résidus:</p>
                            {result.residuals.map((r, i) => <p key={i} className="font-mono">Pt {i+1}: dX={r.dx.toFixed(4)}, dY={r.dy.toFixed(4)}</p>)}
                        </div>
                    </fieldset>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <textarea value={pointsToTransform} onChange={e => setPointsToTransform(e.target.value)} placeholder="Collez les points source à transformer ici... (X Y par ligne)" rows={5} className={`${commonInputClasses} font-mono`}></textarea>
                        <textarea value={transformedPoints} readOnly placeholder="Résultats transformés..." rows={5} className={`${commonInputClasses} font-mono bg-gray-50 dark:bg-gray-900`}></textarea>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                         <button onClick={handleTransformPoints} className="w-full text-sm bg-blue-600 text-white font-semibold py-2 px-3 rounded-md hover:bg-blue-700">Transformer</button>
                         <button onClick={handleCopyResults} disabled={!transformedPoints} className="w-full text-sm bg-gray-500 text-white font-semibold py-2 px-3 rounded-md hover:bg-gray-600 disabled:opacity-50">Copier</button>
                         <button onClick={handleAddToList} disabled={!transformedPoints} className="w-full text-sm bg-green-600 text-white font-semibold py-2 px-3 rounded-md hover:bg-green-700 disabled:opacity-50">Ajouter à la liste</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HelmertTransformationCalculator;
