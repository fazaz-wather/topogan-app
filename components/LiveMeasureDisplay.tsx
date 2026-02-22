
import React from 'react';
import { AppSettings } from '../types';
import { convertDistance, getDistanceUnitLabel, formatArea } from '../services/unitConversionService';
import { convertDecimalDegreesToDMS } from '../services/topographyService';

interface LiveMeasureDisplayProps {
    data: {
        totalDistance?: number;
        segmentDistance?: number;
        perimeter?: number;
        area?: number;
        angle?: number;
    } | null;
    settings: AppSettings;
}

const LiveMeasureDisplay: React.FC<LiveMeasureDisplayProps> = ({ data, settings }) => {
    if (!data) return null;

    const { distanceUnit, areaUnit, precision } = settings;
    const distLabel = getDistanceUnitLabel(distanceUnit);

    const formatDist = (d: number) => `${convertDistance(d, distanceUnit).toFixed(precision)} ${distLabel}`;

    const items: { label: string; value: string; icon?: React.ReactNode }[] = [];

    if (data.angle !== undefined) {
        items.push({ 
            label: "Inclinaison", 
            value: `${data.angle.toFixed(4)}°`,
            icon: <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
        });
        items.push({ label: "Format DMS", value: convertDecimalDegreesToDMS(data.angle) });
    } else if (data.perimeter !== undefined && data.area !== undefined) {
        items.push({ 
            label: "Périmètre", 
            value: formatDist(data.perimeter),
            icon: <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v16h16V4H4z" /></svg>
        });
        items.push({ 
            label: "Contenance", 
            value: formatArea(data.area, areaUnit, precision),
            icon: <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
        });
    } else if (data.totalDistance !== undefined && data.segmentDistance !== undefined) {
        items.push({ label: "Section", value: formatDist(data.segmentDistance) });
        items.push({ 
            label: "Linéaire Total", 
            value: formatDist(data.totalDistance),
            icon: <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
        });
    } else if (data.segmentDistance !== undefined) {
        items.push({ label: "Distance", value: formatDist(data.segmentDistance) });
    }

    if (items.length === 0) return null;

    return (
        <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 z-[400] transition-all duration-500 ease-out">
            <div className="flex items-center bg-gray-900/85 backdrop-blur-xl text-white rounded-2xl px-6 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-white/10 space-x-8">
                {items.map((item, index) => (
                    <div key={index} className="flex flex-col items-center min-w-[100px] relative group">
                        <div className="flex items-center gap-1.5 mb-1 text-blue-400 dark:text-blue-300">
                            {item.icon}
                            <span className="text-[9px] uppercase font-black tracking-[0.15em] opacity-70 group-hover:opacity-100 transition-opacity">{item.label}</span>
                        </div>
                        <span className="text-sm font-mono font-black whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            {item.value}
                        </span>
                        {index < items.length - 1 && (
                            <div className="absolute -right-4 top-1/2 -translate-y-1/2 h-6 w-px bg-white/10"></div>
                        )}
                    </div>
                ))}
            </div>
            {/* Visual indicator bar at the bottom */}
            <div className="h-1.5 w-32 bg-blue-600 mx-auto rounded-b-full shadow-lg shadow-blue-600/20"></div>
        </div>
    );
};

export default LiveMeasureDisplay;
