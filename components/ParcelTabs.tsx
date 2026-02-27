import React, { useState } from 'react';
import { Parcel } from '../types';
import { useParcels } from '../hooks/useParcels';

interface ParcelTabsProps {
  parcels: Parcel[];
  activeParcelId: number | null;
  setActiveParcelId: (id: number | null) => void;
  parcelManager: ReturnType<typeof useParcels>;
}

const ParcelTabs: React.FC<ParcelTabsProps> = ({ parcels, activeParcelId, setActiveParcelId, parcelManager }) => {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');

    const handleRename = (parcel: Parcel) => {
        setEditingId(parcel.id);
        setEditingName(parcel.name);
    };

    const handleSaveRename = (parcelId: number) => {
        if (editingName.trim()) {
            parcelManager.updateParcel(parcelId, { name: editingName.trim() });
        }
        setEditingId(null);
    };

    const handleAddParcel = () => {
        const newParcel = parcelManager.addParcel();
        setActiveParcelId(newParcel.id);
        handleRename(newParcel);
    };

    return (
        <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2 overflow-x-auto p-1">
                {parcels.map(parcel => (
                    <div
                        key={parcel.id}
                        onClick={() => setActiveParcelId(parcel.id)}
                        onDoubleClick={() => handleRename(parcel)}
                        className={`group relative flex-shrink-0 flex items-center px-3 py-2 text-sm font-medium rounded-t-lg cursor-pointer border-b-2 transition-colors
                            ${activeParcelId === parcel.id 
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
                            }`}
                    >
                        <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: parcel.color }}></span>
                        {editingId === parcel.id ? (
                            <input 
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onBlur={() => handleSaveRename(parcel.id)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(parcel.id)}
                                autoFocus
                                className="bg-transparent outline-none ring-1 ring-blue-500 rounded px-1 -mx-1"
                            />
                        ) : (
                            <span className="truncate max-w-[100px]">{parcel.name}</span>
                        )}
                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                if (parcels.length > 1) {
                                    parcelManager.deleteParcel(parcel.id); 
                                    if (activeParcelId === parcel.id) {
                                        const remaining = parcels.filter(p => p.id !== parcel.id);
                                        setActiveParcelId(remaining[0].id);
                                    }
                                } else {
                                    parcelManager.deleteParcel(parcel.id); // Will trigger error notification
                                }
                            }}
                            className="ml-2 p-0.5 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Supprimer la parcelle"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                ))}
                <button
                    onClick={handleAddParcel}
                    className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                    title="Ajouter une nouvelle parcelle"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                </button>
            </div>
        </div>
    );
};

export default ParcelTabs;