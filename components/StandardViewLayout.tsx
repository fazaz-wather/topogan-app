
import React from 'react';
import { Point, AppSettings, Notification, Parcel } from '../types';
import PointManagementPanel from './PointManagementPanel';
import { useParcels } from '../hooks/useParcels';

interface StandardViewLayoutProps {
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
    children: React.ReactNode;
    getNextPointId: () => number;
}

const StandardViewLayout: React.FC<StandardViewLayoutProps> = (props) => {
    const { children, ...pointManagementProps } = props;
    
    return (
        <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 scroll-smooth">
            <div className="flex flex-col lg:flex-row gap-6 h-full lg:h-auto min-h-full">
                {/* Panneau Latéral (Gestion des points) */}
                {/* Sur mobile : Ordre normal. Sur Desktop : Fixe à gauche ou 1/3 largeur */}
                <div className="w-full lg:w-1/3 xl:w-1/4 lg:flex-shrink-0 flex flex-col">
                    <div className="lg:sticky lg:top-0 h-full">
                        <PointManagementPanel 
                            {...pointManagementProps} 
                            compact={true} // Mode compact pour gagner de la place
                            showResults={false} // On masque les résultats rapides ici pour éviter la redondance
                            showExports={false}
                        />
                    </div>
                </div>

                {/* Contenu Principal (Outils de calcul) */}
                <div className="w-full lg:w-2/3 xl:w-3/4 flex flex-col">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-full">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StandardViewLayout;
