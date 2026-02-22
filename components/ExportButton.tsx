import React, { useCallback } from 'react';
import { Point, CalculationResults, AppSettings } from '../types';
import { exportSurfaceDataToCSV, exportPointsToCSV } from '../services/exportService';

interface ExportButtonProps {
    points: Point[];
    results: CalculationResults | null;
    settings: AppSettings;
}

const ExportButton: React.FC<ExportButtonProps> = ({ points, results, settings }) => {
    const handleExport = useCallback(() => {
        if (results && points.length >= 2) {
            exportSurfaceDataToCSV(points, results, settings);
        } else if (points.length > 0) {
            exportPointsToCSV(points, settings);
        } else {
            alert("Il n'y a pas de données à exporter.");
        }
    }, [points, results, settings]);

    const buttonLabel = results ? 'Exporter résultats' : 'Exporter points';

    return (
        <button
            onClick={handleExport}
            disabled={points.length === 0}
            className="w-full bg-green-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-700 transition duration-200 flex items-center justify-center space-x-2 disabled:bg-gray-400 dark:disabled:bg-gray-600"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
               <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            <span>{buttonLabel}</span>
        </button>
    );
};

export default ExportButton;