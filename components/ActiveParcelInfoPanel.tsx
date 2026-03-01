import React, { useState } from 'react';
import { Parcel, AppSettings, CalculationResults } from '../types';
import { formatArea } from '../services/unitConversionService';
import PhotoCaptureModal from './PhotoCaptureModal';

interface ActiveParcelInfoPanelProps {
    parcel: Parcel | null;
    results: CalculationResults | null;
    settings: AppSettings;
    onClose?: () => void;
    onOpenDetails?: () => void;
    onUpdateParcel?: (updates: Partial<Parcel>) => void;
}

const ActiveParcelInfoPanel: React.FC<ActiveParcelInfoPanelProps> = ({ parcel, results, settings, onClose, onOpenDetails, onUpdateParcel }) => {
    const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    if (!parcel) return null;

    const perimeter = results?.distances.reduce((sum, d) => sum + d.distance, 0) || 0;
    const area = results?.area || 0;

    const handlePhotoSave = (photoData: string) => {
        if (onUpdateParcel) {
            onUpdateParcel({ image: photoData });
        }
        setIsCapturingPhoto(false);
    };

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
                {/* Photo Section */}
                <div className="relative w-full aspect-video bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 group">
                    {parcel.image ? (
                        <>
                            <img 
                                src={parcel.image.startsWith('data:') ? parcel.image : `data:image/jpeg;base64,${parcel.image}`} 
                                alt="Parcel Cover" 
                                className="w-full h-full object-cover cursor-pointer"
                                onClick={() => setPreviewImage(parcel.image!.startsWith('data:') ? parcel.image! : `data:image/jpeg;base64,${parcel.image}`)}
                            />
                            {onUpdateParcel && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); if(window.confirm("Supprimer la photo ?")) onUpdateParcel({ image: undefined }); }}
                                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                    title="Supprimer la photo"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            )}
                        </>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-[10px] font-medium">Aucune photo</span>
                        </div>
                    )}
                    
                    {onUpdateParcel && (
                        <button 
                            onClick={() => setIsCapturingPhoto(true)}
                            className="absolute bottom-2 right-2 p-2 bg-white dark:bg-[#1E293B] text-[#4F46E5] dark:text-[#818CF8] rounded-lg shadow-lg hover:bg-gray-50 dark:hover:bg-[#334155] transition-colors border border-gray-100 dark:border-gray-700"
                            title={parcel.image ? "Changer la photo" : "Ajouter une photo"}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    )}
                </div>

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

            {isCapturingPhoto && (
                <PhotoCaptureModal 
                    onCapture={handlePhotoSave} 
                    onClose={() => setIsCapturingPhoto(false)} 
                />
            )}

            {previewImage && (
                <div 
                    className="fixed inset-0 z-[2000] bg-black/90 flex items-center justify-center p-4 cursor-pointer"
                    onClick={() => setPreviewImage(null)}
                >
                    <img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg" />
                    <button className="absolute top-4 right-4 text-white p-2">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}
        </div>
    );
};

export default ActiveParcelInfoPanel;
