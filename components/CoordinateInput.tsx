
import React, { useState, FormEvent, useMemo } from 'react';
import { AppSettings, Notification } from '../types';

interface CoordinateInputProps {
  onAddPoint: (point: { x: number; y: number }) => void;
  settings: AppSettings;
  setNotification: (message: string, type: Notification['type']) => void;
}

const CoordinateInput: React.FC<CoordinateInputProps> = ({ onAddPoint, settings, setNotification }) => {
  const [x, setX] = useState('');
  const [y, setY] = useState('');

  const labels = useMemo(() => {
    switch (settings.coordinateSystem) {
      case 'wgs84':
        return { x: 'Longitude', y: 'Latitude', xPlaceholder: 'e.g., -71.208', yPlaceholder: 'e.g., 46.813' };
      case 'lambert_z1':
      case 'lambert_z2':
      case 'lambert_z3':
      case 'lambert_z4':
        return { x: 'X (Est)', y: 'Y (Nord)', xPlaceholder: 'e.g., 500000', yPlaceholder: 'e.g., 300000' };
      default:
        return { x: 'Coordonnée X', y: 'Coordonnée Y', xPlaceholder: 'e.g., 123.45', yPlaceholder: 'e.g., 67.89' };
    }
  }, [settings.coordinateSystem]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const xVal = parseFloat(x);
    const yVal = parseFloat(y);
    if (!isNaN(xVal) && !isNaN(yVal)) {
      onAddPoint({ x: xVal, y: yVal });
      setX('');
      setY('');
    } else {
        setNotification(`Veuillez entrer des valeurs numériques valides pour ${labels.x} et ${labels.y}.`, 'error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <label htmlFor="x-coord" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{labels.x}</label>
          <input
            id="x-coord"
            type="number"
            step="any"
            value={x}
            onChange={(e) => setX(e.target.value)}
            placeholder={labels.xPlaceholder}
            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            required
          />
        </div>
        <div className="flex-1">
          <label htmlFor="y-coord" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{labels.y}</label>
          <input
            id="y-coord"
            type="number"
            step="any"
            value={y}
            onChange={(e) => setY(e.target.value)}
            placeholder={labels.yPlaceholder}
            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            required
          />
        </div>
      </div>
      <button 
        type="submit" 
        className="w-full bg-[#3F3356] text-white font-bold py-3 px-6 rounded-full hover:bg-[#2a223a] shadow-lg transform active:scale-95 transition-all duration-200 flex items-center justify-center space-x-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        <span>Ajouter un Sommet</span>
      </button>
    </form>
  );
};

export default CoordinateInput;
