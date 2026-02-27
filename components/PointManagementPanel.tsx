
import React from 'react';
import { Point, AppSettings, Notification, CalculationResults } from '../types';
import CoordinateInput from './CoordinateInput';
import CSVImporter from './CSVImporter';
import ExportButton from './ExportButton';
import PointList from './PointList';
import HistoryControls from './HistoryControls';
import { usePointsManager } from '../hooks/usePointsManager';
import MultiModalImporter from './MultiModalImporter';
import ResultsDisplay from './ResultsDisplay';
import { useParcels } from '../hooks/useParcels';

interface PointManagementPanelProps {
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
    results?: CalculationResults | null;
    onOpenBornageSketch?: () => void;
    parcelManager: ReturnType<typeof useParcels>;
    activeParcelId: number | null;
    setActiveParcelId: (id: number | null) => void;
    
    // New props for layout flexibility
    showResults?: boolean;
    showExports?: boolean;
    compact?: boolean;
}

const PointManagementPanel: React.FC<PointManagementPanelProps> = ({
    points,
    setPoints,
    settings,
    undo,
    redo,
    canUndo,
    canRedo,
    setNotification,
    highlightedPointId,
    setHighlightedPointId,
    getNextPointId,
    results,
    onOpenBornageSketch,
    parcelManager,
    activeParcelId,
    setActiveParcelId,
    showResults = true,
    showExports = true,
    compact = false,
}) => {
    const { addPoints, addPoint, deletePoint, clearPoints, movePoint, updatePoint } = usePointsManager(setPoints, setNotification, getNextPointId);

    const handleImportLayers = (layers: { layerName: string; points: { x: number; y: number }[] }[]) => {
        if (layers.length === 0) {
            setNotification("Aucune couche de points trouvée dans le fichier.", "info");
            return;
        }
        let lastNewParcelId: number | null = null;
        let totalPoints = 0;
        
        layers.forEach(layer => {
            if (layer.points.length > 0) {
                // Use layer name or default name
                const parcelName = layer.layerName.trim() || `Couche importée`;
                const newParcel = parcelManager.addParcel(parcelName, layer.points);
                lastNewParcelId = newParcel.id;
                totalPoints += layer.points.length;
            }
        });

        if (lastNewParcelId) {
            setActiveParcelId(lastNewParcelId);
        }
        setNotification(`${layers.length} couche(s) importée(s) avec succès (${totalPoints} points).`, 'success');
    };

    return (
        <div className={`bsport-card flex flex-col h-full ${compact ? 'p-3 space-y-3' : 'p-5 space-y-5'}`}>
            <div className="flex justify-between items-center flex-shrink-0">
                <h3 className="text-[15px] font-bold text-[#0F172A] dark:text-white">Données de la Parcelle</h3>
                <HistoryControls onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} />
            </div>
            
            <div className="overflow-y-auto pr-2 flex-grow space-y-5">
                {/* Input Section */}
                <div className="bg-[#F8FAFC] dark:bg-[#1E293B] p-4 rounded-xl border border-[#E2E8F0] dark:border-[#334155]">
                    <CoordinateInput onAddPoint={addPoint} settings={settings} setNotification={setNotification} />
                </div>

                {/* List Section */}
                <div className="border-t border-[#E2E8F0] dark:border-[#334155] pt-4">
                    <PointList
                        points={points}
                        onDeletePoint={deletePoint}
                        onClearPoints={clearPoints}
                        movePoint={movePoint}
                        onUpdatePoint={updatePoint}
                        settings={settings}
                        highlightedPointId={highlightedPointId}
                        setHighlightedPointId={setHighlightedPointId}
                    />
                </div>

                {/* Import Actions */}
                <div className="grid grid-cols-2 gap-3">
                    <CSVImporter onImport={addPoints} setNotification={setNotification} />
                    <MultiModalImporter 
                        onImport={addPoints} 
                        onImportLayers={handleImportLayers} 
                        setNotification={setNotification} 
                    />
                </div>

                 {showResults && results && (
                    <div className="border-t border-[#E2E8F0] dark:border-[#334155] pt-5">
                        <ResultsDisplay results={results} settings={settings} points={points} />
                    </div>
                )}
                
                 {showExports && points.length > 0 && (
                    <div className="border-t border-[#E2E8F0] dark:border-[#334155] pt-5 space-y-4">
                        <h3 className="bsport-label">Exports & Rapports</h3>
                        
                        {onOpenBornageSketch && (
                            <button
                                onClick={onOpenBornageSketch}
                                disabled={points.length === 0}
                                className="bsport-btn-primary w-full"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                    <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                                </svg>
                                <span>Croquis de Bornage</span>
                            </button>
                        )}

                        <ExportButton points={points} results={results} settings={settings} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default PointManagementPanel;
