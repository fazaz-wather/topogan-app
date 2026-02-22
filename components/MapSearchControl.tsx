
import React from 'react';
import { Parcel } from '../types';

interface MapSearchControlProps {
    activeParcel?: Parcel;
    onParcelClick?: () => void;
    onStartBornage?: () => void;
    showBornageButton?: boolean;
}

const MapSearchControl: React.FC<MapSearchControlProps> = ({ 
    activeParcel, 
    onParcelClick, 
    onStartBornage, 
    showBornageButton 
}) => {
    // Si rien à afficher, ne rien rendre pour ne pas bloquer les événements souris
    if (!activeParcel && !showBornageButton) return null;

    return (
        <div className="absolute top-4 left-4 z-[401] pointer-events-none flex flex-col sm:flex-row items-start sm:items-center gap-2">
            
            {/* Carte Parcelle Active - Version Minimisée */}
            {activeParcel && (
                <button 
                    onClick={onParcelClick}
                    className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-lg shadow-md border border-white/20 dark:border-gray-700/50 pointer-events-auto flex items-center p-1.5 pr-3 gap-2 hover:scale-105 transition-transform max-w-[160px] group"
                    title="Centrer sur la parcelle"
                >
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shadow-sm flex-shrink-0" style={{ backgroundColor: activeParcel.color }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <div className="text-left overflow-hidden min-w-0">
                        <p className="text-[9px] uppercase font-bold text-gray-400 dark:text-gray-500 leading-none mb-0.5">Active</p>
                        <p className="text-[11px] font-bold text-gray-800 dark:text-white truncate group-hover:text-blue-600 transition-colors">{activeParcel.name}</p>
                    </div>
                </button>
            )}

            {/* Bouton Commencer le Bornage - Version Minimisée */}
            {showBornageButton && (
                <button 
                    onClick={onStartBornage}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg shadow-md pointer-events-auto flex items-center p-1.5 pr-3 gap-2 hover:scale-105 transition-transform border border-white/20"
                    title="Démarrer l'ajout de bornes"
                >
                    <div className="w-6 h-6 bg-white/20 rounded-md flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                    </div>
                    <div className="text-left">
                        <p className="text-[9px] uppercase font-bold text-green-100 leading-none mb-0.5">Mode</p>
                        <p className="text-[11px] font-black uppercase tracking-wide">Bornage</p>
                    </div>
                </button>
            )}
        </div>
    );
};

export default MapSearchControl;
