
import React from 'react';
import { CalculationResults, AppSettings, Point } from '../types';
import { formatArea, convertDistance, getDistanceUnitLabel } from '../services/unitConversionService';

interface ResultsDisplayProps {
  results: CalculationResults;
  settings: AppSettings;
  points: Point[];
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results, settings, points }) => {
  const { precision, distanceUnit, areaUnit } = settings;
  
  const formattedArea = formatArea(results.area, areaUnit, precision);

  const getPointIndexLabel = (pointId: number) => {
    const index = points.findIndex(p => p.id === pointId);
    return index !== -1 ? `${index + 1}` : `?`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800">
              <div className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">Surface Totale</div>
              <div className="text-2xl font-black text-blue-800 dark:text-blue-100">{formattedArea}</div>
          </div>
          <div className="p-4 bg-gray-50/50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-600">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nb. Sommets</div>
              <div className="text-2xl font-black text-gray-800 dark:text-gray-100">{points.length}</div>
          </div>
      </div>

      {/* Table des Distances */}
      <div>
        <h4 className="text-sm font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            Tableau des Distances
        </h4>
        <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">De</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vers</th>
                        <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Distance ({getDistanceUnitLabel(distanceUnit)})</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {results.distances.map((dist, index) => {
                        const displayedDistance = convertDistance(dist.distance, distanceUnit);
                        return (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                    B{getPointIndexLabel(dist.from)}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    B{getPointIndexLabel(dist.to)}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap text-sm text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                                    {displayedDistance.toFixed(precision)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default ResultsDisplay;
