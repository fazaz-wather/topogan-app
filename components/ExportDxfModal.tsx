
import React, { useState } from 'react';

interface ExportDxfModalProps {
  onClose: () => void;
  onExport: (filename: string, precision: number) => void;
  defaultPrecision: number;
}

const ExportDxfModal: React.FC<ExportDxfModalProps> = ({ onClose, onExport, defaultPrecision }) => {
  const [filename, setFilename] = useState('plan-topogan.dxf');
  const [precision, setPrecision] = useState(defaultPrecision);

  const handleExportClick = () => {
    if (filename.trim()) {
      onExport(filename.trim(), precision);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[2000]" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 m-4 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4 flex-shrink-0">Exporter le Plan en DXF</h2>
        <div className="overflow-y-auto pr-2 -mr-2 max-h-[70vh]">
            <div className="space-y-4">
            <div>
                <label htmlFor="filename" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nom du fichier</label>
                <input
                id="filename"
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
                />
            </div>
            <div>
                <label htmlFor="precision" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Précision des coordonnées</label>
                <select
                id="precision"
                value={precision}
                onChange={(e) => setPrecision(parseInt(e.target.value, 10))}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"
                >
                {[2, 3, 4, 5, 6, 7, 8].map(p => <option key={p} value={p}>{p} décimales</option>)}
                </select>
            </div>
            </div>
        </div>
        <div className="flex justify-end space-x-3 pt-6 mt-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Annuler</button>
          <button type="button" onClick={handleExportClick} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700">Exporter</button>
        </div>
      </div>
    </div>
  );
};

export default ExportDxfModal;
