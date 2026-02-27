
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
// CSS loaded via index.html
// import 'leaflet/dist/leaflet.css';
import { Parcel, Point, AppSettings, Annotation, MapTool, MapLayersVisibility, ImportedLayer } from '../types';
import { coordinateTransformationService } from '../services/coordinateTransformationService';

// Fix Leaflet default icons with CDN links
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapProps {
    parcels: Parcel[];
    activeParcelId: number | null;
    annotations: Annotation[];
    settings: AppSettings;
    onMapClick: (coords: { x: number; y: number }, map: L.Map, snapped?: Point) => void;
    onMapContextMenu: (event: L.LeafletMouseEvent, entity?: any) => void;
    onSelectParcel: (id: number) => void;
    onUpdatePoint: (id: number, coords: { x: number; y: number }) => void;
    onStartMovingPoint: (id: number) => void;
    onDeletePoint: (id: number) => void;
    layersVisibility: MapLayersVisibility;
    activeTool: MapTool;
    measurePoints: { x: number; y: number }[];
    highlightedPointId: number | null;
    movingPointId: number | null;
    setNotification: (message: string, type: any) => void;
    goTo?: { point: { x: number; y: number }, key: number } | null;
    fitToParcel?: { id: number; key: number } | null;
    isDrawing: boolean;
    pendingAnnotation: { x: number; y: number } | null;
    onSaveNewAnnotation: (text: string) => void;
    onCenterChange: (center: L.LatLng) => void;
    isTracking: boolean;
    onTrackingChange: (tracking: boolean) => void;
    importedLayers: ImportedLayer[];
    onMapDoubleClick?: (e: L.LeafletMouseEvent) => void;
    trackingLine?: { start: { x: number, y: number }, end: { x: number, y: number }, label: string } | null;
}

const Map: React.FC<MapProps> = React.memo(({
    parcels, activeParcelId, annotations, settings, onMapClick, onMapContextMenu,
    onSelectParcel, onUpdatePoint, onStartMovingPoint, onDeletePoint, layersVisibility,
    activeTool, measurePoints, highlightedPointId, movingPointId, setNotification,
    goTo, fitToParcel, isDrawing, pendingAnnotation, onSaveNewAnnotation, onCenterChange,
    isTracking, onTrackingChange, importedLayers, onMapDoubleClick, trackingLine
}) => {
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const layersRef = useRef<{
        baseLayer?: L.TileLayer;
        parcels: L.LayerGroup;
        points: L.LayerGroup;
        annotations: L.LayerGroup;
        measure: L.LayerGroup;
        imported: L.LayerGroup;
        tracking: L.LayerGroup;
        virtualLine: L.LayerGroup;
    }>({
        parcels: new L.LayerGroup(),
        points: new L.LayerGroup(),
        annotations: new L.LayerGroup(),
        measure: new L.LayerGroup(),
        imported: new L.LayerGroup(),
        tracking: new L.LayerGroup(),
        virtualLine: new L.LayerGroup(),
    });

    const [annotationInputVisible, setAnnotationInputVisible] = useState(false);
    const [annotationText, setAnnotationText] = useState("");
    const annotationInputRef = useRef<HTMLInputElement>(null);
    const coordsControlRef = useRef<L.Control & { _div?: HTMLElement } | null>(null);

    // Initialize Map
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        let initialCenter: [number, number] = [30.42, -9.60]; // Default center (Agadir approx)
        let initialZoom = 13;

        try {
            const savedState = localStorage.getItem('topogan-last-map-state');
            if (savedState) {
                const parsed = JSON.parse(savedState);
                if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
                    initialCenter = [parsed.lat, parsed.lng];
                    if (typeof parsed.zoom === 'number') {
                        initialZoom = parsed.zoom;
                    }
                    // If we restored the state, skip the initial fitToParcel
                    if (fitToParcel) {
                        lastFitKey.current = fitToParcel.key;
                    }
                }
            }
        } catch (e) {
            console.error("Failed to parse last map state", e);
        }

        const map = L.map(mapContainerRef.current, {
            center: initialCenter,
            zoom: initialZoom,
            zoomControl: false,
            attributionControl: false
        });

        L.control.zoom({ position: 'bottomright' }).addTo(map);
        L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
        L.control.attribution({ prefix: false }).addTo(map);

        // Add Layer Groups
        layersRef.current.parcels.addTo(map);
        layersRef.current.points.addTo(map);
        layersRef.current.annotations.addTo(map);
        layersRef.current.measure.addTo(map);
        layersRef.current.imported.addTo(map);
        layersRef.current.tracking.addTo(map);
        layersRef.current.virtualLine.addTo(map);

        mapRef.current = map;

        // Professional Coords Control
        const coordsControl = new L.Control({ position: 'bottomright' });
        coordsControl.onAdd = function() {
          const div = L.DomUtil.create('div', 'bg-white/90 dark:bg-[#1E293B]/90 text-[#0F172A] dark:text-white px-3 py-1.5 rounded-xl shadow-md font-mono text-xs font-bold border border-[#E2E8F0] dark:border-[#334155] backdrop-blur-sm pointer-events-none');
          div.innerHTML = "Initialisation...";
          (this as any)._div = div;
          return div;
        };
        coordsControl.addTo(map);
        coordsControlRef.current = coordsControl;

        // Resize Observer for responsiveness
        const resizeObserver = new ResizeObserver(() => {
            map.invalidateSize();
        });
        resizeObserver.observe(mapContainerRef.current);

        // Throttled Event Handling
        let moveTimeout: ReturnType<typeof setTimeout> | null = null;
        const handleMove = () => {
            if (moveTimeout) return;
            moveTimeout = setTimeout(() => {
                const center = map.getCenter();
                const zoom = map.getZoom();
                onCenterChange(center);
                localStorage.setItem('topogan-last-map-state', JSON.stringify({ lat: center.lat, lng: center.lng, zoom }));
                moveTimeout = null;
            }, 500);
        };
        map.on('moveend', handleMove); // Use moveend to avoid saving too often
        
        map.on('click', (e: L.LeafletMouseEvent) => {
            // Find closest point for snapping (simple implementation)
            let snapped: Point | undefined;
            if (activeTool !== 'pan') {
                let minDist = Infinity;
                parcels.forEach(p => {
                    p.points.forEach(pt => {
                        const dist = e.latlng.distanceTo([pt.y, pt.x]);
                        if (dist < 10) { 
                            if (dist < minDist) {
                                minDist = dist;
                                snapped = pt;
                            }
                        }
                    });
                });
            }
            onMapClick({ x: e.latlng.lng, y: e.latlng.lat }, map, snapped);
        });

        map.on('contextmenu', (e: L.LeafletMouseEvent) => onMapContextMenu(e));
        if (onMapDoubleClick) map.on('dblclick', (e) => onMapDoubleClick(e));

        return () => {
            map.off('moveend', handleMove);
            resizeObserver.disconnect();
            if (moveTimeout) clearTimeout(moveTimeout);
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Coordinate Display Update
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const updateCoords = (e: L.LeafletMouseEvent) => {
            if (!coordsControlRef.current?._div) return;
            const { coordinateSystem, precision } = settings;
            let html = '';
            if (coordinateSystem === 'wgs84') {
                html = `<div class="flex items-center gap-2"><span class="text-[10px] uppercase tracking-wider text-[#4F46E5]">WGS84</span><span>${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}</span></div>`;
            } else {
                const transformed = coordinateTransformationService.transform({ x: e.latlng.lng, y: e.latlng.lat }, 'wgs84', coordinateSystem);
                if (transformed) {
                    html = `<div class="flex items-center gap-2"><span class="text-[10px] uppercase tracking-wider text-[#4F46E5]">${coordinateSystem.replace(/_/g, ' ')}</span><span>X: ${transformed.x.toFixed(precision)} Y: ${transformed.y.toFixed(precision)}</span></div>`;
                }
            }
            coordsControlRef.current._div.innerHTML = html;
        };

        map.on('mousemove', updateCoords);
        return () => { map.off('mousemove', updateCoords); }
    }, [settings]);

    // Update Base Layer
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (layersRef.current.baseLayer) map.removeLayer(layersRef.current.baseLayer);

        let url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        let attribution = '&copy; OpenStreetMap';
        let maxZoom = 19;

        if (settings.mapTileLayer === 'satellite') {
            url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
            attribution = 'Tiles &copy; Esri';
        } else if (settings.mapTileLayer === 'google_hybrid') {
            url = 'http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}';
            attribution = 'Google';
            maxZoom = 22;
        } else if (settings.mapTileLayer === 'dark') {
            url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
            attribution = '&copy; CARTO';
        } else if (settings.mapTileLayer === 'terrain') {
            url = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
            attribution = '&copy; OpenTopoMap';
        }

        const layer = L.tileLayer(url, { attribution, maxZoom });
        layer.addTo(map);
        layer.bringToBack();
        layersRef.current.baseLayer = layer;
    }, [settings.mapTileLayer]);

    // Update Parcels & Points
    useEffect(() => {
        const { parcels: parcelLayer, points: pointLayer } = layersRef.current;
        
        // Optimisation: Au lieu de tout effacer, on pourrait différer, mais pour l'instant
        // on garde le clearLayers pour la simplicité, React.memo évite les appels fréquents.
        parcelLayer.clearLayers();
        pointLayer.clearLayers();

        if (layersVisibility.polygon) {
            parcels.forEach(p => {
                if (!p.isVisible || p.points.length < 2) return;
                const latlngs = p.points.map(pt => [pt.y, pt.x] as [number, number]);
                
                const style = { color: p.color, weight: 2, opacity: 1, fillOpacity: p.id === activeParcelId ? 0.2 : 0.1 };
                
                if (p.points.length >= 3) {
                    const polygon = L.polygon(latlngs, style);
                    polygon.on('click', (e) => { L.DomEvent.stopPropagation(e); onSelectParcel(p.id); });
                    polygon.on('contextmenu', (e) => onMapContextMenu(e, p));
                    parcelLayer.addLayer(polygon);
                } else {
                    const line = L.polyline(latlngs, style);
                    parcelLayer.addLayer(line);
                }
            });
        }

        if (layersVisibility.points) {
            parcels.forEach(p => {
                if (!p.isVisible) return;
                p.points.forEach((pt, idx) => {
                    const isHighlighted = pt.id === highlightedPointId;
                    const isMoving = pt.id === movingPointId;
                    
                    const marker = L.circleMarker([pt.y, pt.x], {
                        radius: isHighlighted ? 8 : 4,
                        color: isMoving ? '#f59e0b' : (isHighlighted ? '#ef4444' : p.color),
                        fillColor: '#fff',
                        fillOpacity: 1,
                        weight: 2
                    });

                    if (layersVisibility.points) {
                        marker.bindTooltip(`B${idx + 1}`, { 
                            permanent: true, 
                            direction: 'right', 
                            offset: [8, 0],
                            className: 'bg-transparent border-0 shadow-none text-xs font-bold text-[#0F172A] dark:text-white' 
                        });
                    }

                    marker.on('click', (e) => {
                        L.DomEvent.stopPropagation(e);
                        // Trigger simple map click or specific point logic if needed
                    });
                    marker.on('contextmenu', (e) => onMapContextMenu(e, pt));
                    pointLayer.addLayer(marker);
                });
            });
        }
    }, [parcels, activeParcelId, layersVisibility, highlightedPointId, movingPointId]);

    // Handle Virtual Tracking Line
    useEffect(() => {
        const layer = layersRef.current.virtualLine;
        layer.clearLayers();

        if (trackingLine) {
            const latlngs = [
                [trackingLine.start.y, trackingLine.start.x] as [number, number],
                [trackingLine.end.y, trackingLine.end.x] as [number, number]
            ];

            // Dotted line
            L.polyline(latlngs, {
                color: '#3b82f6',
                weight: 2,
                dashArray: '5, 10',
                opacity: 0.8
            }).addTo(layer);

            // Distance Label centered on the line (or near end)
            L.marker([trackingLine.end.y, trackingLine.end.x], {
                icon: L.divIcon({
                    className: 'bg-transparent',
                    html: `<div class="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap transform -translate-y-8 -translate-x-1/2">${trackingLine.label}</div>`,
                    iconSize: [0, 0]
                }),
                interactive: false
            }).addTo(layer);
        }
    }, [trackingLine]);

    // Update Annotations
    useEffect(() => {
        const layer = layersRef.current.annotations;
        layer.clearLayers();
        if (layersVisibility.annotations) {
            annotations.forEach(a => {
                const icon = L.divIcon({
                    className: 'bg-transparent',
                    html: `<div class="text-sm font-bold text-black dark:text-white whitespace-nowrap" style="transform: rotate(${a.rotation || 0}deg)">${a.text}</div>`
                });
                const marker = L.marker([a.y, a.x], { icon, interactive: true });
                marker.on('contextmenu', (e) => onMapContextMenu(e, a));
                layer.addLayer(marker);
            });
        }
    }, [annotations, layersVisibility]);

    // Handle Measure / Sketch
    useEffect(() => {
        const layer = layersRef.current.measure;
        layer.clearLayers();
        if (measurePoints.length > 0) {
            const latlngs = measurePoints.map(p => [p.y, p.x] as [number, number]);
            
            // Markers
            measurePoints.forEach(p => {
                L.circleMarker([p.y, p.x], { radius: 3, color: 'blue', fillColor: 'white', fillOpacity: 1 }).addTo(layer);
            });

            // Lines/Polygons
            if (activeTool === 'polygon' || activeTool === 'measure_area') {
                if (measurePoints.length > 2) {
                    L.polygon(latlngs, { color: 'blue', dashArray: '5, 5', fillOpacity: 0.1 }).addTo(layer);
                } else {
                    L.polyline(latlngs, { color: 'blue', dashArray: '5, 5' }).addTo(layer);
                }
            } else {
                L.polyline(latlngs, { color: 'blue', dashArray: '5, 5' }).addTo(layer);
            }
        }
    }, [measurePoints, activeTool]);

    // Handle Pending Annotation Input
    useEffect(() => {
        if (pendingAnnotation) {
            setAnnotationInputVisible(true);
            setAnnotationText("");
            setTimeout(() => annotationInputRef.current?.focus(), 100);
        } else {
            setAnnotationInputVisible(false);
        }
    }, [pendingAnnotation]);

    // Handle GoTo & FitToParcel
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !goTo) return;
        map.setView([goTo.point.y, goTo.point.x], 18, { animate: true });
        // Add a temporary pulsing marker
        const marker = L.circleMarker([goTo.point.y, goTo.point.x], { radius: 20, color: 'red', fill: false }).addTo(map);
        setTimeout(() => map.removeLayer(marker), 3000);
    }, [goTo]);

    const lastFitKey = useRef<number | null>(null);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !fitToParcel) return;
        
        // Only fit bounds if the key has changed (e.g., active parcel changed)
        // OR if mapAutoFit is enabled in settings
        if (lastFitKey.current === fitToParcel.key && !settings.mapAutoFit) return;
        
        const parcel = parcels.find(p => p.id === fitToParcel.id);
        if (parcel && parcel.points.length > 0) {
            const bounds = L.latLngBounds(parcel.points.map(p => [p.y, p.x]));
            map.fitBounds(bounds, { padding: [50, 50] });
            lastFitKey.current = fitToParcel.key;
        }
    }, [fitToParcel, parcels, settings.mapAutoFit]);

    // Handle Imported Layers
    useEffect(() => {
        const layer = layersRef.current.imported;
        layer.clearLayers();
        importedLayers.forEach(l => {
            if (!l.visible || !l.data) return;
            L.geoJSON(l.data, {
                style: { color: l.color, weight: 2 },
                pointToLayer: (feature, latlng) => {
                    return L.circleMarker(latlng, { radius: 4, color: l.color, fillColor: 'white', fillOpacity: 1 });
                }
            }).addTo(layer);
        });
    }, [importedLayers]);

    // Handle Geolocation Tracking
    useEffect(() => {
        const map = mapRef.current;
        const layer = layersRef.current.tracking;
        if (!map) return;

        if (isTracking) {
            const id = navigator.geolocation.watchPosition(
                (pos) => {
                    layer.clearLayers();
                    const { latitude, longitude, accuracy } = pos.coords;
                    const latlng = L.latLng(latitude, longitude);
                    
                    L.circle(latlng, { radius: accuracy, color: 'blue', fillOpacity: 0.1, weight: 1 }).addTo(layer);
                    L.circleMarker(latlng, { radius: 6, color: 'white', fillColor: 'blue', fillOpacity: 1 }).addTo(layer);
                    
                    map.panTo(latlng);
                },
                (err) => {
                    console.error("GPS Error", err);
                    setNotification("Erreur GPS: " + err.message, 'error');
                    onTrackingChange(false);
                },
                { enableHighAccuracy: true }
            );
            return () => navigator.geolocation.clearWatch(id);
        } else {
            layer.clearLayers();
        }
    }, [isTracking]);

    const handleAnnotationSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (annotationText.trim()) {
            onSaveNewAnnotation(annotationText.trim());
        } else {
            onSaveNewAnnotation(""); // Cancel
        }
    };

    return (
        <div className="relative w-full h-full">
            <div ref={mapContainerRef} className="w-full h-full z-0" style={{ cursor: activeTool === 'pan' ? 'grab' : 'crosshair' }} />
            
            {annotationInputVisible && pendingAnnotation && (
                <div 
                    className="absolute z-[1000] bg-white p-2 rounded shadow-lg transform -translate-x-1/2 -translate-y-full"
                    style={{ 
                        left: mapRef.current?.latLngToContainerPoint([pendingAnnotation.y, pendingAnnotation.x]).x,
                        top: mapRef.current?.latLngToContainerPoint([pendingAnnotation.y, pendingAnnotation.x]).y 
                    }}
                >
                    <form onSubmit={handleAnnotationSubmit}>
                        <input
                            ref={annotationInputRef}
                            type="text"
                            value={annotationText}
                            onChange={e => setAnnotationText(e.target.value)}
                            className="border p-1 text-sm rounded outline-none"
                            placeholder="Texte de l'annotation"
                            onKeyDown={e => e.key === 'Escape' && onSaveNewAnnotation("")}
                        />
                        <button type="submit" className="hidden">Save</button>
                    </form>
                </div>
            )}
        </div>
    );
});

export default Map;
