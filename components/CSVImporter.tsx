import React, { useRef } from 'react';
import { Notification } from '../types';

interface CSVImporterProps {
  onImport: (points: { x: number; y: number }[]) => void;
  setNotification: (message: string, type: Notification['type']) => void;
}

const CSVImporter: React.FC<CSVImporterProps> = ({ onImport, setNotification }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      try {
        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
        if (lines.length === 0) {
          setNotification("Le fichier CSV est vide.", 'info');
          return;
        }

        const headerLine = lines[0].toLowerCase().split(',');
        const xIndex = headerLine.findIndex(h => ['x', 'lon', 'longitude'].includes(h.trim()));
        const yIndex = headerLine.findIndex(h => ['y', 'lat', 'latitude'].includes(h.trim()));
        
        let parsedPoints: { x: number; y: number }[] = [];
        const dataLines = (xIndex !== -1 && yIndex !== -1) ? lines.slice(1) : lines;

        if (xIndex === -1 || yIndex === -1) {
             if (headerLine.length < 2) {
                 throw new Error("Le format CSV est invalide. Attendu au moins 2 colonnes (X, Y).");
            }
            console.warn("En-têtes 'x' et 'y' non trouvés. En supposant que la première colonne est X et la deuxième est Y.");
        }

        dataLines.forEach((line, index) => {
          const values = line.split(',');
          const xVal = parseFloat(values[xIndex !== -1 ? xIndex : 0]);
          const yVal = parseFloat(values[yIndex !== -1 ? yIndex : 1]);

          if (!isNaN(xVal) && !isNaN(yVal)) {
            parsedPoints.push({ x: xVal, y: yVal });
          } else {
            console.warn(`Ligne ${index + 1} ignorée : données non valides.`);
          }
        });
        
        if (parsedPoints.length > 0) {
            onImport(parsedPoints);
            setNotification(`${parsedPoints.length} points importés avec succès.`, 'success');
        } else {
            setNotification("Aucun point valide n'a été trouvé dans le fichier CSV.", 'error');
        }

      } catch (error) {
        console.error("Erreur lors de l'analyse du CSV:", error);
        const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
        setNotification(`Erreur lors de l'importation: ${errorMessage}`, 'error');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.onerror = () => {
        setNotification("Erreur de lecture du fichier.", 'error');
    };
    reader.readAsText(file);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv,text/csv"
        className="hidden"
      />
      <button
        onClick={handleClick}
        className="bsport-btn-secondary w-full"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
        <span>Importer CSV</span>
      </button>
    </div>
  );
};

export default CSVImporter;