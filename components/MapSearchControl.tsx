
import React from 'react';
import { Parcel } from '../types';

interface MapSearchControlProps {
    onOpenGoTo?: () => void;
    onStartBornage?: () => void;
    showBornageButton?: boolean;
}

const MapSearchControl: React.FC<MapSearchControlProps> = ({ 
    onOpenGoTo,
    onStartBornage, 
    showBornageButton 
}) => {
    // Si rien à afficher, ne rien rendre pour ne pas bloquer les événements souris
    if (!onOpenGoTo && !showBornageButton) return null;

    return (
        <div className="absolute top-4 left-4 z-[401] pointer-events-none flex flex-col sm:flex-row items-start sm:items-center gap-2">
            
            {/* Bouton Aller à */}
            {onOpenGoTo && (
                <button 
                    onClick={onOpenGoTo}
                    className="bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-xl rounded-xl shadow-md border border-[#F1F5F9] dark:border-[#1E293B] pointer-events-auto flex items-center p-2 pr-4 gap-3 hover:scale-105 transition-transform max-w-[160px] group"
                    title="Aller à des coordonnées"
                >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 bg-[#EEF2FF] dark:bg-[#4F46E5]/20">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#4F46E5] dark:text-[#818CF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <div className="text-left overflow-hidden min-w-0">
                        <p className="text-[10px] uppercase font-bold text-[#94A3B8] dark:text-[#64748B] leading-none mb-1 tracking-wider">Recherche</p>
                        <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate group-hover:text-[#4F46E5] dark:group-hover:text-[#818CF8] transition-colors">Aller à...</p>
                    </div>
                </button>
            )}

            {/* Bouton Commencer le Bornage - Version Minimisée */}
            {showBornageButton && (
                <button 
                    onClick={onStartBornage}
                    className="bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#34D399] hover:to-[#10B981] text-white rounded-xl shadow-md pointer-events-auto flex items-center p-2 pr-4 gap-3 hover:scale-105 transition-transform border border-white/20"
                    title="Démarrer l'ajout de bornes"
                >
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] uppercase font-bold text-[#D1FAE5] leading-none mb-1 tracking-wider">Mode</p>
                        <p className="text-xs font-black uppercase tracking-widest">Bornage</p>
                    </div>
                </button>
            )}
        </div>
    );
};

export default MapSearchControl;
