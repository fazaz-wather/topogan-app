
import * as shp from 'shpjs';
import JSZip from 'jszip';
import { ImportedLayer } from '../types';

// Palette de couleurs pour les couches importées
const LAYER_COLORS = ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#33FFF3', '#FF3333', '#FFFF33', '#800080'];

// Helper pour gérer les différences d'import (ESM vs UMD vs CommonJS) de shpjs
const getShpApi = () => {
    const api = shp as any;
    if (typeof api === 'function') return api; // shp() direct
    if (api.parseZip) return api; // namespace avec named exports
    if (api.default) return api.default; // ESM default export
    return api;
};

/**
 * Parsers natifs basiques pour KML et GPX pour éviter d'utiliser l'IA sur de gros fichiers XML.
 */
const parseKml = (text: string): any => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");
    const features = [];
    const placemarks = xmlDoc.getElementsByTagName("Placemark");

    for (let i = 0; i < placemarks.length; i++) {
        const placemark = placemarks[i];
        const name = placemark.getElementsByTagName("name")[0]?.textContent || `Point ${i + 1}`;
        const point = placemark.getElementsByTagName("Point")[0];
        const lineString = placemark.getElementsByTagName("LineString")[0];
        const polygon = placemark.getElementsByTagName("Polygon")[0];

        let geometry = null;

        if (point) {
            const coords = point.getElementsByTagName("coordinates")[0]?.textContent?.trim();
            if (coords) {
                const [lon, lat] = coords.split(',').map(parseFloat);
                if (!isNaN(lon) && !isNaN(lat)) {
                    geometry = { type: "Point", coordinates: [lon, lat] };
                }
            }
        } else if (lineString) {
            const coordsRaw = lineString.getElementsByTagName("coordinates")[0]?.textContent?.trim();
            if (coordsRaw) {
                const coords = coordsRaw.split(/\s+/).map(pair => {
                    const [lon, lat] = pair.split(',').map(parseFloat);
                    return (!isNaN(lon) && !isNaN(lat)) ? [lon, lat] : null;
                }).filter(c => c !== null);
                if (coords.length > 1) geometry = { type: "LineString", coordinates: coords };
            }
        } else if (polygon) {
             const coordsRaw = polygon.getElementsByTagName("coordinates")[0]?.textContent?.trim();
             if (coordsRaw) {
                const coords = coordsRaw.split(/\s+/).map(pair => {
                    const [lon, lat] = pair.split(',').map(parseFloat);
                    return (!isNaN(lon) && !isNaN(lat)) ? [lon, lat] : null;
                }).filter(c => c !== null);
                if (coords.length > 2) geometry = { type: "Polygon", coordinates: [coords] };
             }
        }

        if (geometry) {
            features.push({
                type: "Feature",
                properties: { name },
                geometry
            });
        }
    }

    return { type: "FeatureCollection", features };
};

const parseGpx = (text: string): any => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");
    const features = [];
    
    // Waypoints
    const wpts = xmlDoc.getElementsByTagName("wpt");
    for (let i = 0; i < wpts.length; i++) {
        const lat = parseFloat(wpts[i].getAttribute("lat") || "0");
        const lon = parseFloat(wpts[i].getAttribute("lon") || "0");
        const name = wpts[i].getElementsByTagName("name")[0]?.textContent || `WPT ${i}`;
        if (!isNaN(lat) && !isNaN(lon)) {
            features.push({
                type: "Feature",
                properties: { name },
                geometry: { type: "Point", coordinates: [lon, lat] }
            });
        }
    }

    // Tracks
    const trks = xmlDoc.getElementsByTagName("trk");
    for (let i = 0; i < trks.length; i++) {
        const name = trks[i].getElementsByTagName("name")[0]?.textContent || `Track ${i}`;
        const trkpts = trks[i].getElementsByTagName("trkpt");
        const coords = [];
        for(let j=0; j<trkpts.length; j++) {
             const lat = parseFloat(trkpts[j].getAttribute("lat") || "0");
             const lon = parseFloat(trkpts[j].getAttribute("lon") || "0");
             if (!isNaN(lat) && !isNaN(lon)) coords.push([lon, lat]);
        }
        if (coords.length > 1) {
            features.push({
                type: "Feature",
                properties: { name },
                geometry: { type: "LineString", coordinates: coords }
            });
        }
    }

    return { type: "FeatureCollection", features };
};

const parseQgs = (text: string): ImportedLayer[] => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");
    const layers: ImportedLayer[] = [];
    
    // Check for memory layers or embedded data
    // This is very limited as QGS mostly links to files
    const mapLayers = xmlDoc.getElementsByTagName("maplayer");
    let hasExternalRefs = false;

    for (let i = 0; i < mapLayers.length; i++) {
        const layer = mapLayers[i];
        const name = layer.getElementsByTagName("layername")[0]?.textContent || `Layer ${i}`;
        const provider = layer.getElementsByTagName("provider")[0]?.textContent;
        
        if (provider === 'memory' || provider === 'spatialite' || provider === 'wfs') {
            // Attempt to extract features if stored in XML (rare/complex)
            // For now, we just skip complex parsing but warn
        } else if (provider === 'ogr' || provider === 'delimitedtext') {
            hasExternalRefs = true;
        }
    }

    if (hasExternalRefs) {
        throw new Error("Ce fichier projet QGIS (.qgs/.qgz) contient des références vers des fichiers externes (SHP, etc.) qui ne sont pas inclus. Veuillez importer une archive ZIP contenant le projet ET les fichiers de données, ou exportez vos couches au format GeoJSON/KML.");
    }

    return layers;
};

/**
 * Traite un fichier importé (ZIP, QGZ, KML, JSON, etc.) et retourne une liste de couches GeoJSON.
 */
export const processGisFile = async (file: File): Promise<ImportedLayer[]> => {
    const fileName = file.name.toLowerCase();
    const importedLayers: ImportedLayer[] = [];
    const shpApi = getShpApi();

    try {
        if (fileName.endsWith('.kml')) {
            const text = await file.text();
            const geojson = parseKml(text);
            if (geojson.features.length > 0) importedLayers.push(createLayerFromGeoJSON(geojson, file.name, 0));
        } else if (fileName.endsWith('.gpx')) {
            const text = await file.text();
            const geojson = parseGpx(text);
            if (geojson.features.length > 0) importedLayers.push(createLayerFromGeoJSON(geojson, file.name, 0));
        } else if (fileName.endsWith('.geojson') || fileName.endsWith('.json')) {
            const text = await file.text();
            const parsed = JSON.parse(text);
            importedLayers.push(createLayerFromGeoJSON(parsed, file.name, 0));
        } else if (fileName.endsWith('.qgs')) {
            const text = await file.text();
            const layers = parseQgs(text); // Will likely throw instructions
            if (layers.length > 0) importedLayers.push(...layers);
        } else if (fileName.endsWith('.zip') || fileName.endsWith('.qgz') || fileName.endsWith('.kmz')) {
            const arrayBuffer = await file.arrayBuffer();
            
            // 1. Tentative avec shpjs automatique
            try {
                if (shpApi.parseZip) {
                    const geojson = await shpApi.parseZip(arrayBuffer);
                    if (Array.isArray(geojson)) {
                        geojson.forEach((g: any, index) => {
                            if (g.features && g.features.length > 0) {
                                importedLayers.push(createLayerFromGeoJSON(g, g.fileName || `Couche ${index + 1}`, index));
                            }
                        });
                    } else if (geojson.features && geojson.features.length > 0) {
                        importedLayers.push(createLayerFromGeoJSON(geojson, file.name.replace(/\.zip|\.qgz/i, ''), 0));
                    }
                }
            } catch (e) {
                console.warn("L'analyse automatique du ZIP a échoué, tentative manuelle...", e);
            }

            // 2. Analyse manuelle du ZIP (Fallback robuste)
            // Si shpjs n'a rien trouvé, on cherche manuellement KML, GPX, GeoJSON et SHP décomposés.
            if (importedLayers.length === 0) {
                const zip = new JSZip();
                const zipContent = await zip.loadAsync(arrayBuffer);
                let index = 0;

                // Pour reconstruire les shapefiles manuellement
                const shpCandidates: Record<string, { shp?: any, dbf?: any, prj?: any, name: string }> = {};

                for (const [path, zipEntry] of Object.entries(zipContent.files)) {
                    const entry = zipEntry as any;
                    if (entry.dir) continue;
                    
                    const lowerPath = path.toLowerCase();
                    // Ignorer les fichiers système Mac ou cachés
                    if (lowerPath.includes('__macosx') || lowerPath.startsWith('.')) continue;

                    // Support KML/GPX/GeoJSON dans ZIP
                    if (lowerPath.endsWith('.geojson') || lowerPath.endsWith('.json')) {
                        const content = await entry.async('string');
                        try {
                            const parsed = JSON.parse(content);
                            if (parsed.type === 'FeatureCollection') {
                                importedLayers.push(createLayerFromGeoJSON(parsed, path.split('/').pop() || 'Layer', index++));
                            }
                        } catch (e) {}
                    } else if (lowerPath.endsWith('.kml') || lowerPath.endsWith('.xml')) {
                        const content = await entry.async('string');
                        if (content.includes('<kml')) {
                            const geojson = parseKml(content);
                            if (geojson.features.length > 0) importedLayers.push(createLayerFromGeoJSON(geojson, path.split('/').pop() || 'KML', index++));
                        } else if (content.includes('<gpx')) {
                            const geojson = parseGpx(content);
                            if (geojson.features.length > 0) importedLayers.push(createLayerFromGeoJSON(geojson, path.split('/').pop() || 'GPX', index++));
                        }
                    } else if (lowerPath.endsWith('.gpx')) {
                        const content = await entry.async('string');
                        const geojson = parseGpx(content);
                        if (geojson.features.length > 0) importedLayers.push(createLayerFromGeoJSON(geojson, path.split('/').pop() || 'GPX', index++));
                    } else if (lowerPath.endsWith('.qgs')) {
                         const content = await entry.async('string');
                         try { parseQgs(content); } catch (e) { console.warn("QGS in zip skipped:", e); }
                    }
                    
                    // Collection des morceaux de Shapefile (shp, dbf, prj)
                    // On groupe par le chemin sans extension
                    else if (lowerPath.endsWith('.shp')) {
                        const key = path.substring(0, path.length - 4);
                        if (!shpCandidates[key]) shpCandidates[key] = { name: path.split('/').pop()!.replace('.shp', ''), shp: undefined };
                        shpCandidates[key].shp = entry;
                    } else if (lowerPath.endsWith('.dbf')) {
                        const key = path.substring(0, path.length - 4);
                        if (!shpCandidates[key]) shpCandidates[key] = { name: path.split('/').pop()!.replace('.dbf', ''), shp: undefined };
                        shpCandidates[key].dbf = entry;
                    } else if (lowerPath.endsWith('.prj')) {
                        const key = path.substring(0, path.length - 4);
                        if (!shpCandidates[key]) shpCandidates[key] = { name: path.split('/').pop()!.replace('.prj', ''), shp: undefined };
                        shpCandidates[key].prj = entry;
                    }
                }

                // Reconstruction manuelle des Shapefiles trouvés
                for (const key in shpCandidates) {
                    const cand = shpCandidates[key];
                    if (cand.shp) { // Le .shp est obligatoire
                        try {
                            // Lire les buffers
                            const shpBuffer = await cand.shp.async('arraybuffer');
                            const dbfBuffer = cand.dbf ? await cand.dbf.async('arraybuffer') : null;
                            const prjStr = cand.prj ? await cand.prj.async('string') : null;

                            // Utiliser les fonctions de bas niveau de shpjs si disponibles
                            if (shpApi && shpApi.parseShp && shpApi.combine) {
                                const geom = shpApi.parseShp(shpBuffer, prjStr);
                                const attr = dbfBuffer ? shpApi.parseDbf(dbfBuffer) : null;
                                const geojson = attr ? shpApi.combine([geom, attr]) : geom;
                                
                                if (geojson.features && geojson.features.length > 0) {
                                    importedLayers.push(createLayerFromGeoJSON(geojson, cand.name, index++));
                                }
                            } else {
                                console.warn("Fonctions de bas niveau shpjs non disponibles.");
                            }
                        } catch (err) {
                            console.warn(`Erreur parsing manuel du Shapefile ${cand.name}:`, err);
                        }
                    }
                }
            }
        } 

        if (importedLayers.length === 0) {
            throw new Error("Aucune donnée vectorielle valide (SHP, KML, GPX, GeoJSON) trouvée. Si vous utilisez un fichier projet QGIS (.qgs), assurez-vous d'importer une archive ZIP contenant également les fichiers de données (Shapefiles).");
        }

        return importedLayers;

    } catch (error: any) {
        console.error("Erreur import SIG:", error);
        throw new Error(error.message || "Erreur lors du traitement du fichier.");
    }
};

const createLayerFromGeoJSON = (data: any, name: string, index: number): ImportedLayer => {
    let type: 'point' | 'line' | 'polygon' | 'unknown' = 'unknown';
    if (data.features && data.features.length > 0) {
        const geomType = data.features[0].geometry?.type;
        if (geomType === 'Point' || geomType === 'MultiPoint') type = 'point';
        else if (geomType === 'LineString' || geomType === 'MultiLineString') type = 'line';
        else if (geomType === 'Polygon' || geomType === 'MultiPolygon') type = 'polygon';
    }

    return {
        id: `imported-${Date.now()}-${index}`,
        name: name,
        data: data,
        color: LAYER_COLORS[index % LAYER_COLORS.length],
        visible: true,
        type: type
    };
};
