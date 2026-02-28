
import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import * as L from 'leaflet';
import { Point, AppSettings, Annotation, Notification, MapTool, MapLayersVisibility, Parcel, CalculationResults, View, CoordinateSystem, ImportedLayer } from '../types';
import Map from '../components/Map';
import { useParcels } from '../hooks/useParcels';
import ContextMenu from '../components/ContextMenu';
import { calculateDistanceBetweenPoints, calculatePolygonArea, calculateDistances, calculateAngleBetweenPoints, calculateCentroid, calculateBearing } from '../services/topographyService';
import { coordinateTransformationService } from '../services/coordinateTransformationService';
import { formatArea, convertDistance, getDistanceUnitLabel } from '../services/unitConversionService';
import MapControlPanel from '../components/MapControlPanel';
import MapSearchControl from '../components/MapSearchControl';
import ActiveParcelInfoPanel from '../components/ActiveParcelInfoPanel';
import LiveMeasureDisplay from '../components/LiveMeasureDisplay';
import ParcelDetailsModal from '../components/ParcelDetailsModal';
import PhotoCaptureModal from '../components/PhotoCaptureModal';
import JSZip from 'jszip';
import { extractPointsFromFile } from '../services/geminiService';
import { processGisFile } from '../services/gisImportService';

interface MapViewProps {
    parcels: Parcel[];
    activeParcelId: number | null;
    setActiveParcelId: (id: number | null) => void;
    parcelManager: ReturnType<typeof useParcels>;
    annotations: Annotation[];
    setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
    settings: AppSettings;
    onSettingsChange: (settings: AppSettings) => void;
    setNotification: (message: string, type: Notification['type']) => void;
    highlightedPointId: number | null;
    goToCoords?: { point: { x: number; y: number }, key: number } | null;
    fitToParcel?: { id: number; key: number } | null;
    onOpenGoToModal: () => void;
    results: CalculationResults | null;
    onOpenBornageSketch: () => void;
    onOpenCadastralPlan: () => void;
    currentView: View;
    importedLayers: ImportedLayer[];
    setImportedLayers: React.Dispatch<React.SetStateAction<ImportedLayer[]>>;
    undo?: () => void;
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

const getSystemLabel = (sys: CoordinateSystem) => {
    switch(sys) {
        case 'lambert_nord_maroc': return 'Maroc Zone 1 (Nord)';
        case 'lambert_sud_maroc': return 'Maroc Zone 2 (Sud)';
        case 'lambert_z1': return 'Maroc Zone 1';
        case 'lambert_z2': return 'Maroc Zone 2';
        case 'lambert_z3': return 'Maroc Zone 3';
        case 'lambert_z4': return 'Maroc Zone 4';
        case 'wgs84': return 'WGS84 (GPS)';
        default: return 'Système Local';
    }
}

const getSuggestedZone = (lat: number): CoordinateSystem => {
    if (lat >= 31.7) return 'lambert_z1';
    if (lat >= 28.1) return 'lambert_z2';
    if (lat >= 24.5) return 'lambert_z3';
    return 'lambert_z4';
};

const MapView: React.FC<MapViewProps> = (props) => {
    const { 
        parcels, activeParcelId, setActiveParcelId, parcelManager, annotations, setAnnotations, settings, 
        onSettingsChange, setNotification, highlightedPointId, goToCoords: propGoToCoords, fitToParcel,
        onOpenGoToModal, onOpenBornageSketch, onOpenCadastralPlan, currentView,
        importedLayers, setImportedLayers, undo
    } = props;
    
    const [activeTool, setActiveTool] = useState<MapTool>('pan');
    const [currentDrawingPoints, setCurrentDrawingPoints] = useState<{x: number, y: number}[]>([]);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; options: any[]; entity?: any } | null>(null);
    const [layersVisibility, setLayersVisibility] = useState<MapLayersVisibility>({ points: false, polygon: true, annotations: true });
    const [pendingAnnotation, setPendingAnnotation] = useState<{x: number, y: number} | null>(null);
    const [mouseWgsCoords, setMouseWgsCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [mapCenterCoords, setMapCenterCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isTracking, setIsTracking] = useState(false);
    const [photoTargetPointId, setPhotoTargetPointId] = useState<number | null>(null);
    const [selectedParcelForDetails, setSelectedParcelForDetails] = useState<Parcel | null>(null);
    const [movingPointId, setMovingPointId] = useState<number | null>(null);
    const [isInfoPanelVisible, setIsInfoPanelVisible] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setIsInfoPanelVisible(true);
    }, [activeParcelId]);

    // Local GoTo state to handle internal search
    const [localGoToCoords, setLocalGoToCoords] = useState<{ point: { x: number; y: number }, key: number } | null>(null);
    const effectiveGoTo = localGoToCoords || propGoToCoords;

    const isLocalSystem = settings.coordinateSystem === 'local';

    const activeParcel = useMemo(() => parcels.find(p => p.id === activeParcelId), [parcels, activeParcelId]);

    // Memoize this callback to avoid Map re-renders on simple mouse moves
    const handleCenterChange = useCallback((c: L.LatLng) => {
        setMapCenterCoords({ lat: c.lat, lng: c.lng });
        // Fallback for mobile where mousemove might not fire
        setMouseWgsCoords({ lat: c.lat, lng: c.lng });
    }, []);

    const handleMouseMove = useCallback((c: L.LatLng) => {
        setMouseWgsCoords({ lat: c.lat, lng: c.lng });
    }, []);

    const handleMapMove = useCallback((c: L.LatLng) => {
        setMapCenterCoords({ lat: c.lat, lng: c.lng });
        if (activeTool === 'point') {
            setMouseWgsCoords({ lat: c.lat, lng: c.lng });
        }
    }, [activeTool]);

    const parcelsForMap = useMemo(() => {
        if (isLocalSystem) return [];
        return parcels.map(parcel => {
            const transformedPoints = parcel.points.map(p => {
                if (settings.coordinateSystem === 'wgs84') return p;
                const wgs = coordinateTransformationService.transform(p, settings.coordinateSystem, 'wgs84');
                return wgs ? { ...p, x: wgs.x, y: wgs.y } : null;
            }).filter((p): p is Point => p !== null);
            return { ...parcel, points: transformedPoints };
        });
    }, [parcels, settings.coordinateSystem, isLocalSystem]);
    
    const annotationsForMap = useMemo(() => {
        if (isLocalSystem) return [];
        return annotations.map(a => {
            const wgs = coordinateTransformationService.transform(a, settings.coordinateSystem, 'wgs84');
            return wgs ? { ...a, x: wgs.x, y: wgs.y } : null;
        }).filter(a => a !== null) as Annotation[];
    }, [annotations, settings.coordinateSystem, isLocalSystem]);

    const liveData = useMemo(() => {
        if (!mouseWgsCoords) return null;
        const current = { x: mouseWgsCoords.lng, y: mouseWgsCoords.lat, id: -1 };
        
        if (activeTool === 'measure_line' && currentDrawingPoints.length > 0) {
            const last = currentDrawingPoints[currentDrawingPoints.length - 1];
            let total = calculateDistanceBetweenPoints({...last, id:0}, current, 'wgs84');
            for (let i = 0; i < currentDrawingPoints.length - 1; i++) 
                total += calculateDistanceBetweenPoints({...currentDrawingPoints[i], id:0}, {...currentDrawingPoints[i+1], id:0}, 'wgs84');
            return { totalDistance: total, segmentDistance: calculateDistanceBetweenPoints({...last, id:0}, current, 'wgs84') };
        }
        if (activeTool === 'measure_area' || activeTool === 'polygon') {
            const pts = [...currentDrawingPoints, current].map((p, i) => ({ ...p, id: i }));
            if (pts.length < 2) return null;
            const perim = calculateDistances(pts, 'wgs84').reduce((s, d) => s + d.distance, 0);
            return { perimeter: perim, area: pts.length >= 3 ? calculatePolygonArea(pts, 'wgs84') : 0 };
        }
        if (activeTool === 'measure_angle' && currentDrawingPoints.length > 0) {
             if (currentDrawingPoints.length === 2) return { angle: calculateAngleBetweenPoints({...currentDrawingPoints[0], id: 0}, {...currentDrawingPoints[1], id: 1}, current) };
             return { segmentDistance: calculateDistanceBetweenPoints({...currentDrawingPoints[0], id:0}, current, 'wgs84') };
        }
        return null;
    }, [mouseWgsCoords, activeTool, currentDrawingPoints]);

    const centerDisplayCoords = useMemo(() => {
        if (!mapCenterCoords) return { x: 0, y: 0 };
        if (settings.coordinateSystem === 'wgs84') return { x: mapCenterCoords.lng, y: mapCenterCoords.lat };
        const t = coordinateTransformationService.transform({ x: mapCenterCoords.lng, y: mapCenterCoords.lat }, 'wgs84', settings.coordinateSystem);
        return t || { x: 0, y: 0 };
    }, [mapCenterCoords, settings.coordinateSystem]);

    const cursorDisplayCoords = useMemo(() => {
        if (!mouseWgsCoords) return null;
        if (settings.coordinateSystem === 'wgs84') return { x: mouseWgsCoords.lng, y: mouseWgsCoords.lat };
        const t = coordinateTransformationService.transform({ x: mouseWgsCoords.lng, y: mouseWgsCoords.lat }, 'wgs84', settings.coordinateSystem);
        return t || null;
    }, [mouseWgsCoords, settings.coordinateSystem]);

    // Calcul de la distance et du gisement dynamiques en mode "Ajout Borne" (Viseur)
    const surveyData = useMemo(() => {
        if (activeTool !== 'point' || !activeParcelId || !centerDisplayCoords) return null;
        
        const activeParcel = parcels.find(p => p.id === activeParcelId);
        if (!activeParcel || activeParcel.points.length === 0) return null;

        const lastPoint = activeParcel.points[activeParcel.points.length - 1];
        const p1 = lastPoint;
        const p2 = { id: -1, x: centerDisplayCoords.x, y: centerDisplayCoords.y };

        const distance = calculateDistanceBetweenPoints(p1, p2, settings.coordinateSystem);
        const bearing = calculateBearing(p1, p2, settings.coordinateSystem);

        return { distance, bearing };
    }, [activeTool, activeParcelId, parcels, centerDisplayCoords, settings.coordinateSystem]);

    // Prépare la ligne virtuelle à afficher sur la carte Leaflet (en coordonnées WGS84)
    const trackingLine = useMemo(() => {
        if (activeTool !== 'point' || !activeParcelId || !mouseWgsCoords || !surveyData) return null;
        const mappedParcel = parcelsForMap.find(p => p.id === activeParcelId);
        if (!mappedParcel || mappedParcel.points.length === 0) return null;
        const lastPointWgs = mappedParcel.points[mappedParcel.points.length - 1];
        
        return {
            start: { x: lastPointWgs.x, y: lastPointWgs.y },
            end: { x: mouseWgsCoords.lng, y: mouseWgsCoords.lat },
            label: `${convertDistance(surveyData.distance, settings.distanceUnit).toFixed(settings.precision)} ${getDistanceUnitLabel(settings.distanceUnit)}`
        };
    }, [activeTool, activeParcelId, parcelsForMap, mouseWgsCoords, surveyData, settings.distanceUnit, settings.precision]);


    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleInternalGoTo = (coords: { x: number; y: number }, system: CoordinateSystem) => {
        // Just bubble up to map via state
        setLocalGoToCoords({ point: coords, key: Date.now() });
    };

    const handleCenterOnActiveParcel = useCallback(() => {
        if (!activeParcel || activeParcel.points.length === 0) {
            setNotification("Aucune donnée géométrique pour cette parcelle.", 'info');
            return;
        }
        const centroid = calculateCentroid(activeParcel.points);
        if (centroid) {
            handleInternalGoTo(centroid, settings.coordinateSystem);
            setNotification(`Centré sur ${activeParcel.name}`, 'success');
        } else {
            // Si pas assez de points pour un centroide, aller au premier point
            const firstPoint = activeParcel.points[0];
            handleInternalGoTo({ x: firstPoint.x, y: firstPoint.y }, settings.coordinateSystem);
            setNotification(`Centré sur le premier point de ${activeParcel.name}`, 'success');
        }
    }, [activeParcel, settings.coordinateSystem, setNotification]);

    const [isCapturingPhotoForNewPoint, setIsCapturingPhotoForNewPoint] = useState(false);

    const handleAddCenterPoint = (image?: string) => {
        if (!mapCenterCoords || !activeParcelId) return;
        let coords = { x: mapCenterCoords.lng, y: mapCenterCoords.lat };
        if (settings.coordinateSystem !== 'wgs84') {
            const transformed = coordinateTransformationService.transform(coords, 'wgs84', settings.coordinateSystem);
            if (transformed) coords = transformed;
        }
        // @ts-ignore
        parcelManager.addPoint(activeParcelId, { ...coords, image });
        if (navigator.vibrate) navigator.vibrate(50);
        setNotification("Borne ajoutée au centre", "success");
    };

    const handleUndoPoint = () => {
        if (undo) { undo(); } else if (activeParcelId) {
            const parcel = parcels.find(p => p.id === activeParcelId);
            if (parcel && parcel.points.length > 0) {
                const lastPoint = parcel.points[parcel.points.length - 1];
                parcelManager.deletePoint(activeParcelId, lastPoint.id);
            }
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setNotification('Analyse du fichier...', 'info');
        const fileName = file.name.toLowerCase();
        const isVectorFormat = fileName.endsWith('.zip') || fileName.endsWith('.qgz') || fileName.endsWith('.kmz') || 
                               fileName.endsWith('.kml') || fileName.endsWith('.gpx') || fileName.endsWith('.qgs') ||
                               fileName.endsWith('.geojson') || fileName.endsWith('.json');
        if (isVectorFormat) {
            try {
                const newLayers = await processGisFile(file);
                if (newLayers.length > 0) {
                    setImportedLayers(prev => [...prev, ...newLayers]);
                    setNotification(`${newLayers.length} couches ajoutées au panneau.`, 'success');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    setIsPanelOpen(true); 
                    return;
                }
            } catch (gisError) {
                if (!fileName.endsWith('.zip') && !fileName.endsWith('.qgz') && !fileName.endsWith('.kmz')) {
                     setNotification(`Erreur lecture fichier: ${gisError instanceof Error ? gisError.message : 'Format invalide'}`, 'error');
                     return;
                }
            }
        }
        try {
            let filePart: { inlineData: { data: string; mimeType: string; }; } | { text: string; };
            const isImage = file.type.startsWith('image/');
            const isPdf = file.type === 'application/pdf';
            const isZip = fileName.endsWith('.qgz') || fileName.endsWith('.zip') || fileName.endsWith('.kmz') || file.type.includes('zip');
            if (isZip) {
                setNotification('Recherche de contenu texte...', 'info');
                const zip = new JSZip();
                const zipInstance = await zip.loadAsync(file);
                const allFiles = Object.keys(zipInstance.files);
                let targetFile = allFiles.find(path => path.match(/\.qgs$/i) && !path.includes('__MACOSX'));
                if (!targetFile) targetFile = allFiles.find(path => path.match(/\.(txt|csv|xml)$/i) && !path.includes('__MACOSX'));
                if (!targetFile) throw new Error("Aucun fichier texte exploitable.");
                setNotification(`Lecture de ${targetFile}...`, 'info');
                const textContent = await zipInstance.files[targetFile].async("string");
                filePart = { text: textContent };
            } else if (isImage || isPdf) {
                 const base64Data = await fileToBase64(file);
                 filePart = { inlineData: { data: base64Data, mimeType: file.type || 'application/octet-stream' } };
            } else {
                const textContent = await file.text();
                filePart = { text: textContent };
            }
            setNotification('Extraction par IA...', 'info');
            const extractedLayers = await extractPointsFromFile(filePart);
            if (extractedLayers.length > 0) {
                let lastNewParcelId: number | null = null;
                let totalPoints = 0;
                extractedLayers.forEach(layer => {
                    if (layer.points.length > 0) {
                        const newParcel = parcelManager.addParcel(layer.layerName || 'Import IA', layer.points);
                        lastNewParcelId = newParcel.id;
                        totalPoints += layer.points.length;
                    }
                });
                if (lastNewParcelId) setActiveParcelId(lastNewParcelId);
                setNotification(`${extractedLayers.length} parcelles importées.`, 'success');
            } else { setNotification("Aucune donnée valide trouvée.", 'info'); }
        } catch (e: any) { setNotification(`Erreur: ${e.message}`, 'error'); } finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
    };

    const handleToggleImportedLayer = (id: string) => {
        setImportedLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
    };

    const handleMapClick = useCallback((wgs: { x: number; y: number }, map: L.Map, snapped?: Point) => {
        if (contextMenu) setContextMenu(null);
        if (activeTool === 'point') return; // En mode point, on utilise le bouton central, pas le clic carte

        const coords = snapped ? { x: snapped.x, y: snapped.y } : wgs;

        if (movingPointId !== null && activeParcelId !== null) {
            const appCoords = settings.coordinateSystem === 'wgs84' ? coords : coordinateTransformationService.transform(coords, 'wgs84', settings.coordinateSystem);
            if (appCoords) {
                parcelManager.updatePoint(activeParcelId, movingPointId, appCoords);
                setMovingPointId(null);
                setNotification("Borne déplacée avec succès", "success");
            }
            return;
        }

        if (activeTool === 'polygon' || activeTool === 'measure_area') {
            if (currentDrawingPoints.length >= 3) {
                const first = currentDrawingPoints[0];
                const screenFirst = map.latLngToContainerPoint(L.latLng(first.y, first.x));
                const screenCurr = map.latLngToContainerPoint(L.latLng(wgs.y, wgs.x));
                if (screenFirst.distanceTo(screenCurr) < 15) {
                    if (activeTool === 'polygon') {
                        const appPts = currentDrawingPoints.map(p => {
                            if (settings.coordinateSystem === 'wgs84') return p;
                            return coordinateTransformationService.transform(p, 'wgs84', settings.coordinateSystem);
                        }).filter((p): p is {x:number, y:number} => !!p);
                        const p = parcelManager.addParcel(undefined, appPts);
                        setActiveParcelId(p.id);
                        setNotification("Nouvelle parcelle créée", "success");
                    }
                    setCurrentDrawingPoints([]);
                    setActiveTool('pan');
                    return;
                }
            }
            setCurrentDrawingPoints(prev => [...prev, coords]);
        } else if (activeTool === 'measure_line') {
            setCurrentDrawingPoints(prev => [...prev, coords]);
        } else if (activeTool === 'annotation') {
            setPendingAnnotation(coords);
        }
    }, [activeTool, currentDrawingPoints, settings, activeParcelId, parcelManager, contextMenu, setNotification, setActiveParcelId, movingPointId]);

    const handleMapContextMenu = useCallback((event: L.LeafletMouseEvent, entity?: any) => {
        event.originalEvent.preventDefault();
        const { clientX, clientY } = event.originalEvent;
        const map = (event.target as any)._map || event.target;
        let options = [];
        
        if (entity && 'isAnnotation' in entity) {
            options = [
                { 
                    label: 'Supprimer l\'annotation', 
                    action: () => setAnnotations(prev => prev.filter(a => a.id !== entity.id)), 
                    icon: 'delete' 
                }
            ];
        } else if (entity && 'points' in entity) {
            const originalParcel = parcels.find(p => p.id === entity.id) || entity;
            options = [
                { label: 'Détails de la parcelle', action: () => setSelectedParcelForDetails(originalParcel), icon: 'plan' }, 
                { label: 'Activer la parcelle', action: () => setActiveParcelId(entity.id), icon: 'edit' }
            ];
        } else if (entity && 'id' in entity) {
            options = [
                { label: 'Déplacer la borne', action: () => { setMovingPointId(entity.id); setNotification("Cliquez sur la nouvelle position", "info"); }, icon: 'center' },
                { label: 'Prendre Photo', action: () => setPhotoTargetPointId(entity.id), icon: 'camera' }, 
                { label: 'Supprimer Borne', action: () => parcelManager.deletePoint(activeParcelId!, entity.id), icon: 'delete' }
            ];
        } else {
            options = [{ label: 'Centrer ici', action: () => map.panTo(event.latlng), icon: 'center' }];
        }
        setContextMenu({ x: clientX, y: clientY, options, entity });
    }, [activeParcelId, parcelManager, setNotification, parcels, setAnnotations]);

    return (
        <div className="flex w-full h-full relative">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".qgz,.zip,.kml,.kmz,.gpx,.geojson,image/*,.pdf,.qgs" />
            <Map 
                parcels={parcelsForMap}
                activeParcelId={activeParcelId}
                annotations={annotationsForMap}
                settings={settings} 
                onMapClick={handleMapClick} 
                onMapContextMenu={handleMapContextMenu}
                onSelectParcel={(id) => setActiveParcelId(id)}
                onUpdatePoint={(id, coords) => parcelManager.updatePoint(activeParcelId!, id, coords)}
                onStartMovingPoint={(id) => { setMovingPointId(id); setNotification("Cliquez sur la nouvelle position", "info"); }}
                onDeletePoint={(id) => parcelManager.deletePoint(activeParcelId!, id)}
                layersVisibility={layersVisibility}
                activeTool={activeTool}
                measurePoints={currentDrawingPoints}
                highlightedPointId={highlightedPointId}
                movingPointId={movingPointId}
                setNotification={setNotification}
                goTo={effectiveGoTo}
                fitToParcel={fitToParcel}
                isDrawing={currentDrawingPoints.length > 0}
                pendingAnnotation={pendingAnnotation}
                onSaveNewAnnotation={(text) => {
                    if (text && pendingAnnotation) {
                        const app = coordinateTransformationService.transform(pendingAnnotation, 'wgs84', settings.coordinateSystem);
                        if (app) setAnnotations(prev => [...prev, { id: Date.now(), ...app, text }]);
                    }
                    setPendingAnnotation(null);
                    setActiveTool('pan');
                }}
                onCenterChange={handleCenterChange}
                onMouseMove={handleMouseMove}
                onMapMove={handleMapMove}
                isTracking={isTracking}
                onTrackingChange={setIsTracking}
                importedLayers={importedLayers}
                trackingLine={trackingLine}
            />
            
            {activeTool !== 'point' && (
                <>
                    <MapSearchControl 
                        onOpenGoTo={onOpenGoToModal}
                        onStartBornage={() => {
                            setActiveTool('point');
                            setNotification("Mode Bornage activé. Placez la cible et cliquez sur +", "info");
                        }}
                        showBornageButton={!isLocalSystem}
                    />
                    
                    {currentView === 'MAP' && activeParcel && isInfoPanelVisible && (
                        <ActiveParcelInfoPanel 
                            parcel={activeParcel} 
                            results={props.results} 
                            settings={settings} 
                            onClose={() => setIsInfoPanelVisible(false)}
                            onOpenDetails={() => setSelectedParcelForDetails(activeParcel)}
                        />
                    )}
                    
                    <div className="absolute top-6 right-6 z-[401]">
                        <MapControlPanel
                            parcels={parcels}
                            parcelManager={parcelManager}
                            settings={settings}
                            onSettingsChange={onSettingsChange}
                            visibility={layersVisibility}
                            setVisibility={setLayersVisibility}
                            isPanelOpen={isPanelOpen}
                            setIsPanelOpen={setIsPanelOpen}
                            onClearSketch={() => setCurrentDrawingPoints([])}
                            activeTool={activeTool}
                            onToolSelect={(tool) => { 
                                setActiveTool(tool); 
                                setCurrentDrawingPoints([]); 
                                setMovingPointId(null);
                                if (tool !== 'pan') setIsPanelOpen(false); 
                            }}
                            isTracking={isTracking}
                            onTrackingChange={setIsTracking}
                            onImportClick={handleImportClick}
                            importedLayers={importedLayers}
                            onToggleImportedLayer={handleToggleImportedLayer}
                        />
                    </div>
                </>
            )}

            {activeTool === 'point' && (
                <>
                    {/* Center Crosshair - Professional Surveying Reticle */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[400] pointer-events-none">
                        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {/* Outer Circle */}
                            <circle cx="30" cy="30" r="28" stroke="white" strokeWidth="1.5" className="drop-shadow-md opacity-80"/>
                            <circle cx="30" cy="30" r="28" stroke="black" strokeWidth="1.5" strokeDasharray="4 4" className="opacity-50"/>
                            
                            {/* Inner Circle */}
                            <circle cx="30" cy="30" r="8" stroke="#ef4444" strokeWidth="1.5" className="drop-shadow-sm"/>
                            
                            {/* Crosshairs with gap */}
                            <line x1="30" y1="0" x2="30" y2="22" stroke="#ef4444" strokeWidth="1.5" className="drop-shadow-sm"/>
                            <line x1="30" y1="38" x2="30" y2="60" stroke="#ef4444" strokeWidth="1.5" className="drop-shadow-sm"/>
                            <line x1="0" y1="30" x2="22" y2="30" stroke="#ef4444" strokeWidth="1.5" className="drop-shadow-sm"/>
                            <line x1="38" y1="30" x2="60" y2="30" stroke="#ef4444" strokeWidth="1.5" className="drop-shadow-sm"/>
                            
                            {/* Center Dot */}
                            <circle cx="30" cy="30" r="1" fill="#ef4444" className="drop-shadow-sm"/>
                        </svg>
                    </div>

                    {/* Real-time Coordinates Bubble attached to Crosshair */}
                    <div className="absolute top-1/2 left-1/2 mt-8 -translate-x-1/2 z-[401] pointer-events-none">
                        <div className="bg-[#0F172A]/90 text-white px-3 py-1.5 rounded-full font-mono text-[10px] font-bold shadow-xl backdrop-blur-md border border-white/10 flex items-center gap-3 whitespace-nowrap">
                            <div className="flex gap-1">
                                <span className="text-slate-400">X:</span>
                                <span>{centerDisplayCoords.x.toFixed(settings.precision)}</span>
                            </div>
                            <div className="w-px h-3 bg-white/20"></div>
                            <div className="flex gap-1">
                                <span className="text-slate-400">Y:</span>
                                <span>{centerDisplayCoords.y.toFixed(settings.precision)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Controls Container */}
                    <div className="absolute bottom-8 left-0 right-0 z-[402] flex flex-col items-center gap-4 pointer-events-none px-4">
                        
                        {/* Buttons */}
                        <div className="flex items-center gap-4 sm:gap-6 mt-2 pointer-events-auto">
                            {/* Undo / Back */}
                            <button onClick={handleUndoPoint} className="w-12 h-12 sm:w-14 sm:h-14 bg-white text-gray-800 rounded-full shadow-xl flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                            </button>

                            {/* ADD Point with Photo */}
                            <button onClick={() => setIsCapturingPhotoForNewPoint(true)} className="w-12 h-12 sm:w-14 sm:h-14 bg-white text-gray-800 rounded-full shadow-xl flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all text-blue-600">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </button>

                            {/* ADD Point */}
                            <button onClick={() => handleAddCenterPoint()} className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all border-4 border-white/20">
                                <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            </button>

                            {/* Validate / Done */}
                            <button onClick={() => setActiveTool('pan')} className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            </button>
                        </div>
                    </div>
                </>
            )}

            {movingPointId && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[401] bg-[#4F46E5] text-white px-4 py-2 rounded-xl shadow-lg font-bold flex items-center gap-3 animate-bounce">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                    Mode Déplacement Actif
                    <button onClick={() => setMovingPointId(null)} className="ml-2 hover:bg-[#4338CA] rounded-lg p-1 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
            )}

            {!isLocalSystem && activeTool !== 'point' && <LiveMeasureDisplay data={liveData} settings={settings} />}
            
            {/* Affichage des coordonnées du curseur */}
            {cursorDisplayCoords && (
                <div className="absolute bottom-4 right-4 z-[400] pointer-events-none hidden sm:flex flex-col gap-1">
                    <div className="bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-md border border-[#F1F5F9]/50 dark:border-[#1E293B]/50 flex gap-3 text-[11px] font-mono font-bold text-[#4F46E5] dark:text-[#818CF8] uppercase">
                        <span>{settings.coordinateSystem.replace(/_/g, ' ')} X: {cursorDisplayCoords.x.toFixed(settings.precision)}</span>
                        <span>Y: {cursorDisplayCoords.y.toFixed(settings.precision)}</span>
                    </div>
                </div>
            )}

            {contextMenu && <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} />}
            {photoTargetPointId && <PhotoCaptureModal onCapture={img => {
                parcelManager.updatePoint(activeParcelId!, photoTargetPointId, { image: img } as any);
                setPhotoTargetPointId(null);
            }} onClose={() => setPhotoTargetPointId(null)} />}
            
            {isCapturingPhotoForNewPoint && (
                <PhotoCaptureModal 
                    onCapture={(img) => {
                        handleAddCenterPoint(img);
                        setIsCapturingPhotoForNewPoint(false);
                    }} 
                    onClose={() => setIsCapturingPhotoForNewPoint(false)} 
                />
            )}
            {selectedParcelForDetails && (
                <ParcelDetailsModal 
                    parcel={selectedParcelForDetails} 
                    settings={settings} 
                    onClose={() => setSelectedParcelForDetails(null)} 
                    parcelManager={parcelManager}
                />
            )}
        </div>
    );
};

export default MapView;
