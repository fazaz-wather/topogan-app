import React, { useState, useMemo, useEffect } from 'react';
import { CoordinateSystem, Point, AppSettings, Notification, Parcel } from '../types';
import { coordinateTransformationService } from '../services/coordinateTransformationService';
import StandardViewLayout from '../components/StandardViewLayout';
import CalculationPanel from '../components/CalculationPanel';
import { usePointsManager } from '../hooks/usePointsManager';
import HelmertTransformationCalculator from '../components/HelmertTransformationCalculator';
import { useParcels } from '../hooks/useParcels';

const transformableSystems: { id: CoordinateSystem; label: string }[] = [
    { id: 'wgs84', label: 'WGS84 (Latitude/Longitude)' },
    { id: 'lambert_nord_maroc', label: 'Lambert Nord Maroc (QGIS)' },
    { id: 'lambert_sud_maroc', label: 'Lambert Sud Maroc (QGIS)' },
    { id: 'lambert_z1', label: 'Lambert Maroc: Zone 1' },
    { id: 'lambert_z2', label: 'Lambert Maroc: Zone 2' },
    { id: 'lambert_z3', label: 'Lambert Maroc: Zone 3' },
    { id: 'lambert_z4', label: 'Lambert Maroc: Zone 4' },
];

interface CoordinateTransformationViewProps {
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

const CoordinateTransformationView: React.FC<CoordinateTransformationViewProps> = (props) => {
    const { points, setPoints, settings, setNotification, getNextPointId } = props;
    const { addPoints } = usePointsManager(setPoints, setNotification, getNextPointId);

    const [mode, setMode] = useState<'single' | 'batch' | 'helmert'>('single');
    const [sourceSystem, setSourceSystem] = useState<CoordinateSystem>('wgs84');
    const [targetSystem, setTargetSystem] = useState<CoordinateSystem>('lambert_sud_maroc');
    
    // State for single mode
    const [sourceX, setSourceX] = useState('');
    const [sourceY, setSourceY] = useState('');
    const [singleResult, setSingleResult] = useState<{ x: number; y: number } | null>(null);

    // State for batch mode
    const [sourceText, setSourceText] = useState('');
    const [resultText, setResultText] = useState('');
    const [batchError, setBatchError] = useState('');

    const [error, setError] = useState<string | null>(null);

    const isCurrentSystemTransformable = useMemo(() => settings.coordinateSystem !== 'local', [settings.coordinateSystem]);

    useEffect(() => {
        if (sourceSystem === targetSystem) {
            setTargetSystem(sourceSystem === 'wgs84' ? 'lambert_sud_maroc' : 'wgs84');
        }
    }, [sourceSystem, targetSystem]);

    const handleSwapSystems = () => {
        setSourceSystem(targetSystem);
        setTargetSystem(sourceSystem);
    };

    const handleLoadFromList = () => {
        if (points.length === 0) {
            setNotification("La liste de points est vide.", 'info');
            return;
        }
        if (!isCurrentSystemTransformable) {
            setNotification("Impossible de charger des points d'un système de coordonnées local.", 'error');
            return;
        }
        
        // Set the source system to match the points being loaded
        setSourceSystem(settings.coordinateSystem);
        
        // Set the target system to something different if it becomes the same
        if (settings.coordinateSystem === targetSystem) {
            setTargetSystem(settings.coordinateSystem === 'wgs84' ? 'lambert_sud_maroc' : 'wgs84');
        }

        const sourcePrec = settings.coordinateSystem === 'wgs84' ? Math.max(8, settings.precision) : settings.precision;
        const text = points.map(p => `${p.x.toFixed(sourcePrec)}\t${p.y.toFixed(sourcePrec)}`).join('\n');
        setSourceText(text);
        setNotification(`${points.length} points chargés. Le système source a été défini sur celui de la liste.`, 'success');
    };
    
    const handleAddToList = () => {
        const lines = resultText.trim().split('\n');
        const pointsToAdd: { x: number; y: number }[] = [];
        lines.forEach(line => {
            const parts = line.trim().split(/[\s,;\t]+/);
            if (parts.length >= 2) {
                const x = parseFloat(parts[0]);
                const y = parseFloat(parts[1]);
                if (!isNaN(x) && !isNaN(y)) {
                    pointsToAdd.push({ x, y });
                }
            }
        });
        if (pointsToAdd.length > 0) {
            addPoints(pointsToAdd);
            setNotification(`${pointsToAdd.length} points transformés ajoutés à la liste.`, 'success');
        } else {
            setNotification("Aucun point valide à ajouter.", 'error');
        }
    };

    const handleCopyResults = () => {
        navigator.clipboard.writeText(resultText).then(() => {
            setNotification('Résultats copiés dans le presse-papiers.', 'success');
        }, () => {
            setNotification('Échec de la copie.', 'error');
        });
    };

    const handleTransform = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setBatchError('');
        
        if (mode === 'single') {
            setSingleResult(null);
            const xVal = parseFloat(sourceX);
            const yVal = parseFloat(sourceY);
            if (isNaN(xVal) || isNaN(yVal)) {
                setError('Veuillez entrer des coordonnées source valides.'); return;
            }
            const transformed = coordinateTransformationService.transform({ x: xVal, y: yVal }, sourceSystem, targetSystem);
            if (transformed) {
                setSingleResult(transformed);
            } else {
                let errorMsg = `Transformation de ${sourceSystem} à ${targetSystem} a échoué.`;
                if (sourceSystem.startsWith('lambert_') || targetSystem.startsWith('lambert_')) {
                    errorMsg += " Veuillez vérifier que les coordonnées sont dans les limites de la zone de projection sélectionnée.";
                }
                setError(errorMsg);
            }
        } else { // Batch mode
            setResultText('');
            const lines = sourceText.trim().split('\n');
            let successCount = 0;
            let errorCount = 0;
            const results: string[] = [];
            const targetPrec = targetSystem === 'wgs84' ? Math.max(8, settings.precision) : settings.precision;

            lines.forEach(line => {
                const parts = line.trim().split(/[\s,;\t]+/);
                if (parts.length >= 2) {
                    const x = parseFloat(parts[0]);
                    const y = parseFloat(parts[1]);
                    if (!isNaN(x) && !isNaN(y)) {
                        const transformed = coordinateTransformationService.transform({ x, y }, sourceSystem, targetSystem);
                        if (transformed) {
                            results.push(`${transformed.x.toFixed(targetPrec)}\t${transformed.y.toFixed(targetPrec)}`);
                            successCount++;
                        } else {
                            errorCount++;
                        }
                    } else {
                        errorCount++;
                    }
                } else if (line.trim() !== '') {
                    errorCount++;
                }
            });
            setResultText(results.join('\n'));
            if (errorCount > 0) {
                setBatchError(`${errorCount} ligne(s) n'ont pas pu être traitée(s).`);
            }
            if (successCount > 0) {
                setNotification(`${successCount} points transformés.`, 'success');
            } else if (errorCount > 0) {
                setNotification('Aucun point n\'a pu être transformé.', 'error');
            } else {
                setNotification('Aucune donnée à transformer.', 'info');
            }
        }
    };

    const sourceLabels = useMemo(() => sourceSystem === 'wgs84' ? { x: 'Longitude', y: 'Latitude', p: 'e.g., -5.25, 34.15' } : { x: 'X (Est)', y: 'Y (Nord)', p: 'e.g., 500000, 300000' }, [sourceSystem]);
    const targetLabels = useMemo(() => targetSystem === 'wgs84' ? { x: 'Longitude', y: 'Latitude' } : { x: 'X (Est)', y: 'Y (Nord)' }, [targetSystem]);
    const targetPrecision = useMemo(() => targetSystem === 'wgs84' ? 8 : settings.precision, [targetSystem, settings.precision]);

    const commonSelectClasses = "block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md";
    const commonInputClasses = "mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm";
    
    return (
        <StandardViewLayout {...props}>
            <CalculationPanel title="Transformation de Coordonnées">
                 <div className="flex justify-center mb-4">
                    <div className="inline-flex rounded-md shadow-sm" role="group">
                        <button type="button" onClick={() => setMode('single')} className={`px-4 py-2 text-sm font-medium border rounded-l-lg ${mode === 'single' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>Point Unique</button>
                        <button type="button" onClick={() => setMode('batch')} className={`px-4 py-2 text-sm font-medium border-t border-b ${mode === 'batch' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>Par Lot</button>
                        <button type="button" onClick={() => setMode('helmert')} className={`px-4 py-2 text-sm font-medium border rounded-r-lg ${mode === 'helmert' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>Helmert</button>
                    </div>
                </div>

                {mode !== 'helmert' ? (
                  <form onSubmit={handleTransform} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
                          {/* SOURCE */}
                          <fieldset className="p-3 border rounded-md border-gray-300 dark:border-gray-600 space-y-3">
                              <legend className="px-2 font-semibold text-sm">Source</legend>
                              <select value={sourceSystem} onChange={e => setSourceSystem(e.target.value as CoordinateSystem)} className={commonSelectClasses}>
                                  {transformableSystems.map(cs => <option key={cs.id} value={cs.id}>{cs.label}</option>)}
                              </select>
                               {mode === 'single' ? (
                                  <div className="grid grid-cols-2 gap-2">
                                      <div><label className="text-xs">{sourceLabels.x}</label><input type="number" step="any" value={sourceX} onChange={e => setSourceX(e.target.value)} placeholder={sourceLabels.p.split(',')[0]} required className={commonInputClasses} /></div>
                                      <div><label className="text-xs">{sourceLabels.y}</label><input type="number" step="any" value={sourceY} onChange={e => setSourceY(e.target.value)} placeholder={sourceLabels.p.split(',')[1]} required className={commonInputClasses} /></div>
                                  </div>
                               ) : (
                                  <div>
                                      <textarea value={sourceText} onChange={e => setSourceText(e.target.value)} placeholder={`Collez les coordonnées ici...\nFormat: X Y\nou: X,Y`} rows={5} className={`${commonInputClasses} font-mono`}></textarea>
                                      <button 
                                          type="button" 
                                          onClick={handleLoadFromList} 
                                          disabled={points.length === 0 || !isCurrentSystemTransformable} 
                                          className="mt-2 w-full text-sm bg-gray-500 text-white font-semibold py-1.5 px-3 rounded-md hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                          title={!isCurrentSystemTransformable ? "Les points dans un système local ne peuvent pas être transformés." : "Charge les points de la liste principale."}
                                      >
                                          Charger depuis la liste
                                      </button>
                                  </div>
                               )}
                          </fieldset>
                          {/* SWAP */}
                          <button type="button" onClick={handleSwapSystems} title="Inverser les systèmes" className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></button>
                          {/* TARGET */}
                          <fieldset className="p-3 border rounded-md border-gray-300 dark:border-gray-600 space-y-3">
                              <legend className="px-2 font-semibold text-sm">Cible</legend>
                              <select value={targetSystem} onChange={e => setTargetSystem(e.target.value as CoordinateSystem)} className={commonSelectClasses}>
                                  {transformableSystems.map(cs => <option key={cs.id} value={cs.id}>{cs.label}</option>)}
                              </select>
                          </fieldset>
                      </div>
                      <button type="submit" className="w-full bg-[#3F3356] text-white font-semibold py-2 px-4 rounded-md hover:bg-[#4c3e69] transition duration-200">Transformer</button>
                  </form>
                ) : (
                  <HelmertTransformationCalculator
                      settings={settings}
                      onAddPoints={addPoints}
                      setNotification={setNotification}
                  />
                )}

                 {error && <div className="p-3 text-sm text-red-700 bg-red-100 dark:text-red-200 dark:bg-red-900/50 rounded-lg">{error}</div>}
                 {batchError && <div className="p-3 text-sm text-yellow-700 bg-yellow-100 dark:text-yellow-200 dark:bg-yellow-900/50 rounded-lg">{batchError}</div>}
                 
                 {mode === 'single' && singleResult && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/50 rounded-lg shadow-inner">
                        <h3 className="text-md font-semibold mb-2 text-blue-800 dark:text-blue-200">Résultat</h3>
                        <div className="space-y-2 font-mono text-sm">
                            <p><strong>{targetLabels.y}:</strong> {singleResult.y.toFixed(targetPrecision)}</p>
                            <p><strong>{targetLabels.x}:</strong> {singleResult.x.toFixed(targetPrecision)}</p>
                        </div>
                    </div>
                )}

                {mode === 'batch' && resultText && (
                    <div className="space-y-3">
                         <h3 className="text-md font-semibold">Résultats du lot</h3>
                         <textarea value={resultText} readOnly rows={5} className={`${commonInputClasses} font-mono bg-gray-50 dark:bg-gray-900`}></textarea>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button type="button" onClick={handleCopyResults} className="w-full text-sm bg-gray-500 text-white font-semibold py-1.5 px-3 rounded-md hover:bg-gray-600">Copier les résultats</button>
                            <button type="button" onClick={handleAddToList} className="w-full text-sm bg-green-600 text-white font-semibold py-1.5 px-3 rounded-md hover:bg-green-700">Ajouter à la liste</button>
                         </div>
                    </div>
                )}
            </CalculationPanel>
        </StandardViewLayout>
    );
};

export default CoordinateTransformationView;