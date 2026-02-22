
import React, { useRef, useState } from 'react';
import { Notification } from '../types';
import { extractPointsFromFile } from '../services/geminiService';
import { processGisFile } from '../services/gisImportService';
import JSZip from 'jszip';

interface MultiModalImporterProps {
  onImport: (points: { x: number; y: number }[]) => void;
  onImportLayers?: (layers: { layerName: string; points: { x: number; y: number }[] }[]) => void;
  setNotification: (message: string, type: Notification['type']) => void;
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

const extractPointsFromGeoJSON = (geojson: any): {x: number, y: number}[] => {
    const points: {x: number, y: number}[] = [];
    const features = geojson.features || (geojson.type === 'Feature' ? [geojson] : []);
    
    for (const f of features) {
        if (!f.geometry) continue;
        const geom = f.geometry;
        if (geom.type === 'Point') {
            points.push({ x: geom.coordinates[0], y: geom.coordinates[1] });
        } else if (geom.type === 'MultiPoint') {
            geom.coordinates.forEach((c: number[]) => points.push({ x: c[0], y: c[1] }));
        } else if (geom.type === 'LineString') {
            geom.coordinates.forEach((c: number[]) => points.push({ x: c[0], y: c[1] }));
        } else if (geom.type === 'Polygon') {
            geom.coordinates[0].forEach((c: number[]) => points.push({ x: c[0], y: c[1] }));
        } else if (geom.type === 'MultiPolygon') {
             geom.coordinates.forEach((poly: number[][][]) => {
                 poly[0].forEach((c: number[]) => points.push({ x: c[0], y: c[1] }));
             });
        }
    }
    return points;
}

const MultiModalImporter: React.FC<MultiModalImporterProps> = ({ onImport, onImportLayers, setNotification }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingSource, setLoadingSource] = useState<'file' | null>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, source: 'file') => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setLoadingSource(source);
        
        // TENTATIVE 1 : Traitement Local (SIG)
        const isVectorFormat = file.name.match(/\.(zip|qgz|kmz|kml|gpx|geojson|json|shp)$/i);
        if (isVectorFormat) {
            try {
                setNotification('Analyse locale du fichier...', 'info');
                const layers = await processGisFile(file);
                
                const extractedLayers = layers.map(l => ({
                    layerName: l.name,
                    points: extractPointsFromGeoJSON(l.data)
                })).filter(l => l.points.length > 0);

                if (extractedLayers.length > 0) {
                    if (onImportLayers) {
                        onImportLayers(extractedLayers);
                    } else {
                        const allPoints = extractedLayers.flatMap(layer => layer.points);
                        onImport(allPoints);
                        setNotification(`${allPoints.length} points importés localement.`, 'success');
                    }
                    setIsLoading(false);
                    setLoadingSource(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    return;
                }
            } catch (gisError) {
                console.warn("L'import local a échoué, passage à l'IA...", gisError);
                // On continue vers l'IA si le local échoue (ex: ZIP corrompu ou format non supporté par shpjs)
            }
        }

        // TENTATIVE 2 : Traitement par IA
        setNotification('Analyse du fichier par IA...', 'info');
        try {
            let filePart: { inlineData: { data: string; mimeType: string; }; } | { text: string; };
            
            const fileName = file.name.toLowerCase();
            const isImage = file.type.startsWith('image/');
            const isPdf = file.type === 'application/pdf';
            const isZip = fileName.endsWith('.qgz') || fileName.endsWith('.zip') || fileName.endsWith('.kmz');

            if (isZip) {
                setNotification('Décompression de l\'archive...', 'info');
                try {
                    const zip = new JSZip();
                    const zipInstance = await zip.loadAsync(file);
                    const allFiles = Object.keys(zipInstance.files);
                    
                    let targetFile = allFiles.find(path => path.match(/\.qgs$/i) && !path.includes('__MACOSX') && !zipInstance.files[path].dir);
                    if (!targetFile) targetFile = allFiles.find(path => path.match(/\.(xml|kml|gpx|geojson|json|wkt|txt|csv)$/i) && !path.includes('__MACOSX') && !zipInstance.files[path].dir);
                    
                    if (targetFile) {
                        setNotification(`Lecture de ${targetFile}...`, 'info');
                        const textContent = await zipInstance.files[targetFile].async("string");
                        // Limite de sécurité pour éviter l'erreur de token
                        if (textContent.length > 3500000) {
                             throw new Error("Le fichier extrait est trop volumineux pour l'IA (>3.5M caractères).");
                        }
                        filePart = { text: textContent };
                    } else {
                        throw new Error("Aucun fichier texte exploitable trouvé dans l'archive pour l'IA.");
                    }
                } catch (e) {
                    throw e instanceof Error ? e : new Error("Erreur de lecture ZIP");
                }
            } else if (isImage || isPdf) {
                 const base64Data = await fileToBase64(file);
                 filePart = {
                    inlineData: {
                        data: base64Data,
                        mimeType: file.type || 'application/octet-stream',
                    }
                 };
            } else {
                const textContent = await file.text();
                // Limite de sécurité
                if (textContent.length > 3500000) {
                     throw new Error("Le fichier est trop volumineux pour l'IA (>3.5M caractères).");
                }
                filePart = { text: textContent };
            }
            
            setNotification('Extraction des points par l\'IA...', 'info');
            const extractedLayers = await extractPointsFromFile(filePart);
            
            if (extractedLayers.length > 0) {
                 if ((isZip || fileName.endsWith('.qgz')) && onImportLayers) {
                    onImportLayers(extractedLayers);
                 } else {
                    const allPoints = extractedLayers.flatMap(layer => layer.points);
                    onImport(allPoints);
                    setNotification(`${allPoints.length} points importés par IA.`, 'success');
                 }
            } else {
                setNotification("L'IA n'a trouvé aucun point valide.", 'info');
            }

        } catch (error) {
            console.error("Erreur import:", error);
            let errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
            
            if (errorMessage.includes('token') || errorMessage.includes('too large')) {
                errorMessage = "Fichier trop volumineux pour l'IA. Essayez d'importer un fichier plus petit ou un format vectoriel (SHP, KML, JSON) importé via l'outil local.";
            }
            
            setNotification(`Erreur: ${errorMessage}`, 'error');
        } finally {
             setIsLoading(false);
             setLoadingSource(null);
             if (fileInputRef.current) {
                fileInputRef.current.value = '';
             }
        }
    };

    const handleFileClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div>
            <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFileChange(e, 'file')}
                accept=".dat,.txt,.csv,.kml,.kmz,.gpx,.geojson,.json,image/png,image/jpeg,image/webp,application/pdf,.qgz,.zip,.shp"
                className="hidden"
            />
            <button
                onClick={handleFileClick}
                disabled={isLoading}
                className="w-full bg-purple-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-purple-700 transition duration-200 flex items-center justify-center space-x-2 disabled:bg-gray-400 dark:disabled:bg-gray-600"
            >
                {isLoading && loadingSource === 'file' ? (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                )}
                <span>{isLoading && loadingSource === 'file' ? 'Analyse...' : 'Importer'}</span>
            </button>
        </div>
    );
};

export default MultiModalImporter;
