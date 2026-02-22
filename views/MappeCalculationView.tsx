import React, { useState } from 'react';
import { AppSettings, Notification } from '../types';
import { calculateMappe } from '../services/mappeService';

interface MappeCalculationViewProps {
    settings: AppSettings;
    setNotification: (message: string, type: Notification['type']) => void;
    // Props standards passées par App.tsx mais non utilisées directement ici
    [key: string]: any;
}

const MappeCalculationView: React.FC<MappeCalculationViewProps> = ({ settings, setNotification, ...props }) => {
    const [x, setX] = useState<string>('121000');
    const [y, setY] = useState<string>('380000');
    const [scale, setScale] = useState<string>('1/2000');
    const [result, setResult] = useState<string>('');

    const handleCalculate = () => {
        const xVal = parseFloat(x);
        const yVal = parseFloat(y);

        if (isNaN(xVal) || isNaN(yVal)) {
            setNotification("Veuillez entrer des coordonnées valides.", "error");
            return;
        }

        const calculated = calculateMappe(xVal, yVal, scale as any);
        setResult(calculated);
    };

    const handleClear = () => {
        setX('');
        setY('');
        setResult('');
    };

    return (
        <div className="h-full bg-[#111111] text-white flex flex-col items-center pt-10 px-4 overflow-y-auto font-sans">
            <h2 className="text-xl font-bold text-gray-200 mb-8 self-start w-full max-w-md mx-auto">Détermination de mappe</h2>

            <div className="w-full max-w-md space-y-6">
                <h3 className="text-gray-300 font-semibold mb-4">Tapez les coordonnées :</h3>

                <div className="relative border border-gray-600 rounded p-4">
                    <label className="absolute -top-3 left-3 bg-[#111111] px-1 text-gray-400 text-sm">XA</label>
                    <input 
                        type="number" 
                        value={x}
                        onChange={(e) => setX(e.target.value)}
                        className="w-full bg-transparent text-white text-lg outline-none font-mono"
                        placeholder="0.00"
                    />
                </div>

                <div className="relative border border-gray-600 rounded p-4">
                    <label className="absolute -top-3 left-3 bg-[#111111] px-1 text-gray-400 text-sm">YA</label>
                    <input 
                        type="number" 
                        value={y}
                        onChange={(e) => setY(e.target.value)}
                        className="w-full bg-transparent text-white text-lg outline-none font-mono"
                        placeholder="0.00"
                    />
                </div>

                <div className="flex items-center justify-between mt-6">
                    <label className="text-gray-300 font-semibold text-lg">Echelle :</label>
                    <div className="relative">
                        <select 
                            value={scale}
                            onChange={(e) => setScale(e.target.value)}
                            className="bg-[#111111] text-white text-lg font-mono border-none outline-none appearance-none cursor-pointer pr-8"
                        >
                            <option value="1/20000">1/20000</option>
                            <option value="1/2000">1/2000</option>
                            <option value="1/1000">1/1000</option>
                            <option value="1/500">1/500</option>
                        </select>
                        <div className="absolute right-0 top-1/2 transform -translate-y-1/2 pointer-events-none">
                            <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 1.5L6 6.5L11 1.5" stroke="gray" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 mt-8">
                    <button 
                        onClick={handleCalculate}
                        className="flex-1 bg-[#D8B4FE] text-[#4C1D95] font-bold py-4 rounded-full hover:bg-[#C4B5FD] transition-colors text-lg shadow-lg"
                    >
                        Calculer
                    </button>
                    <button 
                        onClick={handleClear}
                        className="flex-1 bg-[#D8B4FE] text-[#4C1D95] font-bold py-4 rounded-full hover:bg-[#C4B5FD] transition-colors text-lg shadow-lg"
                    >
                        Vider
                    </button>
                </div>

                {result && (
                    <div className="mt-8 bg-[#333333] rounded-lg p-6 text-center shadow-inner border border-gray-600">
                        <div className="flex justify-between items-center text-gray-300 text-xl font-medium">
                            <span>Mappe :</span>
                            <span className="font-bold text-white text-2xl tracking-wider">{result}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 text-right">Repérage Lambert (km)</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MappeCalculationView;