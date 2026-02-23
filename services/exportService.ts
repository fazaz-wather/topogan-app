import { Point, CalculationResults, AppSettings } from '../types';
import { convertArea, getAreaUnitLabel, convertDistance, getDistanceUnitLabel } from './unitConversionService';

const escapeCSV = (value: any): string => {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

/**
 * Sauvegarde moderne (Desktop avec File System Access API)
 */
export const saveFileWithPicker = async (
    content: string | Blob,
    defaultName: string,
    description: string,
    mimeType: string,
    extension: string
): Promise<boolean> => {
    try {
        // @ts-ignore
        if (typeof window.showSaveFilePicker === 'function') {
            const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });

            // @ts-ignore
            const handle = await window.showSaveFilePicker({
                suggestedName: defaultName,
                types: [{
                    description: description,
                    accept: { [mimeType]: ['.' + extension] },
                }],
            });

            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return true;
        }
    } catch (err: any) {
        if (err.name === 'AbortError') return true;
        console.warn("File System Access non disponible.");
    }
    return false;
};

/**
 * Sauvegarde ou partage un fichier
 */
export const saveAndShareFile = async (
    content: string | Blob,
    filename: string,
    mimeType: string
) => {

    const blob = content instanceof Blob
        ? content
        : new Blob([content], { type: mimeType });

    const extension = filename.split('.').pop() || 'txt';

    // 1️⃣ Tentative Desktop moderne
    const savedDirectly = await saveFileWithPicker(
        blob,
        filename,
        'Fichier TOPOGAN',
        mimeType,
        extension
    );

    if (savedDirectly) return;

    // 2️⃣ Partage natif Mobile
    if (navigator.canShare && navigator.share) {
        try {
            const file = new File([blob], filename, { type: mimeType });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: filename,
                    text: `Export de ${filename} depuis TOPOGAN`
                });
                return;
            }
        } catch {
            console.warn("Partage natif annulé.");
        }
    }

    // 3️⃣ ✅ Correction Android WebView
    const isAndroidWebView = /Android/i.test(navigator.userAgent);

    if (isAndroidWebView) {
        const reader = new FileReader();
        reader.onloadend = function () {
            const base64data = reader.result as string;
            window.location.href = base64data;
            // devient data:application/pdf;base64,...
            // Android DownloadListener va le détecter
        };
        reader.readAsDataURL(blob);
        return;
    }

    // 4️⃣ Fallback navigateur classique (PC)
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};


/**
 * Export Points CSV
 */
export const exportPointsToCSV = (points: Point[], settings: AppSettings) => {
    if (points.length === 0) {
        alert("Aucun point à exporter.");
        return;
    }

    const { precision, coordinateSystem } = settings;
    const pointDisplayPrecision =
        coordinateSystem === 'wgs84'
            ? Math.max(6, precision)
            : precision;

    const csvRows: string[] = [];

    const pointHeaderX = coordinateSystem === 'wgs84' ? 'Longitude' : 'X';
    const pointHeaderY = coordinateSystem === 'wgs84' ? 'Latitude' : 'Y';

    csvRows.push(`ID,${pointHeaderX},${pointHeaderY}`);

    points.forEach(p => {
        csvRows.push(
            `${p.id},${p.x.toFixed(pointDisplayPrecision)},${p.y.toFixed(pointDisplayPrecision)}`
        );
    });

    const csvContent = csvRows.join('\r\n');

    saveAndShareFile(
        csvContent,
        'export_topogan_points.csv',
        'text/csv;charset=utf-8;'
    );
};


/**
 * Export Surface CSV
 */
export const exportSurfaceDataToCSV = (
    points: Point[],
    results: CalculationResults,
    settings: AppSettings
) => {

    if (points.length === 0 || !results) {
        alert("Aucune donnée à exporter.");
        return;
    }

    const { precision, distanceUnit, areaUnit, coordinateSystem } = settings;
    const pointDisplayPrecision =
        coordinateSystem === 'wgs84'
            ? Math.max(6, precision)
            : precision;

    const csvRows: string[] = [];

    // Résumé
    csvRows.push('Résumé des Calculs');

    if (areaUnit === 'ha_a_ca') {
        csvRows.push('Propriété,Hectares,Ares,Centiares');

        const hectares = Math.floor(results.area / 10000);
        const ares = Math.floor((results.area % 10000) / 100);
        const centiares = (results.area % 100).toFixed(precision);

        csvRows.push(`Surface,${hectares},${ares},${centiares}`);
    } else {
        csvRows.push('Propriété,Valeur,Unité');

        const displayedArea = convertArea(results.area, areaUnit);
        const areaLabel = getAreaUnitLabel(areaUnit);

        csvRows.push(
            `Surface,${displayedArea.toFixed(precision)},${escapeCSV(areaLabel)}`
        );
    }

    csvRows.push('');

    // Points
    const pointHeaderX = coordinateSystem === 'wgs84' ? 'Longitude' : 'X';
    const pointHeaderY = coordinateSystem === 'wgs84' ? 'Latitude' : 'Y';

    csvRows.push('Liste des Points');
    csvRows.push(`ID,${pointHeaderX},${pointHeaderY}`);

    points.forEach(p => {
        csvRows.push(
            `${p.id},${p.x.toFixed(pointDisplayPrecision)},${p.y.toFixed(pointDisplayPrecision)}`
        );
    });

    csvRows.push('');

    // Distances
    const distanceLabel = getDistanceUnitLabel(distanceUnit);

    csvRows.push('Distances des Segments');
    csvRows.push('De (ID),À (ID),Distance,Unité');

    results.distances.forEach(d => {
        const displayedDistance = convertDistance(d.distance, distanceUnit);

        csvRows.push(
            `${d.from},${d.to},${displayedDistance.toFixed(precision)},${escapeCSV(distanceLabel)}`
        );
    });

    const csvContent = csvRows.join('\r\n');

    saveAndShareFile(
        csvContent,
        'export_topogan_surface.csv',
        'text/csv;charset=utf-8;'
    );
};