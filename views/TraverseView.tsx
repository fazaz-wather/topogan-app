import React from 'react';
import { Point, AppSettings, Notification, Annotation, Parcel } from '../types';
import { usePointsManager } from '../hooks/usePointsManager';
import CompensatedTraverseCalculator from '../components/CompensatedTraverseCalculator';
import StandardViewLayout from '../components/StandardViewLayout';
import { useParcels } from '../hooks/useParcels';

interface TraverseViewProps {
  parcels: Parcel[];
  activeParcelId: number | null;
  setActiveParcelId: (id: number | null) => void;
  parcelManager: ReturnType<typeof useParcels>;
  points: Point[];
  setPoints: (action: React.SetStateAction<Point[]>) => void;
  annotations: Annotation[];
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
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

const TraverseView: React.FC<TraverseViewProps> = (props) => {
  const { points, setPoints, settings, setNotification, getNextPointId } = props;
  
  const { addPoints } = usePointsManager(setPoints, setNotification, getNextPointId);

  const isWGS84 = settings.coordinateSystem === 'wgs84';

  return (
    <StandardViewLayout {...props}>
        <div className="h-full overflow-y-auto">
            {isWGS84 ? (
                <div className="flex items-center justify-center h-full">
                    <div className="p-4 my-2 text-sm text-center text-yellow-800 bg-yellow-100 dark:text-yellow-200 dark:bg-yellow-900/50 rounded-lg border border-yellow-300 dark:border-yellow-700 max-w-lg">
                        <h3 className="font-bold text-base mb-2">Fonctionnalité non disponible pour WGS84</h3>
                        <p>L'outil "Cheminement" est conçu pour la topographie plane et n'est pas compatible avec le système de coordonnées WGS84. Veuillez sélectionner un système projeté (Local ou Lambert) dans les paramètres pour utiliser cet outil.</p>
                    </div>
                </div>
            ) : (
                <CompensatedTraverseCalculator 
                    points={points}
                    settings={settings}
                    onAddPoints={addPoints}
                    setNotification={setNotification}
                />
            )}
        </div>
    </StandardViewLayout>
  );
};

export default TraverseView;