import React from 'react';
import { Parcel, AppSettings, CalculationResults } from '../types';
import { formatArea } from '../services/unitConversionService';

interface ActiveParcelInfoPanelProps {
    parcel: Parcel | null;
    results: CalculationResults | null;
    settings: AppSettings;
    onClose?: () => void;
    onOpenDetails?: () => void;
}

const ActiveParcelInfoPanel: React.FC<ActiveParcelInfoPanelProps> = ({ parcel, results, settings, onClose, onOpenDetails }) => {
    if (!parcel) return null;

    const perimeter = results?.distances.reduce((sum, d) => sum + d.distance, 0) || 0;
    const area = results?.area || 0;

    return (
        <div className="absolute top-20 left-4 z-[400] pointer-events-auto w-64 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md rounded-2xl shadow-xl border border-[#F1F5F9] dark:border-[#1E293B] overflow-hidden transition-all duration-300">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#F1F5F9] dark:border-[#1E293B] bg-[#F8FAFC]/50 dark:bg-[#1E293B]/50">
                <div className="flex items-center gap-3 overflow-hidden">
                    <span 
                        className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" 
                        style={{ backgroundColor: parcel.color }}
                    ></span>
                    <h3 className="text-sm font-bold text-[#0F172A] dark:text-white truncate">
                        {parcel.name}
                    </h3>
                </div>
                {onClose && (
                    <button 
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#475569] hover:bg-[#F1F5F9] dark:hover:text-[#CBD5E1] dark:hover:bg-[#334155] transition-colors"
                        title="Fermer"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>
            
            <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#F8FAFC] dark:bg-[#1E293B]/50 p-3 rounded-xl border border-[#F1F5F9] dark:border-[#334155]/50">
                        <p className="text-[10px] uppercase font-bold text-[#64748B] dark:text-[#94A3B8] mb-1 tracking-wider">Superficie</p>
                        <p className="text-sm font-bold text-[#4F46E5] dark:text-[#818CF8] truncate" title={formatArea(area, settings.areaUnit, settings.precision)}>
                            {formatArea(area, settings.areaUnit, settings.precision)}
                        </p>
                    </div>
                    <div className="bg-[#F8FAFC] dark:bg-[#1E293B]/50 p-3 rounded-xl border border-[#F1F5F9] dark:border-[#334155]/50">
                        <p className="text-[10px] uppercase font-bold text-[#64748B] dark:text-[#94A3B8] mb-1 tracking-wider">Périmètre</p>
                        <p className="text-sm font-bold text-[#10B981] dark:text-[#34D399] truncate">
                            {perimeter.toFixed(settings.precision)} m
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[#475569] dark:text-[#CBD5E1] bg-[#F8FAFC] dark:bg-[#1E293B]/50 p-3 rounded-xl border border-[#F1F5F9] dark:border-[#334155]/50">
                    <span className="font-semibold">Nombre de bornes</span>
                    <span className="font-bold bg-[#E2E8F0] dark:bg-[#334155] px-2.5 py-1 rounded-lg text-[#0F172A] dark:text-white">
                        {parcel.points.length}
                    </span>
                </div>

                {onOpenDetails && (
                    <button 
                        onClick={onOpenDetails}
                        className="w-full mt-3 py-2.5 px-4 bg-[#EEF2FF] hover:bg-[#E0E7FF] dark:bg-[#4F46E5]/10 dark:hover:bg-[#4F46E5]/20 text-[#4F46E5] dark:text-[#818CF8] text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 border border-[#E0E7FF] dark:border-[#4F46E5]/30"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Plus de détails
                    </button>
                )}
            </div>
        </div>
    );
};

export default ActiveParcelInfoPanel;
