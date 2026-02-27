
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
          <div className="p-4 bg-[#4F46E5]/10 rounded-xl border border-[#4F46E5]/20">
              <div className="text-[11px] font-bold text-[#4F46E5] uppercase tracking-wider mb-1">Surface Totale</div>
              <div className="text-2xl font-black text-[#4F46E5]">{formattedArea}</div>
          </div>
          <div className="p-4 bg-[#F1F5F9] dark:bg-[#1E293B] rounded-xl border border-[#E2E8F0] dark:border-[#334155]">
              <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Nb. Sommets</div>
              <div className="text-2xl font-black text-[#0F172A] dark:text-white">{points.length}</div>
          </div>
      </div>

      {/* Table des Distances */}
      <div>
        <h4 className="text-[15px] font-bold text-[#0F172A] dark:text-white mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            Tableau des Distances
        </h4>
        <div className="overflow-hidden border border-[#E2E8F0] dark:border-[#334155] rounded-xl">
            <table className="min-w-full divide-y divide-[#E2E8F0] dark:divide-[#334155]">
                <thead className="bg-[#F8FAFC] dark:bg-[#1E293B]">
                    <tr>
                        <th scope="col" className="px-4 py-3 text-left text-[11px] font-bold text-[#64748B] uppercase tracking-wider">De</th>
                        <th scope="col" className="px-4 py-3 text-left text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Vers</th>
                        <th scope="col" className="px-4 py-3 text-right text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Distance ({getDistanceUnitLabel(distanceUnit)})</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-[#0F172A] divide-y divide-[#E2E8F0] dark:divide-[#334155]">
                    {results.distances.map((dist, index) => {
                        const displayedDistance = convertDistance(dist.distance, distanceUnit);
                        return (
                            <tr key={index} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/50 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-[#0F172A] dark:text-white">
                                    B{getPointIndexLabel(dist.from)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-[#64748B] dark:text-[#94A3B8]">
                                    B{getPointIndexLabel(dist.to)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-mono font-bold text-[#4F46E5]">
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
