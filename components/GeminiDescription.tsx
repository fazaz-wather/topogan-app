
import React, { useState, useCallback } from 'react';
import { Point, CalculationResults, AppSettings } from '../types';
import { generateParcelDescription } from '../services/geminiService';

interface GeminiDescriptionProps {
  points: Point[];
  results: CalculationResults | null;
  settings: AppSettings;
}

const GeminiDescription: React.FC<GeminiDescriptionProps> = ({ points, results, settings }) => {
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerateDescription = useCallback(async () => {
    if (points.length < 3 || !results) {
      setError("Veuillez d'abord calculer la surface et les distances.");
      return;
    }
    setIsLoading(true);
    setError('');
    setDescription('');
    try {
      const desc = await generateParcelDescription(points, results, settings);
      setDescription(desc);
    } catch (err: any) {
      setError(err.message || "Une erreur inconnue est survenue.");
    } finally {
      setIsLoading(false);
    }
  }, [points, results, settings]);

  return (
    <div className="space-y-3">
      <h3 className="text-md font-semibold">Description par IA Gemini</h3>
      <button
        onClick={handleGenerateDescription}
        disabled={isLoading || points.length < 3 || !results}
        className="w-full bg-teal-600 text-white font-bold py-2 px-4 rounded-md hover:bg-teal-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center space-x-2"
      >
        {isLoading ? (
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        )}
        <span>{isLoading ? 'Génération...' : 'Générer la description'}</span>
      </button>

      {error && <p className="text-sm text-red-500">{error}</p>}
      
      {description && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto">
          <p className="text-sm whitespace-pre-wrap font-serif text-gray-700 dark:text-gray-300">{description}</p>
        </div>
      )}
    </div>
  );
};

export default GeminiDescription;