
import React, { useMemo, useState } from 'react';
import { Parcel, AppSettings } from '../types';
import { calculatePolygonArea, calculateDistances } from '../services/topographyService';
import { formatArea, convertDistance, getDistanceUnitLabel } from '../services/unitConversionService';
import PhotoCaptureModal from './PhotoCaptureModal';

interface ParcelDetailsModalProps {
    parcel: Parcel;
    settings: AppSettings;
    onClose: () => void;
    parcelManager?: any;
}

const DetailRow: React.FC<{ label: string; value: string | number | undefined; isHighlight?: boolean }> = ({ label, value, isHighlight }) => {
    if (!value && value !== 0) return null;
    return (
        <div className={`flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0 ${isHighlight ? 'bg-blue-50 dark:bg-blue-900/20 px-2 rounded' : ''}`}>
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</span>
            <span className={`text-sm font-semibold ${isHighlight ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`}>{value}</span>
        </div>
    );
};

const ParcelDetailsModal: React.FC<ParcelDetailsModalProps> = ({ parcel, settings, onClose, parcelManager }) => {
    const [photoTargetPointId, setPhotoTargetPointId] = useState<number | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const { area, perimeter } = useMemo(() => {
        if (parcel.points.length < 3) return { area: 0, perimeter: 0 };
        const calculatedArea = calculatePolygonArea(parcel.points, settings.coordinateSystem);
        const distances = calculateDistances(parcel.points, settings.coordinateSystem);
        const calculatedPerimeter = distances.reduce((acc, curr) => acc + curr.distance, 0);
        return { area: calculatedArea, perimeter: calculatedPerimeter };
    }, [parcel, settings.coordinateSystem]);

    const formattedArea = formatArea(area, settings.areaUnit, settings.precision);
    const formattedPerimeter = `${convertDistance(perimeter, settings.distanceUnit).toFixed(settings.precision)} ${getDistanceUnitLabel(settings.distanceUnit)}`;

    const handlePhotoSave = (photoData: string) => {
        if (photoTargetPointId !== null && parcelManager) {
            parcelManager.updatePoint(parcel.id, photoTargetPointId, { image: photoData });
        }
        setPhotoTargetPointId(null);
    };

    const handleDeletePhoto = (pointId: number) => {
        if (parcelManager && window.confirm("Supprimer la photo de ce sommet ?")) {
            parcelManager.updatePoint(parcel.id, pointId, { image: undefined });
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[2000] p-4 animate-fade-in" onClick={onClose}>
            <div 
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" 
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with Color */}
                <div className="relative h-24 flex-shrink-0">
                    <div className="absolute inset-0 opacity-20" style={{ backgroundColor: parcel.color }}></div>
                    <div className="absolute -bottom-8 left-6">
                        <div className="h-16 w-16 rounded-xl shadow-lg flex items-center justify-center bg-white dark:bg-gray-700 border-4 border-white dark:border-gray-800">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" style={{ color: parcel.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="absolute top-2 right-2 p-2 bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 rounded-full backdrop-blur-sm transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700 dark:text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                <div className="pt-10 px-6 pb-6 overflow-y-auto">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{parcel.name}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">ID: {parcel.id}</p>

                    <div className="space-y-6">
                        {/* Section Géométrique */}
                        <div>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Géométrie</h3>
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                                <DetailRow label="Contenance (Surface)" value={formattedArea} isHighlight />
                                <DetailRow label="Périmètre" value={formattedPerimeter} />
                                <DetailRow label="Nombre de sommets" value={parcel.points.length} />
                            </div>
                        </div>

                        {/* Section Foncière (si données disponibles) */}
                        {(parcel.propriete || parcel.titre || parcel.requisition || parcel.situation) && (
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Information Foncière</h3>
                                <div className="space-y-1">
                                    <DetailRow label="Propriété dite" value={parcel.propriete} />
                                    <DetailRow label="Titre Foncier" value={parcel.titre} />
                                    <DetailRow label="Réquisition" value={parcel.requisition} />
                                    <DetailRow label="Situation" value={parcel.situation} />
                                    <DetailRow label="Nature" value={parcel.nature} />
                                    <DetailRow label="Consistance" value={parcel.consistance} />
                                </div>
                            </div>
                        )}

                        {/* Section Technique */}
                        {(parcel.surveyor || parcel.date) && (
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Données Techniques</h3>
                                <div className="space-y-1">
                                    <DetailRow label="Arpenteur" value={parcel.surveyor} />
                                    <DetailRow label="Date de levé" value={parcel.date} />
                                </div>
                            </div>
                        )}

                        {/* Galerie des Sommets */}
                        {parcel.points.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Galerie des Bornes</h3>
                                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                                    {parcel.points.map((point, index) => (
                                        <div key={point.id} className="relative group bg-gray-50 dark:bg-gray-700/50 rounded p-1 border border-gray-200 dark:border-gray-600 flex flex-col items-center">
                                            <div className="w-full aspect-square bg-gray-200 dark:bg-gray-700 rounded mb-1 overflow-hidden flex items-center justify-center relative">
                                                {point.image ? (
                                                    <>
                                                        <img 
                                                            src={point.image.startsWith('data:') ? point.image : `data:image/jpeg;base64,${point.image}`} 
                                                            alt={`B${index + 1}`} 
                                                            className="w-full h-full object-cover cursor-pointer"
                                                            onClick={() => setPreviewImage(point.image!.startsWith('data:') ? point.image! : `data:image/jpeg;base64,${point.image}`)}
                                                        />
                                                        {parcelManager && (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleDeletePhoto(point.id); }}
                                                                className="absolute top-0 right-0 bg-red-500 text-white rounded-bl-md p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                title="Supprimer"
                                                            >
                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                        )}
                                                    </>
                                                ) : (
                                                    parcelManager ? (
                                                        <button 
                                                            onClick={() => setPhotoTargetPointId(point.id)}
                                                            className="text-gray-400 hover:text-blue-500 transition-colors flex flex-col items-center justify-center w-full h-full"
                                                            title="Ajouter photo"
                                                        >
                                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs">No img</span>
                                                    )
                                                )}
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">B{index + 1}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        Fermer
                    </button>
                </div>
            </div>

            {/* Nested Modals */}
            {photoTargetPointId !== null && (
                <PhotoCaptureModal 
                    onCapture={handlePhotoSave} 
                    onClose={() => setPhotoTargetPointId(null)} 
                />
            )}
            {previewImage && (
                <div 
                    className="fixed inset-0 z-[1200] bg-black/90 flex items-center justify-center p-4 cursor-pointer"
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

export default ParcelDetailsModal;
