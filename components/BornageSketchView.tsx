
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { extent, drag, select, line as d3Line, curveLinearClosed, curveBasis, polygonContains } from 'd3';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { Point, CalculationResults, AppSettings, Notification, Parcel, Riverain } from '../types';
import { formatArea, convertDistance, getDistanceUnitLabel } from '../services/unitConversionService';
import { calculateDistanceBetweenPoints, calculateCentroid, calculateDistances, calculateBearing } from '../services/topographyService';
import { saveAndShareFile } from '../services/exportService';
import { calculateMappe } from '../services/mappeService';
import ContextMenu from './ContextMenu';

const printStyles = `
  @media print {
    .no-print { display: none !important; }
    body { background: white !important; margin: 0 !important; }
    .printable-area { 
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      transform: none !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      z-index: 100 !important;
    }
    @page {
      margin: 0;
      size: auto;
    }
  }
  .bornage-sketch-container {
    user-select: none;
    touch-action: none;
  }
  .draggable-item {
    position: absolute;
    z-index: 10;
    cursor: grab;
  }
  .draggable-item.dragging {
    cursor: grabbing;
    opacity: 0.8;
  }
  .visual-handle {
    z-index: 100;
  }
  .segment-hit-area {
    cursor: pointer;
    transition: all 0.2s;
    opacity: 0;
    stroke-linecap: round;
  }
  .segment-highlight {
    pointer-events: none;
    filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.8));
    stroke-dasharray: none !important;
  }
  .point-marker-group {
    cursor: pointer;
    pointer-events: auto;
  }
  .point-marker-group:hover path, .point-marker-group:hover rect {
    stroke: #3b82f6;
    stroke-width: 0.8;
  }
  .bornage-text-editor {
    scrollbar-width: none;
  }
  .bornage-text-editor::-webkit-scrollbar {
    display: none;
  }
  .riverain-label-active {
    background-color: rgba(59, 130, 246, 0.1);
    border-radius: 4px;
    padding: 2px;
    cursor: pointer !important;
  }
  @keyframes long-press-fill {
    from { stroke-dashoffset: 63; }
    to { stroke-dashoffset: 0; }
  }
  .long-press-indicator {
    pointer-events: none;
    transform: rotate(-90deg);
  }
  .long-press-indicator circle {
    fill: none;
    stroke: #3b82f6;
    stroke-width: 3;
    stroke-dasharray: 63; /* 2 * PI * r (r=10) */
    stroke-dashoffset: 63;
    animation: long-press-fill 0.5s linear forwards;
  }
  .point-pop {
    animation: point-pop-scale 0.3s ease-out;
  }
  @keyframes point-pop-scale {
    0% { transform: scale(1); }
    50% { transform: scale(1.8); }
    100% { transform: scale(1); }
  }
  /* Hide scrollbar for Chrome, Safari and Opera */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  /* Hide scrollbar for IE, Edge and Firefox */
  .no-scrollbar {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
  .parcel-path:hover {
    stroke-width: 0.5;
    stroke: #ef4444;
    filter: drop-shadow(0 0 2px rgba(239, 68, 68, 0.5));
  }
`;

const DIMENSIONS = {
    A4: { width: 210, height: 297 },
    A3: { width: 297, height: 420 },
    A2: { width: 420, height: 594 },
    A1: { width: 594, height: 841 }
};

const defaultStaticTexts = {
    st180D: 'S.T. 180 G',
    ancfccUsage: '(Usage exclusif par les Services de l\'A.N.C.F.C.C)',
    labelPropriete: 'Propriété dite :',
    labelRequisition: 'Réquisition N° :',
    labelSituation: 'Située à :',
    labelCroquisTitle: 'CROQUIS DE BORNAGE',
    labelEchelle: 'Echelle : 1/',
    labelContenance: 'Contenance :',
    labelAnnexePv: 'Annexé au P.V de bornage du',
    labelIngenieur: 'Ingénieur Géomètre Délégué ',
    labelMappe: 'Mappe de repérage au 1 :2000',
    labelCarte: 'Carte Topographique au 1 :50000',
};

const getDefaultPositions = () => ({
    labelPropriete: { top: '3%', left: '2%' },
    labelRequisition: { top: '5%', left: '2%' },
    labelSituation: { top: '7%', left: '2%' },
    st180D: { top: '3%', right: '5%', textAlign: 'right' },
    ancfccUsage: { top: '5.5%', right: '5%', textAlign: 'right' },
    labelCroquisTitle: { top: '8%', left: '25%', textAlign: 'center' },
    labelEchelle: { top: '10.5%', left: '45%', transform: 'translateX(-50%)' },
    echelle: { top: '10.5%', left: '50%' }, 
    northArrow: { top: '15%', left: '90%', transform: 'translateX(-50%)' },
    centroideCoords: { top: '15%', left: '88%', transform: 'translate(-100%, 0)', textAlign: 'right' },
    labelContenance: { top: '93%', left: '2%' },
    contenance: { top: '93%', left: '15%' },
    labelMappe: { top: '92%', left: '50%', textAlign: 'right', transform: 'translateX(-100%)' }, 
    mappe: { top: '92%', left: '51%' },
    labelCarte: { top: '95%', left: '50%', textAlign: 'right', transform: 'translateX(-100%)' },
    carte: { top: '95%', left: '51%' },
    labelAnnexePv: { top: '90%', left: '85%', transform: 'translateX(-50%)', textAlign: 'center' },
    labelIngenieur: { top: '95%', left: '85%', transform: 'translateX(-50%)', textAlign: 'center' },
    consistanceLabel: { top: '50%', left: '50%', textAlign: 'center', transform: 'translate(-50%, -50%)' }
});

const defaultStyles: Record<string, React.CSSProperties> = {
    st180G: { fontSize: '10pt', fontWeight: '900', fontFamily: 'Arial, Helvetica, sans-serif', letterSpacing: '1px', lineHeight: '1' },
    ancfccUsage: { fontSize: '8pt', fontStyle: 'italic', fontFamily: '"Times New Roman", Times, serif', color: '#000', lineHeight: '1.2' },
    labelPropriete: { fontSize: '10pt', fontWeight: 'bold', fontFamily: '"Times New Roman", Times, serif', lineHeight: '1.2', color: '#000' },
    propriete: { fontSize: '10pt', fontFamily: '"Times New Roman", Times, serif', lineHeight: '1.2', color: '#000' },
    labelSituation: { fontSize: '10pt', fontWeight: 'bold', fontFamily: '"Times New Roman", Times, serif', lineHeight: '1.2', color: '#000' },
    situation: { fontSize: '10pt', fontFamily: '"Times New Roman", Times, serif', lineHeight: '1.2', color: '#000' },
    labelRequisition: { fontSize: '10pt', fontWeight: 'bold', fontFamily: '"Times New Roman", Times, serif', lineHeight: '1.2', color: '#000' },
    requisition: { fontSize: '10pt', fontWeight: 'bold', fontFamily: '"Times New Roman", Times, serif', lineHeight: '1.2', color: '#000' },
    labelCroquisTitle: { fontSize: '18pt', fontWeight: '900', fontStyle: 'italic', fontFamily: 'Arial Black, Arial, sans-serif', textTransform: 'uppercase', letterSpacing: '2px', lineHeight: '1.2', color: '#000' },
    labelEchelle: { fontSize: '12pt', fontWeight: 'bold', fontFamily: '"Times New Roman", Times, serif', lineHeight: '1.2', color: '#000' },
    echelle: { fontSize: '12pt', fontWeight: 'bold', fontFamily: '"Times New Roman", Times, serif', lineHeight: '1.2', color: '#000' },
    labelContenance: { fontSize: '12pt', fontWeight: 'bold', fontFamily: '"Times New Roman", Times, serif', lineHeight: '1.2', color: '#000' },
    contenance: { fontSize: '14pt', fontWeight: 'bold', fontFamily: '"Times New Roman", Times, serif', lineHeight: '1.2', color: '#000' },
    labelMappe: { fontSize: '9pt', fontFamily: '"Times New Roman", Times, serif', lineHeight: '1.2', color: '#000' },
    mappe: { fontSize: '10pt', fontFamily: '"Times New Roman", Times, serif', fontWeight: 'bold', lineHeight: '1.2', color: '#000' },
    labelCarte: { fontSize: '9pt', fontFamily: '"Times New Roman", Times, serif', lineHeight: '1.2', color: '#000' },
    carte: { fontSize: '10pt', fontFamily: '"Times New Roman", Times, serif', fontWeight: 'bold', lineHeight: '1.2', color: '#000' },
    labelAnnexePv: { fontSize: '10pt', fontFamily: '"Times New Roman", Times, serif', lineHeight: '1.2', color: '#000' },
    date: { fontSize: '10pt', fontFamily: '"Times New Roman", Times, serif', marginTop: '2px', fontWeight: 'bold', lineHeight: '1.2', color: '#000' },
    labelIngenieur: { fontSize: '9pt', fontWeight: 'normal', fontFamily: '"Times New Roman", Times, serif', lineHeight: '1.2', color: '#000' },
    ingenieur: { fontSize: '10pt', fontStyle: 'italic', color: '#000', fontWeight: 'bold', fontFamily: '"Times New Roman", Times, serif', lineHeight: '1.2' },
    consistanceLabel: { 
        fontSize: '11pt', 
        fontWeight: 'bold', 
        fontFamily: '"Times New Roman", Times, serif', 
        color: '#000', 
        textTransform: 'uppercase', 
        textShadow: '1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 0 0 #fff, -1px 0 0 #fff, 0 1px 0 #fff, 0 -1px 0 #fff',
        pointerEvents: 'auto',
        cursor: 'grab'
    },
    centroideCoords: { fontSize: '8pt', fontFamily: '"Times New Roman", Times, serif', color: '#000', fontWeight: 'bold', whiteSpace: 'pre', lineHeight: '1.1' }
};

const isBuildingConsistance = (consistance: string) => {
    const built = ['RDC', 'R+1', 'R+2', 'R+3', 'R+4', 'R+5', 'S.S.R+..', 'VILLA', 'MAISON', 'BATIMENT'];
    return built.some(b => consistance.toUpperCase().includes(b));
};

const isFencedConsistance = (consistance: string) => {
    if (!consistance) return false;
    const text = consistance.toUpperCase();
    const clean = text.replace(/\./g, '').trim();
    return clean === 'TC' || text.includes('TERRAIN CLOTURE') || text.includes('TERRAIN CLÔTURÉ');
};

const isPublicWay = (text?: string) => {
    if (!text) return false;
    const ways = ['VOIE', 'RUE', 'AVENUE', 'BOULEVARD', 'BD', 'AV', 'CHEMIN', 'ROUTE', 'PISTE'];
    return ways.some(w => text.toUpperCase().includes(w));
};

const isNatureSimple = (text?: string) => {
    if (!text) return true;
    const simple = ['TN', 'T.N', 'TERRAIN NU', 'T.CULT', 'CULTURE', 'CULT'];
    return simple.some(s => text.toUpperCase().includes(s));
};

const getStrokeDashArray = (style: 'solid' | 'dashed' | 'dotted', width: number) => {
    switch (style) {
        case 'dashed': return `${width * 4},${width * 3}`;
        case 'dotted': return `${width * 1},${width * 3}`;
        default: return undefined;
    }
};

const EditableSketchText: React.FC<{
    text: string;
    onUpdate: (newText: string) => void;
    onCancel?: () => void;
    style: React.CSSProperties;
    className?: string;
    isSelected?: boolean;
    isEditing?: boolean;
    onEditStart?: () => void;
    multiline?: boolean;
    opaque?: boolean;
}> = ({ text, onUpdate, onCancel, style, className, isSelected, isEditing, onEditStart, multiline = false, opaque = false }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [localValue, setLocalValue] = useState(text);

    useEffect(() => {
        setLocalValue(text);
    }, [text, isEditing]);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
            autoResize();
        }
    }, [isEditing]);

    const autoResize = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = (textareaRef.current.scrollHeight) + 'px';
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && !multiline) {
            e.preventDefault();
            onUpdate(localValue);
        } else if (e.key === 'Escape') {
            setLocalValue(text);
            if (onCancel) onCancel();
        }
    };

    if (isEditing) {
        return (
            <textarea
                ref={textareaRef}
                value={localValue}
                onChange={e => {
                    setLocalValue(e.target.value);
                    autoResize();
                }}
                onBlur={() => onUpdate(localValue)}
                onKeyDown={handleKeyDown}
                className={`bornage-text-editor ${className || ''}`}
                style={{
                    ...style,
                    backgroundColor: '#fff',
                    border: '1px solid #3b82f6',
                    borderRadius: '2px',
                    padding: '1px 3px',
                    boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)',
                    resize: 'none',
                    overflow: 'hidden',
                    minWidth: '20px',
                    display: 'block',
                    outline: 'none',
                    zIndex: 100,
                    position: 'relative'
                }}
            />
        );
    }

    return (
        <div
            onDoubleClick={(e) => {
                e.stopPropagation();
                if(onEditStart) onEditStart();
            }}
            style={{ 
                ...style, 
                whiteSpace: style.whiteSpace || (multiline ? 'pre-wrap' : 'nowrap'),
                outline: 'none',
                minWidth: '10px',
                pointerEvents: 'auto',
                cursor: 'grab',
                padding: '1px 3px',
                backgroundColor: opaque ? '#fff' : 'transparent',
                border: isSelected ? '1px dashed #3b82f6' : '1px solid transparent'
            }} 
            className={`bornage-editable-field ${className || ''}`}
        >
            {text || <span className="opacity-30 italic">Texte...</span>}
        </div>
    );
};

type TextAlign = 'left' | 'center' | 'right' | 'justify';

interface CustomAnnotationState {
    id: number;
    x: string;
    y: string;
    width?: string;
    height?: string;
    text: string;
    fontSize?: number;
    rotation?: number;
    textAlign?: TextAlign;
    lineHeight?: number;
    opaque?: boolean;
}

interface BornageSketchViewProps {
    points: Point[];
    results: CalculationResults | null;
    settings: AppSettings;
    onClose: () => void;
    setNotification: (message: string, type: Notification['type']) => void;
    parcel?: Parcel;
    parcelManager?: any;
}

type SketchTool = 'freehand' | 'line' | 'rectangle' | 'circle';

interface DrawingObject {
    id: number;
    type: SketchTool;
    points?: [number, number][]; 
    geometry?: { cx: number, cy: number, r: number }; 
    color: string;
    width: number;
    style: 'solid' | 'dashed' | 'dotted';
}

interface SnapIndicator {
    x: number;
    y: number;
    type: 'vertex' | 'edge' | 'extension' | 'parallel';
    linePoints?: [number, number, number, number];
}

const BornageSketchView: React.FC<BornageSketchViewProps> = ({ points, results, settings, onClose, setNotification, parcel, parcelManager }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const zoomableViewportRef = useRef<HTMLDivElement>(null);
    const zoomableContentRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isAutoFit, setIsAutoFit] = useState(true);
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
    const [paperFormat, setPaperFormat] = useState<'A4' | 'A3' | 'A2' | 'A1'>('A4');
    const [showGrid, setShowGrid] = useState(false);
    const [addingText, setAddingText] = useState(false);
    const [hasSavedData, setHasSavedData] = useState(false);
    
    // Viewport state for Pan/Zoom
    const [viewScale, setViewScale] = useState(1.0);
    const [viewPosition, setViewPosition] = useState({ x: 0, y: 0 });
    const pointersRef = useRef<Map<number, { x: number, y: number }>>(new Map());
    const prevPinchDistRef = useRef<number | null>(null);
    
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [activeTool, setActiveTool] = useState<SketchTool>('freehand');
    const [drawings, setDrawings] = useState<DrawingObject[]>([]);
    const [isSnappingEnabled, setIsSnappingEnabled] = useState(true);
    const [snapIndicator, setSnapIndicator] = useState<SnapIndicator | null>(null);

    const [dragStart, setDragStart] = useState<[number, number] | null>(null);
    const [currentPointer, setCurrentPointer] = useState<[number, number] | null>(null);
    const [currentFreehandPath, setCurrentFreehandPath] = useState<[number, number][]>([]);
    const [drawingWidth, setDrawingWidth] = useState<number>(0.5);
    const [drawingStyle, setDrawingStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');
    const [isEraser, setIsEraser] = useState(false);

    const [elementPositions, setElementPositions] = useState<any>(getDefaultPositions());
    const [customAnnotations, setCustomAnnotations] = useState<CustomAnnotationState[]>([]);
    const [pointStyles, setPointStyles] = useState<Record<number, 'square' | 'cross'>>({});
    const [poppingPointId, setPoppingPointId] = useState<number | null>(null);
    const [selectedAnnotationId, setSelectedAnnotationId] = useState<number | null>(null);
    const [resizingAnnotation, setResizingAnnotation] = useState<{id: number, startX: number, startY: number, startWidth: number, startHeight: number, startFontSize: number} | null>(null);
    const [editingId, setEditingId] = useState<string | number | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; options: any[] } | null>(null);

    const [editingRiverainSegment, setEditingRiverainSegment] = useState<string | null>(null);
    const [highlightedSegment, setHighlightedSegment] = useState<string | null>(null);

    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [longPressActivePoint, setLongPressActivePoint] = useState<{ id: number, x: number, y: number } | null>(null);

    // --- Pointer Events Logic for Pan/Zoom ---
    const handleViewportPointerDown = useCallback((e: React.PointerEvent) => {
        // Ignorer si on dessine ou si on clique sur un item draggable
        if (isDrawingMode || (e.target as Element).closest('.draggable-item') || (e.target as Element).closest('.segment-hit-area')) return;
        
        (e.target as Element).setPointerCapture(e.pointerId);
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        
        if (pointersRef.current.size === 2) {
            // Initialiser distance pour pinch
            const points = Array.from(pointersRef.current.values()) as { x: number, y: number }[];
            prevPinchDistRef.current = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        }
    }, [isDrawingMode]);

    const handleViewportPointerMove = useCallback((e: React.PointerEvent) => {
        if (!pointersRef.current.has(e.pointerId)) return;
        
        // Mettre à jour la position du pointeur actuel
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        
        // Utilisation explicite d'un tableau typé pour éviter les erreurs d'inférence
        const points: { x: number; y: number }[] = [];
        pointersRef.current.forEach((val) => points.push(val));

        if (pointersRef.current.size === 1) {
            // PAN (Déplacement)
            const movementX = e.movementX;
            const movementY = e.movementY;
            setViewPosition(prev => ({ x: prev.x + movementX, y: prev.y + movementY }));
        } else if (pointersRef.current.size === 2 && points.length >= 2) {
            // PINCH (Zoom)
            const newDist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
            const prevDist = prevPinchDistRef.current;
            
            if (prevDist && prevDist > 0) {
                const center = {
                    x: (points[0].x + points[1].x) / 2,
                    y: (points[0].y + points[1].y) / 2
                };
                
                // Calculer le centre relatif au viewport
                const viewportRect = zoomableViewportRef.current?.getBoundingClientRect();
                if (viewportRect) {
                    const relativeCenter = {
                        x: center.x - viewportRect.left,
                        y: center.y - viewportRect.top
                    };

                    const factor = newDist / prevDist;
                    const newScale = Math.max(0.1, Math.min(viewScale * factor, 5));
                    
                    // Ajuster la position pour zoomer vers le centre des doigts
                    // Formule : P_new = P_mouse - (P_mouse - P_old) * (Scale_new / Scale_old)
                    const scaleRatio = newScale / viewScale;
                    
                    // On doit compenser le déplacement du point sous le centre
                    // Position actuelle du point sous le centre dans le référentiel de la feuille
                    const pointX = (relativeCenter.x - viewPosition.x) / viewScale;
                    const pointY = (relativeCenter.y - viewPosition.y) / viewScale;
                    
                    // Nouvelle position : on veut que (pointX * newScale + newPos) = relativeCenter
                    const newPosX = relativeCenter.x - pointX * newScale;
                    const newPosY = relativeCenter.y - pointY * newScale;

                    setViewScale(newScale);
                    setViewPosition({ x: newPosX, y: newPosY });
                }
            }
            prevPinchDistRef.current = newDist;
        }
    }, [viewScale, viewPosition]);

    const handleViewportPointerUp = useCallback((e: React.PointerEvent) => {
        pointersRef.current.delete(e.pointerId);
        if (pointersRef.current.size < 2) {
            prevPinchDistRef.current = null;
        }
        (e.target as Element).releasePointerCapture(e.pointerId);
    }, []);

    const perimeter = useMemo(() => {
        if (points.length < 2) return 0;
        const dists = calculateDistances(points, settings.coordinateSystem);
        return dists.reduce((acc, curr) => acc + curr.distance, 0);
    }, [points, settings.coordinateSystem]);

    const formatDate = (d?: string) => {
        if (!d) return new Date().toLocaleDateString('fr-FR');
        if (d.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [y, m, dDay] = d.split('-');
            return `${dDay}/${m}/${y}`;
        }
        return d;
    };

    const getReferenceDetails = (p?: Parcel) => {
        if (p?.titre && p.titre.trim().length > 0 && p.titre.replace(/^T\s*/i, '').trim().length > 0) {
            return { label: 'Titre N° :', value: p.titre || ''};
        }
        return { label: 'Réquisition N° :', value: p?.requisition || '' };
    };

    const initialRef = getReferenceDetails(parcel);

    const [staticTexts, setStaticTexts] = useState({
        ...defaultStaticTexts,
        labelRequisition: initialRef.label
    });
    const [propriete, setPropriete] = useState(parcel?.propriete || '');
    const [requisition, setRequisition] = useState(initialRef.value);
    const [situation, setSituation] = useState(parcel?.situation || '');
    const [echelle, setEchelle] = useState('500');
    const [contenance, setContenance] = useState('');
    const [mappe, setMappe] = useState('000');
    const [carte, setCarte] = useState('0.000');
    const [date, setDate] = useState(formatDate(parcel?.date));
    const [ingenieur, setIngenieur] = useState(parcel?.surveyor || '');
    const [consistanceValue, setConsistanceValue] = useState(parcel?.consistance || 'Nature');
    const [centroideLabelValue, setCentroideLabelValue] = useState('');
    const [pointLabels, setPointLabels] = useState<Record<number, string>>({});
    const [distanceLabels, setDistanceLabels] = useState<Record<string, string>>({});
    const [riverainsLabels, setRiverainsLabels] = useState<Record<string, string>>({});

    const getStoreKey = useCallback(() => parcel ? `topogan-sketch-parcel-${parcel.id}` : null, [parcel]);

    useEffect(() => {
        const key = getStoreKey();
        if (key) {
            setHasSavedData(!!localStorage.getItem(key));
        }
    }, [getStoreKey]);

    useEffect(() => {
        const c = calculateCentroid(points);
        if (c) {
            setCentroideLabelValue(`X=${c.x.toFixed(0)}\nY=${c.y.toFixed(0)}`);
            
            // Calcul automatique de la mappe au 1/2000
            const calculatedMappe = calculateMappe(c.x, c.y, '1/2000');
            if (calculatedMappe && !calculatedMappe.startsWith("Hors")) {
                 setMappe(prev => (prev === '000' || prev === '') ? calculatedMappe : prev);
            }
        } else {
            setCentroideLabelValue('');
        }
    }, [points]);

    // Détermination automatique de la Carte Topographique selon la Situation
    useEffect(() => {
        if (situation) {
            const sitUpper = situation.toUpperCase();
            // Si la situation contient Inezgane, Dcheira ou Ait Melloul -> AGADIR, sinon G.ADMINE
            const agadirKeywords = ['INEZGANE', 'DCHEIRA', 'AIT MELLOUL'];
            const newCarte = agadirKeywords.some(k => sitUpper.includes(k)) ? 'AGADIR' : 'G.ADMINE';
            
            setCarte(prev => (prev === '0.000' || prev === '' || prev === 'AGADIR' || prev === 'G.ADMINE') ? newCarte : prev);
        }
    }, [situation]);

    const handleSaveSketch = () => {
        const key = getStoreKey();
        if (!key) return;

        const dataToSave = {
            elementPositions,
            customAnnotations,
            drawings,
            pointStyles,
            texts: {
                staticTexts, propriete, requisition, situation, echelle, contenance, mappe, carte, date, ingenieur, pointLabels, distanceLabels, riverainsLabels, consistanceValue, centroideLabelValue
            },
            settings: {
                paperFormat, orientation, isAutoFit, showGrid
            }
        };
        try {
            localStorage.setItem(key, JSON.stringify(dataToSave));
            setHasSavedData(true);
            setNotification('Croquis sauvegardé pour cette parcelle.', 'success');
        } catch (e) {
            console.error(e);
            setNotification('Erreur lors de la sauvegarde.', 'error');
        }
    };

    const handleLoadSketch = () => {
        const key = getStoreKey();
        if (!key) return;

        try {
            const savedDataString = localStorage.getItem(key);
            if (savedDataString) {
                const savedData = JSON.parse(savedDataString);
                if (savedData.elementPositions) setElementPositions(savedData.elementPositions);
                if (savedData.customAnnotations) setCustomAnnotations(savedData.customAnnotations);
                if (savedData.drawings) setDrawings(savedData.drawings);
                if (savedData.pointStyles) setPointStyles(savedData.pointStyles);
                if (savedData.texts) {
                    const t = savedData.texts;
                    if (t.staticTexts) setStaticTexts(t.staticTexts);
                    if (t.propriete) setPropriete(t.propriete);
                    if (t.requisition) setRequisition(t.requisition);
                    if (t.situation) setSituation(t.situation);
                    if (t.echelle) setEchelle(t.echelle);
                    if (t.contenance) setContenance(t.contenance);
                    if (t.mappe) setMappe(t.mappe);
                    if (t.carte) setCarte(t.carte);
                    if (t.date) setDate(t.date);
                    if (t.ingenieur) setIngenieur(t.ingenieur);
                    if (t.pointLabels) setPointLabels(t.pointLabels);
                    if (t.distanceLabels) setDistanceLabels(t.distanceLabels);
                    if (t.riverainsLabels) setRiverainsLabels(t.riverainsLabels);
                    if (t.consistanceValue) setConsistanceValue(t.consistanceValue);
                    if (t.centroideLabelValue) setCentroideLabelValue(t.centroideLabelValue);
                }
                if (savedData.settings) {
                    const s = savedData.settings;
                    if (s.paperFormat) setPaperFormat(s.paperFormat);
                    if (s.orientation) setOrientation(s.orientation);
                    if (s.isAutoFit !== undefined) setIsAutoFit(s.isAutoFit);
                    if (s.showGrid !== undefined) setShowGrid(s.showGrid);
                }
                setNotification('Croquis restauré avec succès.', 'success');
            }
        } catch (e) {
            console.error(e);
            setNotification('Impossible de restaurer le croquis.', 'error');
        }
    };

    const { pageDimensions, drawingArea } = useMemo(() => {
        const baseDims = DIMENSIONS[paperFormat];
        const dims = orientation === 'portrait'
            ? { width: baseDims.width, height: baseDims.height }
            : { width: baseDims.height, height: baseDims.width };
        const area = {
            x: dims.width * 0.10,
            y: dims.height * 0.25,
            width: dims.width * 0.8,
            height: dims.height * 0.55 
        };
        return { pageDimensions: dims, drawingArea: area };
    }, [orientation, paperFormat]);

    useEffect(() => {
        const pLabels: Record<number, string> = {};
        points.forEach((p, i) => { pLabels[p.id] = `B${i + 1}`; });
        setPointLabels(prev => ({...pLabels, ...prev}));

        const dLabels: Record<string, string> = {};
        if (points.length > 1) {
            const isClosed = points.length > 2;
            const numSegments = isClosed ? points.length : points.length - 1;
            for (let i = 0; i < numSegments; i++) {
                const p1 = points[i];
                const p2 = isClosed ? points[(i + 1) % points.length] : points[i + 1];
                const key = `${p1.id}-${p2.id}`;
                const dist = calculateDistanceBetweenPoints(p1, p2, settings.coordinateSystem);
                dLabels[key] = `(${dist.toFixed(settings.precision)})`;
            }
        }
        setDistanceLabels(prev => ({...dLabels, ...prev}));
        if (results && !contenance) setContenance(formatArea(results.area, settings.areaUnit, 0));
    }, [points, settings, results, contenance]);

    const plotData = useMemo(() => {
        if (points.length < 1) return null;

        const xDomain = extent(points, p => p.x) as [number, number];
        const yDomain = extent(points, p => p.y) as [number, number];
        const domainWidth = xDomain[1] - xDomain[0];
        const domainHeight = yDomain[1] - yDomain[0];

        let numericScale = parseFloat(echelle);
        
        if (isAutoFit && domainWidth > 0 && domainHeight > 0) {
            if (results && results.area > 0) {
                const areaVal = results.area;
                if (areaVal < 100) numericScale = 100;
                else if (areaVal < 500) numericScale = 200;
                else if (areaVal < 1000) numericScale = 500;
                else if (areaVal < 10000) numericScale = 1000;
                else if (areaVal < 100000) numericScale = 2000;
                else numericScale = 5000;
            } else {
                const scaleX = (domainWidth * 1000) / drawingArea.width;
                const scaleY = (domainHeight * 1000) / drawingArea.height;
                const rawScale = Math.max(scaleX, scaleY);
                const standardScales = [100, 200, 500, 1000, 1500, 2000, 2500, 5000, 20000];
                numericScale = standardScales.find(s => s >= rawScale) || Math.ceil(rawScale / 100) * 100;
            }
        }

        const scaleFactor = 1000 / numericScale;
        const centerX = (xDomain[0] + xDomain[1]) / 2;
        const centerY = (yDomain[0] + yDomain[1]) / 2;
        const offsetX = drawingArea.x + drawingArea.width / 2;
        const offsetY = drawingArea.y + drawingArea.height / 2;

        const transform = (p: Point) => ({
            x: (p.x - centerX) * scaleFactor + offsetX,
            y: -(p.y - centerY) * scaleFactor + offsetY
        });

        const projectedPoints = points.map(p => ({ ...p, screen: transform(p) }));
        const polygonCoordinates: [number, number][] = projectedPoints.map(p => [p.screen.x, p.screen.y]);
        
        const polyPoints = projectedPoints.map(p => ({ x: p.screen.x, y: p.screen.y }));
        let screenCentroid = { x: offsetX, y: offsetY };
        if (polyPoints.length >= 3) {
            const c = calculateCentroid(polyPoints.map((p, i) => ({ x: p.x, y: p.y, id: i }))); 
            if (c) screenCentroid = c;
        }

        const pointData: any[] = [];
        const labelOffsetDist = 5;
        projectedPoints.forEach((curr, i) => {
            let labelPos = { x: curr.screen.x, y: curr.screen.y - 4 }; 
            if (projectedPoints.length > 2) {
                const prev = projectedPoints[(i - 1 + projectedPoints.length) % projectedPoints.length];
                const next = projectedPoints[(i + 1) % projectedPoints.length];
                const v1 = { x: curr.screen.x - prev.screen.x, y: curr.screen.y - prev.screen.y };
                const v2 = { x: curr.screen.x - next.screen.x, y: curr.screen.y - next.screen.y };
                const d1 = Math.sqrt(v1.x*v1.x + v1.y*v1.y);
                const d2 = Math.sqrt(v2.x*v2.x + v2.y*v2.y);
                if (d1 > 0 && d2 > 0) {
                    const v1n = { x: v1.x/d1, y: v1.y/d1 };
                    const v2n = { x: v2.x/d2, y: v2.y/d2 };
                    let bx = v1n.x + v2n.x;
                    let by = v1n.y + v2n.y;
                    const db = Math.sqrt(bx*bx + by*by);
                    if (db > 0.001) {
                        bx /= db; by /= db;
                        const testPointInside: [number, number] = [curr.screen.x + bx * 0.1, curr.screen.y + by * 0.1];
                        if (!polygonContains(polygonCoordinates, testPointInside)) { bx = -bx; by = -by; }
                        labelPos = { x: curr.screen.x + bx * labelOffsetDist, y: curr.screen.y + by * labelOffsetDist };
                    }
                }
            }
            pointData.push({ ...curr, labelPos });
        });

        const distanceData: any[] = [];
        const isClosed = points.length > 2;
        const numSegments = isClosed ? points.length : points.length - 1;
        for (let i = 0; i < numSegments; i++) {
            const p1 = projectedPoints[i];
            const p2 = projectedPoints[(i + 1) % projectedPoints.length];
            const key = `${p1.id}-${p2.id}`;
            const mid = { x: (p1.screen.x + p2.screen.x)/2, y: (p1.screen.y + p2.screen.y)/2 };
            const dx = p2.screen.x - p1.screen.x;
            const dy = p2.screen.y - p1.screen.y;
            let rotation = Math.atan2(dy, dx) * 180 / Math.PI;
            if (rotation > 90) rotation -= 180;
            if (rotation < -90) rotation += 180;
            const perp = { x: -dy, y: dx };
            const dPerp = Math.sqrt(perp.x*perp.x + perp.y*perp.y);
            let ox = (perp.x/dPerp);
            let oy = (perp.y/dPerp);
            const testPointDist: [number, number] = [mid.x + ox * 0.1, mid.y + oy * 0.1];
            if (!polygonContains(polygonCoordinates, testPointDist)) { ox = -ox; oy = -oy; }
            const offsetDist = 3; 
            const offset = { x: ox * offsetDist, y: oy * offsetDist };
            distanceData.push({ key, labelPos: { x: mid.x + offset.x, y: mid.y + offset.y }, rotation });
        }

        const mitoyenneLines: {p1: {x:number, y:number}, p2: {x:number, y:number}}[] = [];
        const constructionInnerLines: {p1: {x:number, y:number}, p2: {x:number, y:number}}[] = [];
        const riverainLines: {p1: {x:number, y:number}, p2: {x:number, y:number}, strokeDasharray?: string, strokeWidth?: number}[] = [];
        const riverainLimitLines: {p1: {x:number, y:number}, p2: {x:number, y:number}, style?: 'solid' | 'dashed'}[] = [];
        const roadSegments = new Set<string>();
        const riverainData: any[] = [];
        const fencedInnerLines: {p1: {x:number, y:number}, p2: {x:number, y:number}}[] = [];

        const isParcelBuilt = consistanceValue && isBuildingConsistance(consistanceValue);
        const isParcelFenced = consistanceValue && isFencedConsistance(consistanceValue);
        
        const autoPointStyles: Record<number, 'square' | 'cross'> = {};
        projectedPoints.forEach((pt, i) => { autoPointStyles[pt.id] = isParcelBuilt ? 'cross' : 'square'; });

        for (let i = 0; i < projectedPoints.length; i++) {
            const nextIdx = (i + 1) % projectedPoints.length;
            const p1 = projectedPoints[i];
            const p2 = projectedPoints[nextIdx];
            const segmentLabel = `B${i + 1} - B${nextIdx + 1}`;
            const riv = parcel?.riverains?.find(r => r.segmentLabel === segmentLabel);
            const isWay = riv ? (isPublicWay(riv.name) || isPublicWay(riv.consistance)) : false;
            const isNatureSimpleVal = riv ? (isNatureSimple(riv.consistance) || isNatureSimple(riv.name)) : true;
            const dx = p2.screen.x - p1.screen.x;
            const dy = p2.screen.y - p1.screen.y;
            const segmentLen = Math.sqrt(dx * dx + dy * dy);
            const ux = dx / segmentLen;
            const uy = dy / segmentLen;
            const perp = { x: -dy, y: dx };
            const dPerp = Math.sqrt(perp.x*perp.x + perp.y*perp.y);
            let ox = (perp.x/dPerp);
            let oy = (perp.y/dPerp);
            const mid = { x: (p1.screen.x + p2.screen.x)/2, y: (p1.screen.y + p2.screen.y)/2 };
            if (!polygonContains(polygonCoordinates, [mid.x + ox * 0.1, mid.y + oy * 0.1])) { ox = -ox; oy = -oy; }
            if (!isWay) {
                if (isParcelBuilt) {
                    const inX = ox; const inY = oy;
                    const cOffset = 2.0;
                    constructionInnerLines.push({ p1: { x: p1.screen.x + inX * cOffset, y: p1.screen.y + inY * cOffset }, p2: { x: p2.screen.x + inX * cOffset, y: p2.screen.y + inY * cOffset } });
                    autoPointStyles[p1.id] = 'cross'; autoPointStyles[p2.id] = 'cross';
                } else if (isParcelFenced) {
                    const inX = ox; const inY = oy;
                    const cOffset = 2.0;
                    fencedInnerLines.push({ p1: { x: p1.screen.x + inX * cOffset, y: p1.screen.y + inY * cOffset }, p2: { x: p2.screen.x + inX * cOffset, y: p2.screen.y + inY * cOffset } });
                }
                if (riv && !isNatureSimpleVal) {
                    const outX = -ox; const outY = -oy; const rOffset = 2.0;
                    const cUpper = riv.consistance.toUpperCase();
                    const normC = cUpper.replace(/\./g, '').trim();
                    const isTC = normC === 'TC' || cUpper.includes('TERRAIN CLOTURE') || cUpper.includes('TERRAIN CLÔTURÉ');
                    
                    const dashStyle = isTC ? undefined : "1, 0.5";
                    const lineThickness = isTC ? 0.1 : 0.2;

                    riverainLines.push({ 
                        p1: { x: p1.screen.x + outX * rOffset, y: p1.screen.y + outY * rOffset }, 
                        p2: { x: p2.screen.x + outX * rOffset, y: p2.screen.y + outY * rOffset }, 
                        strokeDasharray: dashStyle,
                        strokeWidth: lineThickness
                    });
                    
                    if (riv.showLimitLines !== false) {
                        const limitLength = 15.0;
                        const dir = riv.limitDirection || 'both';
                        if (dir === 'both' || dir === 'start') riverainLines.push({ p1: { x: p1.screen.x + outX * rOffset, y: p1.screen.y + outY * rOffset }, p2: { x: p1.screen.x - ux * limitLength + outX * rOffset, y: p1.screen.y - uy * limitLength + outY * rOffset }, strokeDasharray: dashStyle, strokeWidth: lineThickness });
                        if (dir === 'both' || dir === 'end') riverainLines.push({ p1: { x: p2.screen.x + outX * rOffset, y: p2.screen.y + outY * rOffset }, p2: { x: p2.screen.x + ux * limitLength + outX * rOffset, y: p2.screen.y + uy * limitLength + outY * rOffset }, strokeDasharray: dashStyle, strokeWidth: lineThickness });
                    }
                }
                if (riv?.isMitoyenne) {
                    const inX = ox; const inY = oy;
                    const mOffset = 2.0; 
                    mitoyenneLines.push({ p1: { x: p1.screen.x + inX * mOffset, y: p1.screen.y + inY * mOffset }, p2: { x: p2.screen.x + inX * mOffset, y: p2.screen.y + inY * mOffset } });
                }
            }
            if (riv && riv.showLimitLines !== false) {
                const limitLength = 15.0;
                const dir = riv.limitDirection || 'both';
                if (dir === 'both' || dir === 'start') riverainLimitLines.push({ p1: p1.screen, p2: { x: p1.screen.x - ux * limitLength, y: p1.screen.y - uy * limitLength } });
                if (dir === 'both' || dir === 'end') riverainLimitLines.push({ p1: p2.screen, p2: { x: p2.screen.x + ux * limitLength, y: p2.screen.y + uy * limitLength } });
            }
            if (riv) {
                let rotation = Math.atan2(dy, dx) * 180 / Math.PI;
                if (rotation > 90) rotation -= 180; if (rotation < -90) rotation += 180;
                const labelOx = -ox; const labelOy = -oy;
                if (isWay) {
                    roadSegments.add(segmentLabel);
                    riverainData.push({ id: riv.id, type: 'name', labelPos: { x: mid.x + labelOx * 12, y: mid.y + labelOy * 12 }, rotation, textKey: `riverain-${riv.id}-name`, defaultText: riv.name, width: segmentLen, segmentLabel });
                } else {
                    riverainData.push({ id: riv.id, type: 'consistance', labelPos: { x: mid.x + labelOx * 8, y: mid.y + labelOy * 8 }, rotation, textKey: `riverain-${riv.id}-consistance`, defaultText: riv.consistance, width: segmentLen, segmentLabel });
                    riverainData.push({ id: riv.id, type: 'name', labelPos: { x: mid.x + labelOx * 16, y: mid.y + labelOy * 16 }, rotation, textKey: `riverain-${riv.id}-name`, defaultText: riv.name, width: segmentLen, segmentLabel });
                }
            }
        }
        return { projectedPoints, mitoyenneLines, constructionInnerLines, fencedInnerLines, riverainLines, riverainLimitLines, pointData, distanceData, riverainData, numericScale, transformParams: { centerX, centerY, scaleFactor, offsetX, offsetY }, screenCentroid, roadSegments, autoPointStyles };
    }, [points, echelle, isAutoFit, drawingArea, orientation, results, parcel, settings.coordinateSystem, settings.areaUnit, settings.precision, consistanceValue]);

    useEffect(() => {
        if (isAutoFit && plotData && plotData.numericScale.toString() !== echelle) setEchelle(plotData.numericScale.toString());
    }, [plotData, isAutoFit, echelle]);

    const handleZoom = useCallback((factor: number) => { 
        setViewScale(prev => Math.max(0.1, Math.min(prev * factor, 5))); 
    }, []);
    
    const handleResetView = useCallback(() => {
        const viewport = zoomableViewportRef.current; if (!viewport) return;
        const rect = viewport.getBoundingClientRect();
        const pageWidthPx = pageDimensions.width * 3.78; const pageHeightPx = pageDimensions.height * 3.78;
        const scaleW = (rect.width - 40) / pageWidthPx; const scaleH = (rect.height - 40) / pageHeightPx;
        setViewScale(Math.min(scaleW, scaleH, 1.2));
        setViewPosition({ x: 0, y: 0 }); // Reset Pan as well
    }, [pageDimensions]);

    useEffect(() => {
        const viewport = zoomableViewportRef.current; if (!viewport) return;
        const handleWheel = (e: WheelEvent) => { 
            if (e.ctrlKey) { 
                e.preventDefault(); 
                const delta = e.deltaY > 0 ? 0.9 : 1.1; 
                setViewScale(prev => Math.max(0.1, Math.min(prev * delta, 5))); 
            } 
        };
        viewport.addEventListener('wheel', handleWheel, { passive: false });
        return () => viewport.removeEventListener('wheel', handleWheel);
    }, []);

    useEffect(() => { const timer = setTimeout(handleResetView, 100); return () => clearTimeout(timer); }, [handleResetView]);

    useEffect(() => {
        const content = zoomableContentRef.current; if (!content || isDrawingMode) return;
        const dragBehavior = drag<HTMLElement, unknown>()
            .filter((e: any) => {
                if (e.target.closest('.resize-handle') || e.target.closest('.rotation-handle') || e.target.tagName === 'TEXTAREA' || e.target.closest('.annotation-controls')) return false;
                const isLeftClick = e.button === 0; const isTouch = e.button === undefined;
                return !e.target.isContentEditable && e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON' && (isLeftClick || isTouch);
            })
            .on('start', function(this: HTMLElement, event) { 
                event.sourceEvent.stopPropagation(); // Stop propagation to container panning
                select(this).classed('dragging', true); 
            })
            .on('drag', function(this: HTMLElement, event) {
                const currentLeft = parseFloat(this.style.left) || 0; const currentTop = parseFloat(this.style.top) || 0;
                const pageWidth = content.offsetWidth; const pageHeight = content.offsetHeight;
                if (pageWidth && pageHeight) {
                    const dxPercent = (event.dx / viewScale) / pageWidth * 100;
                    const dyPercent = (event.dy / viewScale) / pageHeight * 100;
                    this.style.left = `${currentLeft + dxPercent}%`; this.style.top = `${currentTop + dyPercent}%`;
                }
            })
            .on('end', function(this: HTMLElement) {
                select(this).classed('dragging', false);
                const id = this.getAttribute('data-drag-id');
                if (id) {
                    const isCustom = this.getAttribute('data-custom') === 'true';
                    if(isCustom) {
                         const idx = parseInt(id);
                         setCustomAnnotations(prev => {
                            const next = [...prev];
                            if(next[idx]) next[idx] = { ...next[idx], x: this.style.left, y: this.style.top };
                            return next;
                         });
                    } else {
                        setElementPositions((prev: any) => ({ ...prev, [id]: { ...prev[id], top: this.style.top, left: this.style.left, right: this.style.right } }));
                    }
                }
            });
        select(content).selectAll('.draggable-item').call(dragBehavior as any);
    }, [pageDimensions, elementPositions, customAnnotations, isDrawingMode, viewScale, selectedAnnotationId, editingId]);

    const getPaperCoords = (e: React.PointerEvent) => {
        if (!svgRef.current) return [0, 0];
        const svg = svgRef.current; const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
        try { const screenCTM = svg.getScreenCTM(); if (screenCTM) { const svgP = pt.matrixTransform(screenCTM.inverse()); return [svgP.x, svgP.y]; } } catch (error) { console.warn(error); }
        return [0, 0];
    };

    /**
     * Moteur d'accrochage avancé
     * Gère : Vertices, Edges, Prolongements (Extensions), Parallélisme
     */
    const getSnappedPosition = useCallback((rawX: number, rawY: number) => {
        if (!isSnappingEnabled || activeTool === 'freehand') { 
            setSnapIndicator(null); 
            return { x: rawX, y: rawY }; 
        }

        const SNAP_THRESHOLD = 3.5 / viewScale; 
        const PARALLEL_THRESHOLD = 2.0; // degrés de tolérance pour le parallélisme
        let closestDist = Infinity;
        let snapPos = { x: rawX, y: rawY };
        let snapType: 'vertex' | 'edge' | 'extension' | 'parallel' | null = null;
        let guideLine: [number, number, number, number] | undefined = undefined;

        // 1. Accrochage aux SOMMETS (Vertices)
        if (plotData) {
            for (const p of (plotData.projectedPoints as any[])) {
                const dx = rawX - p.screen.x;
                const dy = rawY - p.screen.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < SNAP_THRESHOLD && dist < closestDist) {
                    closestDist = dist;
                    snapPos = { x: p.screen.x, y: p.screen.y };
                    snapType = 'vertex';
                }
            }
        }
        for (const draw of drawings) {
            if (draw.points) {
                for (const pt of draw.points) {
                    const dx = rawX - pt[0];
                    const dy = rawY - pt[1];
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < SNAP_THRESHOLD && dist < closestDist) {
                        closestDist = dist;
                        snapPos = { x: pt[0], y: pt[1] };
                        snapType = 'vertex';
                    }
                }
            }
        }

        // 2. Accrochage aux SEGMENTS (Edges) & PROLONGEMENTS (Extensions)
        if (!snapType || closestDist > SNAP_THRESHOLD / 2) {
            const allSegments: [[number, number], [number, number]][] = [];
            if (plotData) {
                const pts = plotData.projectedPoints as any[];
                for (let i = 0; i < pts.length; i++) {
                    allSegments.push([[pts[i].screen.x, pts[i].screen.y], [pts[(i+1)%pts.length].screen.x, pts[(i+1)%pts.length].screen.y]]);
                }
            }
            for (const draw of drawings) {
                if (draw.points && (draw.type === 'line' || draw.type === 'rectangle')) {
                    for (let i = 0; i < draw.points.length - 1; i++) {
                        allSegments.push([draw.points[i], draw.points[i+1]]);
                    }
                }
            }

            for (const [p1, p2] of allSegments) {
                const dx = p2[0] - p1[0];
                const dy = p2[1] - p1[1];
                const lenSq = dx * dx + dy * dy;
                if (lenSq === 0) continue;

                // Projection sur la ligne infinie
                let t = ((rawX - p1[0]) * dx + (rawY - p1[1]) * dy) / lenSq;
                const projX = p1[0] + t * dx;
                const projY = p1[1] + t * dy;
                const dist = Math.sqrt((rawX - projX)**2 + (rawY - projY)**2);

                if (dist < SNAP_THRESHOLD) {
                    // Si t est entre 0 et 1, c'est un accrochage sur le segment réel
                    if (t >= 0 && t <= 1) {
                        if (dist < closestDist) {
                            closestDist = dist;
                            snapPos = { x: projX, y: projY };
                            snapType = 'edge';
                        }
                    } else {
                        // Sinon c'est un prolongement
                        if (dist < closestDist) {
                            closestDist = dist;
                            snapPos = { x: projX, y: projY };
                            snapType = 'extension';
                            // Guide infini : on dessine une grande ligne passant par p1, p2
                            guideLine = [p1[0] - dx * 10, p1[1] - dy * 10, p2[0] + dx * 10, p2[1] + dy * 10];
                        }
                    }
                }
            }
        }

        // 3. Accrochage PARALLELE (Seulement lors du dessin d'une ligne)
        if (dragStart && activeTool === 'line') {
            const currentAngle = Math.atan2(rawY - dragStart[1], rawX - dragStart[0]) * (180 / Math.PI);
            
            const allSegments: [[number, number], [number, number]][] = [];
            if (plotData) {
                const pts = plotData.projectedPoints as any[];
                for (let i = 0; i < pts.length; i++) {
                    allSegments.push([[pts[i].screen.x, pts[i].screen.y], [pts[(i+1)%pts.length].screen.x, pts[(i+1)%pts.length].screen.y]]);
                }
            }

            for (const [p1, p2] of allSegments) {
                const segAngle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * (180 / Math.PI);
                // On normalise les angles pour comparer les directions (indifférent du sens)
                const diff = Math.abs((currentAngle - segAngle + 180) % 180);
                const isParallel = diff < PARALLEL_THRESHOLD || Math.abs(180 - diff) < PARALLEL_THRESHOLD;

                if (isParallel) {
                    // On projette le point actuel pour qu'il respecte l'angle du segment de référence depuis dragStart
                    const rad = segAngle * (Math.PI / 180);
                    const currentDist = Math.sqrt((rawX - dragStart[0])**2 + (rawY - dragStart[1])**2);
                    const parallelX = dragStart[0] + currentDist * Math.cos(rad) * (Math.cos(diff * Math.PI / 180) > 0 ? 1 : -1);
                    const parallelY = dragStart[1] + currentDist * Math.sin(rad) * (Math.cos(diff * Math.PI / 180) > 0 ? 1 : -1);
                    
                    // On ne snap parallèlement que si on n'est pas déjà accroché à un vertex/edge plus proche
                    if (snapType !== 'vertex' && snapType !== 'edge') {
                        snapPos = { x: parallelX, y: parallelY };
                        snapType = 'parallel';
                        guideLine = [dragStart[0] - Math.cos(rad) * 1000, dragStart[1] - Math.sin(rad) * 1000, dragStart[0] + Math.cos(rad) * 1000, dragStart[1] + Math.sin(rad) * 1000];
                        break;
                    }
                }
            }
        }

        if (snapType) {
            setSnapIndicator({ x: snapPos.x, y: snapPos.y, type: snapType, linePoints: guideLine });
            return snapPos;
        } else {
            setSnapIndicator(null);
            return { x: rawX, y: rawY };
        }
    }, [isSnappingEnabled, plotData, drawings, viewScale, activeTool, dragStart]);

    const handlePointerDown = (e: React.PointerEvent) => { 
        if (!isDrawingMode || !zoomableContentRef.current) return; 
        (e.target as Element).setPointerCapture(e.pointerId); 
        const [rawX, rawY] = getPaperCoords(e); 
        const { x, y } = getSnappedPosition(rawX, rawY); 
        setDragStart([x, y]); 
        if (activeTool === 'freehand') setCurrentFreehandPath([[x, y]]); 
        else setCurrentPointer([x, y]); 
    };

    const handlePointerMove = (e: React.PointerEvent) => { 
        if (!isDrawingMode || !zoomableContentRef.current) return; 
        const [rawX, rawY] = getPaperCoords(e); 
        const { x, y } = getSnappedPosition(rawX, rawY); 
        if (dragStart) { 
            if (activeTool === 'freehand') setCurrentFreehandPath(prev => [...prev, [x, y]]); 
            else setCurrentPointer([x, y]); 
        } 
    };

    const handlePointerUp = (e: React.PointerEvent) => { 
        if (!isDrawingMode || !dragStart) return; 
        (e.target as Element).releasePointerCapture(e.pointerId); 
        const [rawX, rawY] = getPaperCoords(e); 
        const { x, y } = getSnappedPosition(rawX, rawY); 
        let newDrawing: DrawingObject | null = null; 
        const commonProps = { id: Date.now(), color: isEraser ? '#ffffff' : '#000000', width: isEraser ? drawingWidth * 4 : drawingWidth, style: isEraser ? 'solid' as const : drawingStyle }; 
        
        if (activeTool === 'freehand' && currentFreehandPath.length > 1) {
            newDrawing = { ...commonProps, type: 'freehand', points: currentFreehandPath }; 
        } else if (activeTool === 'line' && Math.sqrt(Math.pow(x - dragStart[0], 2) + Math.pow(y - dragStart[1], 2)) > 0.5) {
            newDrawing = { ...commonProps, type: 'line', points: [dragStart, [x, y]] }; 
        } else if (activeTool === 'rectangle' && Math.sqrt(Math.pow(x - dragStart[0], 2) + Math.pow(y - dragStart[1], 2)) > 0.5) { 
            const p1 = dragStart; const p3 = [x, y] as [number, number]; 
            const p2 = [p3[0], p1[1]] as [number, number]; 
            const p4 = [p1[0], p3[1]] as [number, number]; 
            newDrawing = { ...commonProps, type: 'rectangle', points: [p1, p2, p3, p4, p1] }; 
        } else if (activeTool === 'circle' && Math.sqrt(Math.pow(x - dragStart[0], 2) + Math.pow(y - dragStart[1], 2)) > 0.5) {
            newDrawing = { ...commonProps, type: 'circle', geometry: { cx: dragStart[0], cy: dragStart[1], r: Math.sqrt(Math.pow(x - dragStart[0], 2) + Math.pow(y - dragStart[1], 2)) } }; 
        }
        
        if (newDrawing) setDrawings(prev => [...prev, newDrawing!]); 
        setDragStart(null); setCurrentPointer(null); setCurrentFreehandPath([]); 
    };

    const handleUndoDrawing = () => setDrawings(prev => prev.slice(0, -1));
    const handleClearDrawings = () => { if (window.confirm("Tout effacer les dessins ?")) setDrawings([]); };
    const handleAddAnnotation = () => { setAddingText(true); setNotification('Cliquez sur le plan pour placer le texte', 'info'); };
    const handleEraserToggle = () => { setIsEraser(!isEraser); if (!isEraser) setActiveTool('freehand'); };

    const onPaperClick = (e: React.MouseEvent) => {
        if (isDrawingMode) return;
        if ((e.target as HTMLElement).classList.contains('bornage-sketch-container') || (e.target as HTMLElement).tagName === 'svg') { setSelectedAnnotationId(null); setContextMenu(null); setEditingId(null); }
        if (!addingText || !zoomableContentRef.current) return;
        const rect = zoomableContentRef.current.getBoundingClientRect(); const xPct = ((e.clientX - rect.left) / rect.width) * 100; const yPct = ((e.clientY - rect.top) / rect.height) * 100;
        let initialRotation = 0;
        if (plotData && plotData.projectedPoints.length > 1) {
            const [rawX, rawY] = [ (e.clientX - rect.left) / viewScale, (e.clientY - rect.top) / viewScale ];
            let closestSegDist = 15; for (let i = 0; i < plotData.projectedPoints.length; i++) { const p1 = plotData.projectedPoints[i].screen; const p2 = plotData.projectedPoints[(i + 1) % plotData.projectedPoints.length].screen; const dx = p2.x - p1.x; const dy = p2.y - p1.y; const lenSq = dx*dx + dy*dy; if(lenSq === 0) continue; let t = ((rawX - p1.x) * dx + (rawY - p1.y) * dy) / lenSq; t = Math.max(0, Math.min(1, t)); const projX = p1.x + t * dx; const projY = p1.y + t * dy; const dist = Math.sqrt((rawX - projX)**2 + (rawY - projY)**2); if (dist < closestSegDist) { closestSegDist = dist; let angle = Math.atan2(dy, dx) * (180 / Math.PI); if (angle > 90) angle -= 180; if (angle < -90) angle += 180; initialRotation = angle; } }
        }
        const newId = Date.now(); setCustomAnnotations(prev => [...prev, { id: newId, x: `${xPct}%`, y: `${yPct}%`, width: '120px', height: 'auto', text: '', fontSize: 10, rotation: initialRotation, textAlign: 'left', lineHeight: 1.2, opaque: false }]);
        setSelectedAnnotationId(newId); setEditingId(newId); setAddingText(false); setNotification('', 'info');
    };

    const togglePointStyle = (id: number) => { setPointStyles(prev => { const currentStyle = prev[id] || (plotData?.autoPointStyles[id]) || 'square'; return { ...prev, [id]: currentStyle === 'square' ? 'cross' : 'square' }; }); setPoppingPointId(id); setTimeout(() => setPoppingPointId(null), 300); if (navigator.vibrate) navigator.vibrate(50); setNotification('Style de borne modifié.', 'info'); };
    const handlePointMarkerStart = (id: number, x: number, y: number) => { if (isDrawingMode) return; setLongPressActivePoint({ id, x, y }); longPressTimerRef.current = setTimeout(() => { togglePointStyle(id); setLongPressActivePoint(null); longPressTimerRef.current = null; }, 500); };
    const handlePointMarkerEnd = () => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } setLongPressActivePoint(null); };

    // New logic for parcel long press interaction
    const handlePolygonLongPress = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault(); e.stopPropagation();
        let clientX = 0; let clientY = 0;
        if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; } else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }
        
        handleTextContextMenu(e, 'consistance', 'consistanceLabel'); // Shortcut to trigger parcel menu
    };

    const handleTextContextMenu = (e: React.MouseEvent | React.TouchEvent, type: string, id: string | number) => {
        e.preventDefault(); e.stopPropagation();
        let clientX = 0;
        let clientY = 0;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }
        const options = [{ label: 'Modifier (Double-clic)', action: () => { setEditingId(id); setNotification('Mode édition activé.', 'info'); }, icon: 'edit' }];
        if (type === 'custom') { options.push({ label: 'Déplacer (Sélectionner)', action: () => { setSelectedAnnotationId(id as number); setEditingId(null); }, icon: 'center' }, { label: 'Supprimer', action: () => { setCustomAnnotations(prev => prev.filter(a => a.id !== id)); setSelectedAnnotationId(null); }, icon: 'delete' }); } 
        else { options.push({ label: 'Effacer le texte', action: () => { if (type === 'static') setStaticTexts(prev => ({...prev, [id]: ''})); if (type === 'point') setPointLabels(prev => ({...prev, [id]: ''})); if (type === 'distance') setDistanceLabels(prev => ({...prev, [id]: ''})); if (type === 'riverain') setRiverainsLabels(prev => ({...prev, [id]: ''})); if (type === 'consistance') setConsistanceValue(''); if (type === 'centroide') setCentroideLabelValue(''); }, icon: 'delete' }, { label: 'Réinitialiser Position', action: () => { setElementPositions((prev: any) => { const newState = { ...prev }; delete newState[id]; return newState; }); }, icon: 'center' }); }
        setContextMenu({ x: clientX, y: clientY, options });
    };

    const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, id: number) => { 
        e.stopPropagation(); 
        let clientX = 0;
        let clientY = 0;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }
        const note = customAnnotations.find(n => n.id === id); if (!note || !zoomableContentRef.current) return; const idx = customAnnotations.findIndex(a => a.id === id); const wrapperEl = document.querySelector(`[data-drag-id="${idx}"][data-custom="true"] > div`) as HTMLElement; if(!wrapperEl) return; const container = zoomableContentRef.current; const isPercent = typeof note.width === 'string' && note.width.endsWith('%'); const startWidth = isPercent ? (parseFloat(note.width || '0') / 100) * container.offsetWidth : wrapperEl.offsetWidth; setResizingAnnotation({ id, startX: clientX, startY: clientY, startWidth, startHeight: wrapperEl.offsetHeight, startFontSize: note.fontSize || 10 }); 
    };
    
    useEffect(() => {
        if(!resizingAnnotation) return;
        const handleMove = (e: MouseEvent | TouchEvent) => { 
            let clientX = 0;
            let clientY = 0;
            if (e instanceof TouchEvent) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }
            const annotation = customAnnotations.find(a => a.id === resizingAnnotation.id); 
            if (!annotation) return; 
            const rotationDeg = annotation.rotation || 0; 
            const rotationRad = rotationDeg * (Math.PI / 180); 
            const scaledDeltaX = (clientX - resizingAnnotation.startX) / viewScale; 
            const scaledDeltaY = (clientY - resizingAnnotation.startY) / viewScale; 
            const localDeltaW = scaledDeltaX * Math.cos(rotationRad) + scaledDeltaY * Math.sin(rotationRad); 
            const newWidthPx = Math.max(20, resizingAnnotation.startWidth + localDeltaW); 
            const scaleFactor = newWidthPx / resizingAnnotation.startWidth; 
            const newFontSize = Math.max(4, Math.min(200, resizingAnnotation.startFontSize * scaleFactor)); 
            setCustomAnnotations(prev => prev.map(a => a.id === resizingAnnotation.id ? { ...a, width: `${newWidthPx}px`, fontSize: newFontSize, height: 'auto' } : a)); 
        };
        const handleUp = () => setResizingAnnotation(null);
        window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp); window.addEventListener('touchmove', handleMove, { passive: false }); window.addEventListener('touchend', handleUp);
        return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); window.removeEventListener('touchmove', handleMove); window.removeEventListener('touchend', handleUp); };
    }, [resizingAnnotation, viewScale, customAnnotations]);

    const handleRotationDragStart = (e: React.MouseEvent | React.TouchEvent, annotationId: number) => { 
        e.stopPropagation(); 
        if (e.cancelable && e.type === 'touchstart') e.preventDefault(); 
        const idx = customAnnotations.findIndex(a => a.id === annotationId); 
        const el = document.querySelector(`[data-drag-id="${idx}"][data-custom="true"] > div`) as HTMLElement; 
        if (!el) return; 
        const rect = el.getBoundingClientRect(); 
        const centerX = rect.left + rect.width / 2; 
        const centerY = rect.top + rect.height / 2; 
        const handleMove = (moveEvent: MouseEvent | TouchEvent) => { 
            if (moveEvent.cancelable && moveEvent.type === 'touchmove') moveEvent.preventDefault(); 
            let clientX = 0;
            let clientY = 0;
            if (moveEvent instanceof TouchEvent) {
                clientX = moveEvent.touches[0].clientX;
                clientY = moveEvent.touches[0].clientY;
            } else {
                clientX = moveEvent.clientX;
                clientY = moveEvent.clientY;
            }
            const angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI) + 90; 
            setCustomAnnotations(prev => prev.map(a => a.id === annotationId ? { ...a, rotation: angle } : a)); 
        }; 
        const handleUp = () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); window.removeEventListener('touchmove', handleMove); window.removeEventListener('touchend', handleUp); }; 
        window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp); window.addEventListener('touchmove', handleMove, { passive: false }); window.addEventListener('touchend', handleUp); 
    };

    const handleExportImage = async (format: 'png' | 'jpeg') => { 
        const element = zoomableContentRef.current; 
        if (!element) return; 
        setIsPreviewing(true); 
        setIsExporting(true); 
        setSelectedAnnotationId(null); 
        setEditingId(null); 
        try { 
            const clone = element.cloneNode(true) as HTMLElement; 
            clone.style.transform = 'none'; 
            clone.style.position = 'relative'; 
            clone.style.margin = '0'; 
            const hiddenContainer = document.createElement('div'); 
            hiddenContainer.style.position = 'fixed'; 
            hiddenContainer.style.top = '-10000px'; 
            hiddenContainer.style.left = '-10000px'; 
            hiddenContainer.style.width = element.style.width; 
            hiddenContainer.style.height = element.style.height; 
            hiddenContainer.style.zIndex = '-1000'; 
            hiddenContainer.appendChild(clone); 
            document.body.appendChild(hiddenContainer); 
            await new Promise(resolve => setTimeout(resolve, 300)); 
            const canvas = await html2canvas(clone, { scale: 4, useCORS: true, backgroundColor: '#ffffff', width: element.offsetWidth, height: element.offsetHeight, windowWidth: element.offsetWidth, windowHeight: element.offsetHeight }); 
            document.body.removeChild(hiddenContainer); 
            canvas.toBlob(blob => { if (blob) saveAndShareFile(blob, `croquis-bornage.${format}`, `image/${format}`); }, `image/${format}`, 0.95); 
        } catch (e) { console.error(e); setNotification('Erreur exportation.', 'error'); } finally { setIsPreviewing(false); setIsExporting(false); } 
    };

    const handleExportPdf = async () => { 
        const element = zoomableContentRef.current; 
        if (!element) return; 
        setIsPreviewing(true); 
        setIsExporting(true); 
        setSelectedAnnotationId(null); 
        setEditingId(null); 
        try { 
            const clone = element.cloneNode(true) as HTMLElement; 
            clone.style.transform = 'none'; 
            clone.style.position = 'relative'; 
            clone.style.margin = '0'; 
            const hiddenContainer = document.createElement('div'); 
            hiddenContainer.style.position = 'fixed'; 
            hiddenContainer.style.top = '-10000px'; 
            hiddenContainer.style.left = '-10000px'; 
            hiddenContainer.style.width = `${pageDimensions.width}mm`; 
            hiddenContainer.style.height = `${pageDimensions.height}mm`; 
            hiddenContainer.appendChild(clone); 
            document.body.appendChild(hiddenContainer); 
            await new Promise(resolve => setTimeout(resolve, 300)); 
            const canvas = await html2canvas(clone, { scale: 4, useCORS: true, backgroundColor: '#ffffff', width: element.offsetWidth, height: element.offsetHeight, windowWidth: element.offsetWidth, windowHeight: element.offsetHeight }); 
            document.body.removeChild(hiddenContainer); 
            const imgData = canvas.toDataURL('image/jpeg', 1.0); 
            const pdf = new jsPDF({ orientation: orientation, unit: 'mm', format: paperFormat.toLowerCase() }); 
            pdf.addImage(imgData, 'JPEG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight()); 
            pdf.save(`${(parcel?.name || 'croquis').replace(/\//g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`); 
            setNotification('PDF généré.', 'success'); 
        } catch (e) { console.error(e); setNotification('Erreur PDF.', 'error'); } finally { setIsPreviewing(false); setIsExporting(false); } 
    };

    const handleSegmentClick = (segmentLabel: string) => { if (isDrawingMode || addingText) return; setEditingRiverainSegment(segmentLabel); };
    const handleSaveRiverainUpdate = (updatedRiverain: Riverain) => { if (!parcel || !parcelManager) return; const currentRiverains = parcel.riverains || []; const index = currentRiverains.findIndex(r => r.segmentLabel === updatedRiverain.segmentLabel); let newRiverains: Riverain[]; if (index >= 0) { newRiverains = currentRiverains.map((r, i) => i === index ? { ...updatedRiverain, id: r.id } : r); } else { newRiverains = [...currentRiverains, { ...updatedRiverain, id: Date.now() }]; } parcelManager.updateParcel(parcel.id, { riverains: newRiverains }); };
    const keysToExcludeFromLoop = ['labelPropriete', 'labelRequisition', 'labelSituation', 'labelAnnexePv', 'labelIngenieur'];
    const activeRiverain = useMemo(() => { if (!editingRiverainSegment || !parcel) return null; return (parcel.riverains || []).find(r => r.segmentLabel === editingRiverainSegment) || { id: 0, segmentLabel: editingRiverainSegment, name: '', consistance: 'T.N', showLimitLines: true, limitDirection: 'both', isMitoyenne: false } as Riverain; }, [editingRiverainSegment, parcel]);
    const lineGenerator = d3Line<{screen:{x:number, y:number}}>().x(d=>d.screen.x).y(d=>d.screen.y).curve(curveLinearClosed);

    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 overflow-hidden relative">
            <style>{printStyles}</style>

            {/* Toolbar Dessin - Scrollable on mobile */}
            <div className="flex flex-nowrap overflow-x-auto items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 shadow-sm z-10 gap-x-4 no-print no-scrollbar">
                <div className="flex items-center space-x-4 flex-shrink-0">
                    <div className="flex items-center space-x-3 text-sm text-gray-600">
                        <label className="flex items-center cursor-pointer whitespace-nowrap"><input type="checkbox" checked={isAutoFit} onChange={e => setIsAutoFit(e.target.checked)} className="mr-1.5" />Auto-échelle</label>
                        <label className="flex items-center cursor-pointer whitespace-nowrap"><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="mr-1.5" />Grille</label>
                        <button onClick={() => setIsSnappingEnabled(!isSnappingEnabled)} className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors whitespace-nowrap ${isSnappingEnabled ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-gray-100 text-gray-500 border-gray-300'}`}> AIMANT {isSnappingEnabled ? 'ON' : 'OFF'} </button>
                    </div>
                </div>
                <div className="flex items-center space-x-1 flex-shrink-0">
                    <select value={paperFormat} onChange={(e) => setPaperFormat(e.target.value as 'A4' | 'A3' | 'A2' | 'A1')} className="px-2 py-1.5 text-xs font-bold bg-gray-100 dark:bg-gray-700 rounded transition outline-none cursor-pointer border-none">
                        <option value="A4">A4</option>
                        <option value="A3">A3</option>
                        <option value="A2">A2</option>
                        <option value="A1">A1</option>
                    </select>
                    <button onClick={() => setOrientation(o => o === 'portrait' ? 'landscape' : 'portrait')} className="px-3 py-1.5 text-xs font-bold bg-gray-100 dark:bg-gray-700 rounded transition">{orientation === 'portrait' ? 'PAYSAGE' : 'PORTRAIT'}</button>
                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                    <button onClick={() => setIsDrawingMode(!isDrawingMode)} className={`px-3 py-1.5 text-xs font-bold rounded transition flex items-center gap-1.5 whitespace-nowrap ${isDrawingMode ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'}`}><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>DESSIN</button>
                    <button onClick={handleAddAnnotation} disabled={isDrawingMode} className={`px-3 py-1.5 text-xs font-bold rounded transition flex items-center gap-1.5 whitespace-nowrap ${addingText ? 'bg-blue-600 text-white animate-pulse' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>TEXTE</button>
                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                    <button onClick={handleSaveSketch} title="Sauvegarder" className="p-2 text-gray-500 hover:text-blue-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg></button>
                    {hasSavedData && (
                        <button onClick={handleLoadSketch} title="Charger la version sauvegardée" className="p-2 text-gray-500 hover:text-green-600 rounded hover:bg-green-50 dark:hover:bg-green-900/20">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4-4m4 4V4" /></svg>
                        </button>
                    )}
                    <button onClick={() => handleExportImage('jpeg')} disabled={isExporting} className="px-3 py-1.5 text-xs font-black text-gray-600 hover:bg-gray-50 rounded">JPG</button>
                    <button onClick={handleExportPdf} disabled={isExporting} className="px-3 py-1.5 text-xs font-black text-red-600 hover:bg-red-50 rounded">PDF</button>
                </div>
            </div>

            {isDrawingMode && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800 p-2 flex flex-nowrap overflow-x-auto justify-start md:justify-center items-center gap-4 z-20 no-print no-scrollbar">
                    <div className="flex bg-white dark:bg-gray-800 rounded-xl p-1 shadow-sm gap-1 items-center px-2 flex-shrink-0">
                        <button onClick={() => setActiveTool('freehand')} className={`p-1.5 rounded-lg transition-colors ${activeTool === 'freehand' && !isEraser ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:text-gray-600'}`} title="Main levée"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                        <button onClick={() => setActiveTool('line')} className={`p-1.5 rounded-lg transition-colors ${activeTool === 'line' && !isEraser ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:text-gray-600'}`} title="Ligne"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 20L4 4" /></svg></button>
                        <button onClick={() => setActiveTool('rectangle')} className={`p-1.5 rounded-lg transition-colors ${activeTool === 'rectangle' && !isEraser ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:text-gray-600'}`} title="Rectangle"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="4" y="4" width="16" height="16" strokeWidth={2} rx="2" /></svg></button>
                        <button onClick={() => setActiveTool('circle')} className={`p-1.5 rounded-lg transition-colors ${activeTool === 'circle' && !isEraser ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:text-gray-600'}`} title="Cercle"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="9" strokeWidth={2} /></svg></button>
                    </div>

                    <div className="flex bg-white dark:bg-gray-800 rounded-xl p-1 shadow-sm gap-2 items-center px-3 h-[34px] flex-shrink-0">
                        <span className="text-[10px] font-black text-gray-400 uppercase select-none tracking-tighter">Épaisseur</span>
                        <input type="range" min="0.1" max="5.0" step="0.1" value={drawingWidth} onChange={(e) => setDrawingWidth(parseFloat(e.target.value))} className="w-20 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-orange-500" />
                        <span className="text-[10px] font-mono font-bold w-6 text-gray-600 dark:text-gray-300 select-none">{drawingWidth.toFixed(1)}</span>
                    </div>

                    <div className="flex bg-white dark:bg-gray-800 rounded-xl p-1 shadow-sm gap-1 items-center px-2 flex-shrink-0">
                        <button onClick={() => setDrawingStyle('solid')} className={`p-1 rounded ${drawingStyle === 'solid' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}><svg width="24" height="24" viewBox="0 0 24 24"><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2.5" /></svg></button>
                        <button onClick={() => setDrawingStyle('dashed')} className={`p-1 rounded ${drawingStyle === 'dashed' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}><svg width="24" height="24" viewBox="0 0 24 24"><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2.5" strokeDasharray="4,4" /></svg></button>
                    </div>
                    <button onClick={handleEraserToggle} className={`text-xs font-bold flex items-center px-4 py-2 rounded-xl shadow-sm transition-all flex-shrink-0 ${isEraser ? 'bg-red-500 text-white' : 'text-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50'}`}><svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>GOMME</button>
                    <button onClick={handleUndoDrawing} className="text-xs font-bold flex items-center text-gray-600 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl shadow-sm hover:bg-gray-50 flex-shrink-0"><svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>ANNULER</button>
                </div>
            )}

            <div className="flex-1 flex overflow-hidden relative">
                <main 
                    className="flex-1 relative overflow-hidden flex flex-col items-center bg-gray-200/50 dark:bg-gray-900/50 p-8" 
                    ref={zoomableViewportRef}
                    onPointerDown={handleViewportPointerDown}
                    onPointerMove={handleViewportPointerMove}
                    onPointerUp={handleViewportPointerUp}
                    onPointerCancel={handleViewportPointerUp}
                    onPointerLeave={handleViewportPointerUp}
                    style={{ cursor: isDrawingMode ? 'crosshair' : 'grab', touchAction: 'none' }}
                >
                    <div 
                        className="relative shadow-2xl transition-transform duration-75 ease-out origin-top-left" 
                        style={{ 
                            width: `${pageDimensions.width}mm`, 
                            height: `${pageDimensions.height}mm`, 
                            transform: `translate(${viewPosition.x}px, ${viewPosition.y}px) scale(${viewScale})`, 
                            flexShrink: 0 
                        }}
                    >
                        <div ref={zoomableContentRef} className="w-full h-full bg-white relative bornage-sketch-container printable-area" style={{ cursor: isDrawingMode ? 'crosshair' : (addingText ? 'text' : 'default'), touchAction: 'none' }} onClick={onPaperClick}>
                            {isDrawingMode && <div className="absolute inset-0 z-50" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} />}
                            {longPressActivePoint && (
                                <div className="absolute z-[100]" style={{ left: `${longPressActivePoint.x}px`, top: `${longPressActivePoint.y}px`, transform: 'translate(-50%, -50%) scale(2)' }}>
                                    <svg width="24" height="24" className="long-press-indicator"><circle cx="12" cy="12" r="10" /></svg>
                                </div>
                            )}
                            <div ref={containerRef} className="w-full h-full relative" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                <svg ref={svgRef} className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} viewBox={`0 0 ${pageDimensions.width} ${pageDimensions.height}`}>
                                    {showGrid && (
                                        <defs>
                                            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                                                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="0.2"/>
                                                <path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="0.1"/>
                                            </pattern>
                                        </defs>
                                    )}
                                    {showGrid && <rect width="100%" height="100%" fill="url(#grid)" style={{ pointerEvents: 'none' }} />}
                                    {plotData && (
                                        <g>
                                            <path 
                                                d={lineGenerator(plotData.projectedPoints) || ""} 
                                                fill="transparent" 
                                                stroke="red" 
                                                strokeWidth="0.3" 
                                                strokeLinejoin="round"
                                                className="parcel-path" 
                                                style={{ pointerEvents: 'visiblePainted', cursor: 'context-menu' }} 
                                                onContextMenu={(e) => handleTextContextMenu(e, 'consistance', 'consistanceLabel')} 
                                            />
                                            {plotData.fencedInnerLines && plotData.fencedInnerLines.map((l, i) => <line key={`fenced-line-${i}`} x1={l.p1.x} y1={l.p1.y} x2={l.p2.x} y2={l.p2.y} stroke="black" strokeWidth="0.1" style={{ pointerEvents: 'none' }} />)}
                                            {plotData.projectedPoints.map((p, i) => {
                                                const p2 = plotData.projectedPoints[(i + 1) % plotData.projectedPoints.length];
                                                const segmentLabel = `B${i + 1} - B${(i + 1) % plotData.projectedPoints.length + 1}`;
                                                const isSelected = editingRiverainSegment === segmentLabel;
                                                const isHighlighted = highlightedSegment === segmentLabel;
                                                return (
                                                    <g key={`seg-group-${segmentLabel}`}>
                                                        {(isHighlighted || isSelected) && (
                                                            <line x1={p.screen.x} y1={p.screen.y} x2={p2.screen.x} y2={p2.screen.y} stroke={isSelected ? "#3b82f6" : "#60a5fa"} strokeWidth={isSelected ? "1.8" : "1.2"} opacity={isSelected ? "1" : "0.5"} className="segment-highlight" />
                                                        )}
                                                        <line x1={p.screen.x} y1={p.screen.y} x2={p2.screen.x} y2={p2.screen.y} stroke="blue" strokeWidth="8" className="segment-hit-area" style={{ pointerEvents: 'auto' }} onMouseEnter={() => setHighlightedSegment(segmentLabel)} onMouseLeave={() => setHighlightedSegment(null)} onClick={(e) => { e.stopPropagation(); handleSegmentClick(segmentLabel); }} />
                                                    </g>
                                                );
                                            })}
                                            {plotData.mitoyenneLines && plotData.mitoyenneLines.map((l, i) => <line key={`mit-line-${i}`} x1={l.p1.x} y1={l.p1.y} x2={l.p2.x} y2={l.p2.y} stroke="black" strokeWidth="0.2" style={{ pointerEvents: 'none' }} />)}
                                            {plotData.constructionInnerLines && plotData.constructionInnerLines.map((l, i) => <line key={`const-line-${i}`} x1={l.p1.x} y1={l.p1.y} x2={l.p2.x} y2={l.p2.y} stroke="black" strokeWidth="0.2" strokeDasharray="1, 0.5" style={{ pointerEvents: 'none' }} />)}
                                            {plotData.riverainLines && plotData.riverainLines.map((l, i) => <line key={`riv-marker-${i}`} x1={l.p1.x} y1={l.p1.y} x2={l.p2.x} y2={l.p2.y} stroke="black" strokeWidth={l.strokeWidth || 0.2} strokeDasharray={l.strokeDasharray} style={{ pointerEvents: 'none' }} />)}
                                            {plotData.riverainLimitLines && plotData.riverainLimitLines.map((l, i) => <line key={`limit-line-${i}`} x1={l.p1.x} y1={l.p1.y} x2={l.p2.x} y2={l.p2.y} stroke="black" strokeWidth="0.2" style={{ pointerEvents: 'none' }} />)}
                                            {plotData.projectedPoints.map((p, i) => {
                                                const autoStyle = plotData!.autoPointStyles[p.id];
                                                const style = pointStyles[p.id] || autoStyle || 'square';
                                                const isPopping = poppingPointId === p.id;
                                                return ( 
                                                    <g key={i} className={`point-marker-group ${isPopping ? 'point-pop' : ''}`} onPointerDown={(e) => { e.stopPropagation(); const rect = zoomableContentRef.current?.getBoundingClientRect(); if (rect) handlePointMarkerStart(p.id, e.clientX - rect.left, e.clientY - rect.top); }} onPointerUp={handlePointMarkerEnd} onPointerLeave={handlePointMarkerEnd}>
                                                        {style === 'square' ? ( <rect x={p.screen.x - 1} y={p.screen.y - 1} width="2" height="2" fill="white" stroke="black" strokeWidth="0.5" /> ) : ( <path d={`M ${p.screen.x - 1.5} ${p.screen.y - 1.5} L ${p.screen.x + 1.5} ${p.screen.y + 1.5} M ${p.screen.x - 1.5} ${p.screen.y + 1.5} L ${p.screen.x + 1.5} ${p.screen.y - 1.5}`} stroke="black" strokeWidth="0.3" fill="none" /> )}
                                                    </g>
                                                );
                                            })}
                                        </g>
                                    )}
                                    <g style={{ pointerEvents: 'none' }}>
                                        {drawings.map((d, i) => {
                                            const strokeColor = d.color === '#ffffff' ? '#ffffff' : 'black';
                                            if (d.type === 'freehand' && d.points) return <path key={i} d={d3Line().curve(curveBasis)(d.points) || ""} fill="none" stroke={strokeColor} strokeWidth={d.width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={getStrokeDashArray(d.style, d.width)} />;
                                            else if (d.type === 'line' && d.points) return <line key={i} x1={d.points[0][0]} y1={d.points[0][1]} x2={d.points[1][0]} y2={d.points[1][1]} stroke={strokeColor} strokeWidth={d.width} strokeLinecap="round" strokeDasharray={getStrokeDashArray(d.style, d.width)} />;
                                            else if (d.type === 'rectangle' && d.points) return <path key={i} d={`M${d.points[0][0]},${d.points[0][1]} L${d.points[1][0]},${d.points[1][1]} L${d.points[2][0]},${d.points[2][1]} L${d.points[3][0]},${d.points[3][1]} Z`} fill="none" stroke={strokeColor} strokeWidth={d.width} strokeDasharray={getStrokeDashArray(d.style, d.width)} opacity={0.6} />
                                            else if (d.type === 'circle' && d.geometry) return <circle key={i} cx={d.geometry.cx} cy={d.geometry.cy} r={d.geometry.r} fill="none" stroke={strokeColor} strokeWidth={d.width} strokeDasharray={getStrokeDashArray(d.style, d.width)} opacity={0.6} />
                                            return null;
                                        })}
                                        {dragStart && currentPointer && activeTool === 'line' && <line x1={dragStart[0]} y1={dragStart[1]} x2={currentPointer[0]} y2={currentPointer[1]} stroke="black" strokeWidth={drawingWidth} strokeDasharray={getStrokeDashArray(drawingStyle, drawingWidth)} opacity={0.6} />}
                                        {dragStart && currentPointer && activeTool === 'rectangle' && <rect x={Math.min(dragStart[0], currentPointer[0])} y={Math.min(dragStart[1], currentPointer[1])} width={Math.abs(currentPointer[0] - dragStart[0])} height={Math.abs(currentPointer[1] - dragStart[1])} fill="none" stroke="black" strokeWidth={drawingWidth} strokeDasharray={getStrokeDashArray(drawingStyle, drawingWidth)} opacity={0.6} />}
                                        {dragStart && currentPointer && activeTool === 'circle' && <circle cx={dragStart[0]} cy={dragStart[1]} r={Math.sqrt(Math.pow(currentPointer[0] - dragStart[0], 2) + Math.pow(currentPointer[1] - dragStart[1], 2))} fill="none" stroke="black" strokeWidth={drawingWidth} strokeDasharray={getStrokeDashArray(drawingStyle, drawingWidth)} opacity={0.6} />}
                                        {activeTool === 'freehand' && currentFreehandPath.length > 0 && <path d={d3Line().curve(curveBasis)(currentFreehandPath) || ""} fill="none" stroke={isEraser ? '#ffffff' : 'black'} strokeWidth={isEraser ? drawingWidth * 4 : drawingWidth} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={getStrokeDashArray(drawingStyle, drawingWidth)} />}
                                        
                                        {snapIndicator && (
                                            <g>
                                                {snapIndicator.linePoints && (
                                                    <line 
                                                        x1={snapIndicator.linePoints[0]} y1={snapIndicator.linePoints[1]} 
                                                        x2={snapIndicator.linePoints[2]} y2={snapIndicator.linePoints[3]} 
                                                        stroke={snapIndicator.type === 'extension' ? "#f97316" : "#d946ef"} 
                                                        strokeWidth="0.15" 
                                                        strokeDasharray="2, 2" 
                                                        opacity="0.6"
                                                    />
                                                )}
                                                {snapIndicator.type === 'vertex' && <circle cx={snapIndicator.x} cy={snapIndicator.y} r={4} fill="none" stroke="#f97316" strokeWidth={1.5} />}
                                                {(snapIndicator.type === 'edge' || snapIndicator.type === 'extension') && (
                                                    <path d={`M${snapIndicator.x - 3},${snapIndicator.y - 3} L${snapIndicator.x + 3},${snapIndicator.y + 3} M${snapIndicator.x + 3},${snapIndicator.y - 3} L${snapIndicator.x - 3},${snapIndicator.y + 3}`} stroke={snapIndicator.type === 'edge' ? "#3b82f6" : "#f97316"} strokeWidth={1.5} fill="none" />
                                                )}
                                                {snapIndicator.type === 'parallel' && (
                                                    <path d={`M${snapIndicator.x - 4},${snapIndicator.y} L${snapIndicator.x + 4},${snapIndicator.y} M${snapIndicator.x},${snapIndicator.y - 4} L${snapIndicator.x},${snapIndicator.y + 4}`} stroke="#d946ef" strokeWidth={1.5} fill="none" transform={`rotate(45, ${snapIndicator.x}, ${snapIndicator.y})`} />
                                                )}
                                            </g>
                                        )}
                                    </g>
                                </svg>
                                <div className="absolute inset-0 w-full h-full text-[12px]" style={{ pointerEvents: 'none' }}>
                                    {Object.entries(staticTexts).filter(([key]) => !keysToExcludeFromLoop.includes(key)).map(([key, value]) => {
                                        const pos = elementPositions[key as keyof typeof defaultStaticTexts];
                                        return pos && ( <div key={key} data-drag-id={key} className="draggable-item" style={{...defaultStyles[key], ...pos, touchAction: 'none', pointerEvents: 'auto'}} onContextMenu={(e) => handleTextContextMenu(e, 'static', key)}> <EditableSketchText text={value} isEditing={editingId === key} onEditStart={() => setEditingId(key)} onUpdate={(v) => {setStaticTexts(prev => ({...prev, [key]: v})); setEditingId(null); }} onCancel={() => setEditingId(null)} style={{}} /> </div> );
                                    })}
                                    {elementPositions.labelPropriete && (
                                        <div data-drag-id="labelPropriete" className="draggable-item" style={{...defaultStyles.labelPropriete, ...elementPositions.labelPropriete, display: 'flex', gap: '5px', whiteSpace: 'nowrap', touchAction: 'none', pointerEvents: 'auto'}}>
                                            <span>{staticTexts.labelPropriete}</span>
                                            <EditableSketchText text={propriete} isEditing={editingId === 'propriete'} onEditStart={() => setEditingId('propriete')} onUpdate={(v) => {setPropriete(v); setEditingId(null);}} onCancel={() => setEditingId(null)} style={{ ...defaultStyles.propriete }} />
                                        </div>
                                    )}
                                    {elementPositions.labelRequisition && (
                                        <div data-drag-id="labelRequisition" className="draggable-item" style={{...defaultStyles.labelRequisition, ...elementPositions.labelRequisition, display: 'flex', gap: '5px', whiteSpace: 'nowrap', touchAction: 'none', pointerEvents: 'auto'}}>
                                            <span>{staticTexts.labelRequisition}</span>
                                            <EditableSketchText text={requisition} isEditing={editingId === 'requisition'} onEditStart={() => setEditingId('requisition')} onUpdate={(v) => {setRequisition(v); setEditingId(null);}} onCancel={() => setEditingId(null)} style={{ ...defaultStyles.requisition }} />
                                        </div>
                                    )}
                                    {elementPositions.labelSituation && (
                                        <div data-drag-id="labelSituation" className="draggable-item" style={{...defaultStyles.labelSituation, ...elementPositions.labelSituation, display: 'flex', gap: '5px', whiteSpace: 'nowrap', touchAction: 'none', pointerEvents: 'auto'}}>
                                            <span>{staticTexts.labelSituation}</span>
                                            <EditableSketchText text={situation} isEditing={editingId === 'situation'} onEditStart={() => setEditingId('situation')} onUpdate={(v) => {setSituation(v); setEditingId(null);}} onCancel={() => setEditingId(null)} style={{ ...defaultStyles.situation }} />
                                        </div>
                                    )}
                                    {elementPositions.labelAnnexePv && (
                                        <div data-drag-id="labelAnnexePv" className="draggable-item" style={{...defaultStyles.labelAnnexePv, ...elementPositions.labelAnnexePv, display: 'flex', flexDirection: 'column', alignItems: 'center', whiteSpace: 'nowrap', gap: '5px', touchAction: 'none', pointerEvents: 'auto'}}>
                                            <span>{staticTexts.labelAnnexePv}</span>
                                            <EditableSketchText text={date} isEditing={editingId === 'date'} onEditStart={() => setEditingId('date')} onUpdate={(v) => {setDate(v); setEditingId(null);}} onCancel={() => setEditingId(null)} style={{ ...defaultStyles.date }} />
                                        </div>
                                    )}
                                    <div data-drag-id="echelle" className="draggable-item" style={{...defaultStyles.echelle, ...elementPositions.echelle, touchAction: 'none', pointerEvents: 'auto'}}><EditableSketchText text={echelle} isEditing={editingId === 'echelle'} onEditStart={() => setEditingId('echelle')} onUpdate={v => { setEchelle(v); setIsAutoFit(false); setEditingId(null); }} onCancel={() => setEditingId(null)} style={{}} /></div>
                                    <div data-drag-id="contenance" className="draggable-item" style={{...defaultStyles.contenance, ...elementPositions.contenance, touchAction: 'none', pointerEvents: 'auto'}}><EditableSketchText text={contenance} isEditing={editingId === 'contenance'} onEditStart={() => setEditingId('contenance')} onUpdate={(v) => {setContenance(v); setEditingId(null);}} onCancel={() => setEditingId(null)} style={{}} /></div>
                                    <div data-drag-id="northArrow" className="draggable-item" style={{...elementPositions.northArrow, touchAction: 'none', pointerEvents: 'auto'}}><div className="flex flex-col items-center"><span style={{fontSize: '12pt', fontWeight: 'bold', fontFamily: 'serif', marginBottom: '-2px', color: 'black'}}>N</span><svg width="20" height="40" viewBox="0 0 20 40"> <path d="M10 0 L15 15 L10 12 L5 15 Z" fill="black" /> <line x1="10" y1="12" x2="10" y2="38" stroke="black" strokeWidth="1.5" /> <line x1="5" y1="25" x2="15" y2="25" stroke="black" strokeWidth="1" /> </svg></div></div>
                                    {elementPositions.mappe && (
                                        <div data-drag-id="mappe" className="draggable-item" style={{...defaultStyles.mappe, ...elementPositions.mappe, touchAction: 'none', pointerEvents: 'auto'}}>
                                            <EditableSketchText text={mappe} isEditing={editingId === 'mappe'} onEditStart={() => setEditingId('mappe')} onUpdate={(v) => {setMappe(v); setEditingId(null);}} onCancel={() => setEditingId(null)} style={{}} />
                                        </div>
                                    )}
                                    {elementPositions.carte && (
                                        <div data-drag-id="carte" className="draggable-item" style={{...defaultStyles.carte, ...elementPositions.carte, touchAction: 'none', pointerEvents: 'auto'}}>
                                            <EditableSketchText text={carte} isEditing={editingId === 'carte'} onEditStart={() => setEditingId('carte')} onUpdate={(v) => {setCarte(v); setEditingId(null);}} onCancel={() => setEditingId(null)} style={{}} />
                                        </div>
                                    )}
                                    {centroideLabelValue && <div data-drag-id="centroideCoords" className="draggable-item" style={{...defaultStyles.centroideCoords, ...elementPositions.centroideCoords, touchAction: 'none', pointerEvents: 'auto'}} onContextMenu={(e) => handleTextContextMenu(e, 'centroide', 'centroideCoords')}><EditableSketchText text={centroideLabelValue} isEditing={editingId === 'centroideCoords'} onEditStart={() => setEditingId('centroideCoords')} onUpdate={(v) => {setCentroideLabelValue(v); setEditingId(null);}} onCancel={() => setEditingId(null)} style={{}} multiline={true} /></div>}
                                    {plotData && (
                                        <div data-drag-id="consistanceLabel" className="draggable-item" style={{...defaultStyles.consistanceLabel, ...(elementPositions.consistanceLabel || {left: `${(plotData.screenCentroid.x / pageDimensions.width) * 100}%`,top: `${(plotData.screenCentroid.y / pageDimensions.height) * 100}%`}),transform: 'translate(-50%, -50%)',position: 'absolute',touchAction: 'none', pointerEvents: 'auto'}} onContextMenu={(e) => handleTextContextMenu(e, 'consistance', 'consistanceLabel')}>
                                            <EditableSketchText text={consistanceValue} isEditing={editingId === 'consistanceLabel'} onEditStart={() => setEditingId('consistanceLabel')} onUpdate={(v) => {setConsistanceValue(v); setEditingId(null);}} onCancel={() => setEditingId(null)} style={{}} />
                                        </div>
                                    )}
                                    {elementPositions.labelIngenieur && (
                                        <div data-drag-id="labelIngenieur" className="draggable-item" style={{...defaultStyles.labelIngenieur, ...elementPositions.labelIngenieur, display: 'flex', flexDirection: 'column', alignItems: 'center', whiteSpace: 'nowrap', gap: '5px', touchAction: 'none', pointerEvents: 'auto'}}>
                                            <span>{staticTexts.labelIngenieur}</span>
                                            <EditableSketchText text={ingenieur} isEditing={editingId === 'ingenieur'} onEditStart={() => setEditingId('ingenieur')} onUpdate={(v) => {setIngenieur(v); setEditingId(null);}} onCancel={() => setEditingId(null)} style={{ ...defaultStyles.ingenieur }} />
                                        </div>
                                    )}
                                    {plotData && (
                                        <>
                                            {plotData.pointData.map(({ labelPos, id }: any) => {
                                                const dragId = `point-label-${id}`; const pos = elementPositions[dragId] || { left: `${(labelPos.x / pageDimensions.width) * 100}%`, top: `${(labelPos.y / pageDimensions.height) * 100}%` };
                                                return ( <div key={dragId} data-drag-id={dragId} className="draggable-item" style={{...pos, transform: 'translate(-50%, -50%)', fontWeight: 'bold', fontSize: '9pt', fontFamily: '"Times New Roman", Times, serif', touchAction: 'none', color: '#000', pointerEvents: 'auto'}} onContextMenu={(e) => handleTextContextMenu(e, 'point', id)}> <EditableSketchText text={pointLabels[id] || ''} isEditing={editingId === dragId} onEditStart={() => setEditingId(dragId)} onUpdate={v => {setPointLabels(prev => ({...prev, [id]: v})); setEditingId(null);}} onCancel={() => setEditingId(null)} style={{}} /> </div> );
                                            })}
                                            {plotData.distanceData.map(({ key, labelPos, rotation }: any) => {
                                                const dragId = `distance-label-${key}`; const pos = elementPositions[dragId] || { left: `${(labelPos.x / pageDimensions.width) * 100}%`, top: `${(labelPos.y / pageDimensions.height) * 100}%` };
                                                return ( <div key={dragId} data-drag-id={dragId} className="draggable-item" style={{...pos, transform: `translate(-50%, -50%) rotate(${rotation}deg)`, fontSize: '8pt', color: '#000', fontFamily: '"Times New Roman", Times, serif', touchAction: 'none', pointerEvents: 'auto'}} onContextMenu={(e) => handleTextContextMenu(e, 'distance', key)}> <EditableSketchText text={distanceLabels[key] || ''} isEditing={editingId === dragId} onEditStart={() => setEditingId(dragId)} onUpdate={v => {setDistanceLabels(prev => ({...prev, [key]: v})); setEditingId(null);}} onCancel={() => setEditingId(null)} style={{ backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '2px' }} /> </div> );
                                            })}
                                            {plotData.riverainData && plotData.riverainData.map(({ id: rivId, type, textKey, labelPos, rotation, defaultText, width, segmentLabel }: any) => {
                                                const dragId = textKey; const pos = elementPositions[dragId] || { left: `${(labelPos.x / pageDimensions.width) * 100}%`, top: `${(labelPos.y / pageDimensions.height) * 100}%` };
                                                const isSegmentEditing = editingRiverainSegment === segmentLabel;
                                                const handleRiverainLabelUpdate = (newVal: string) => { if (!parcel || !parcelManager) return; const currentRiverains = parcel.riverains || []; const updated = currentRiverains.map(r => r.id === rivId ? { ...r, [type]: newVal } : r); parcelManager.updateParcel(parcel.id, { riverains: updated }); setRiverainsLabels(prev => ({ ...prev, [textKey]: newVal })); setEditingId(null); };
                                                return ( <div key={dragId} data-drag-id={dragId} className={`draggable-item ${isSegmentEditing ? 'riverain-label-active' : ''}`} style={{...pos, transform: `translate(-50%, -50%) rotate(${rotation}deg)`, fontSize: '9pt', color: '#000', fontFamily: '"Times New Roman", Times, serif', textAlign: 'center', touchAction: 'none', width: `${width}px`, whiteSpace: 'pre-wrap', lineHeight: '1.1', pointerEvents: 'auto'}} onContextMenu={(e) => handleTextContextMenu(e, 'riverain', textKey)} onClick={(e) => { e.stopPropagation(); handleSegmentClick(segmentLabel); }}> <EditableSketchText text={riverainsLabels[textKey] || defaultText} isEditing={editingId === dragId} onEditStart={() => setEditingId(dragId)} onUpdate={handleRiverainLabelUpdate} onCancel={() => setEditingId(null)} style={{}} /> </div> );
                                            })}
                                        </>
                                    )}
                                    {customAnnotations.map((note, idx) => (
                                        <div key={note.id} data-drag-id={idx} data-custom="true" className="draggable-item" style={{left: note.x, top: note.y, position: 'absolute', touchAction: 'none', pointerEvents: 'auto'}} onClick={(e) => { if(!isDrawingMode) { e.stopPropagation(); setSelectedAnnotationId(note.id); } }} onContextMenu={(e) => handleTextContextMenu(e, 'custom', note.id)}>
                                            <div className={`relative group ${selectedAnnotationId === note.id ? 'outline-dashed outline-1 outline-blue-500 shadow-xl' : ''}`} style={{ width: note.width || 'auto', height: note.height || 'auto', transform: `rotate(${note.rotation || 0}deg)`, transformOrigin: 'center center', userSelect: 'none' }}>
                                                {selectedAnnotationId === note.id && (<><div className="absolute -top-1.5 -left-1.5 w-2.5 h-2.5 bg-white border border-blue-500 pointer-events-none visual-handle"></div><div className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-white border border-blue-500 pointer-events-none visual-handle"></div><div className="absolute -bottom-1.5 -left-1.5 w-2.5 h-2.5 bg-white border border-blue-500 pointer-events-none visual-handle"></div></>)}
                                                {selectedAnnotationId === note.id && (<div className="rotation-handle absolute -top-10 left-1/2 transform -translate-x-1/2 cursor-grab active:cursor-grabbing z-50 flex flex-col items-center touch-none p-2" onMouseDown={(e) => handleRotationDragStart(e, note.id)} onTouchStart={(e) => handleRotationDragStart(e, note.id)}><div className="w-2.5 h-2.5 bg-white border border-blue-500 rounded-full shadow-sm pointer-events-none"></div><div className="w-px h-5 bg-blue-500 pointer-events-none"></div></div>)}
                                                <EditableSketchText text={note.text} isSelected={selectedAnnotationId === note.id} isEditing={editingId === note.id} onEditStart={() => setEditingId(note.id)} onUpdate={v => { setCustomAnnotations(prev => prev.map((n, i) => i === idx ? {...n, text: v} : n)); setEditingId(null); }} onCancel={() => setEditingId(null)} multiline={true} opaque={note.opaque} style={{ color: 'black', fontFamily: '"Times New Roman", Times, serif', fontSize: note.fontSize ? `${note.fontSize}pt` : '10pt', textAlign: note.textAlign || 'left', lineHeight: note.lineHeight || 1.2, width: '100%', height: '100%', wordBreak: 'break-word' }} />
                                                {selectedAnnotationId === note.id && (<div className="resize-handle absolute -bottom-2 -right-2 w-8 h-8 cursor-se-resize z-50 touch-none flex items-center justify-center" onMouseDown={(e) => handleResizeStart(e, note.id)} onTouchStart={(e) => handleResizeStart(e, note.id)}><div className="w-2.5 h-2.5 bg-white border border-blue-500 pointer-events-none"></div></div>)}
                                                {selectedAnnotationId === note.id && (
                                                    <div className="annotation-controls absolute left-1/2 transform -translate-x-1/2 mt-4 bg-gray-900/90 backdrop-blur-md text-white p-1.5 rounded-2xl flex flex-wrap items-center gap-2 z-50 shadow-2xl border border-white/20 min-w-max" style={{ top: '100%', transform: `translate(-50%, 0) rotate(-${note.rotation || 0}deg)` }}>
                                                        <div className="flex items-center gap-1"><span className="text-[10px] uppercase font-black text-blue-400 pl-1">Pt</span><input type="number" value={Math.round(note.fontSize || 10)} onChange={(e) => setCustomAnnotations(prev => prev.map((n, i) => i === idx ? {...n, fontSize: parseInt(e.target.value)} : n))} className="w-8 bg-transparent border-b border-white/30 text-xs text-center focus:outline-none focus:border-white font-mono" /></div>
                                                        <div className="w-px h-4 bg-white/10"></div>
                                                        <div className="flex bg-white/5 rounded-xl overflow-hidden p-0.5">
                                                            <button onClick={(e) => { e.stopPropagation(); setCustomAnnotations(prev => prev.map((n, i) => i === idx ? {...n, textAlign: 'left'} : n)) }} className={`p-1.5 hover:bg-white/10 rounded-lg transition-colors ${note.textAlign === 'left' || !note.textAlign ? 'bg-blue-600 shadow-sm' : ''}`} title="Gauche"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h10M4 18h16" /></svg></button>
                                                            <button onClick={(e) => { e.stopPropagation(); setCustomAnnotations(prev => prev.map((n, i) => i === idx ? {...n, textAlign: 'center'} : n)) }} className={`p-1.5 hover:bg-white/10 rounded-lg transition-colors ${note.textAlign === 'center' ? 'bg-blue-600 shadow-sm' : ''}`} title="Centré"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M7 12h10M4 18h16" /></svg></button>
                                                            <button onClick={(e) => { e.stopPropagation(); setCustomAnnotations(prev => prev.map((n, i) => i === idx ? {...n, textAlign: 'right'} : n)) }} className={`p-1.5 hover:bg-white/10 rounded-lg transition-colors ${note.textAlign === 'right' ? 'bg-blue-600 shadow-sm' : ''}`} title="Droite"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M10 12h10M4 18h16" /></svg></button>
                                                        </div>
                                                        <div className="w-px h-4 bg-white/10"></div>
                                                        <button onClick={(e) => { e.stopPropagation(); setCustomAnnotations(prev => prev.map((n, i) => i === idx ? {...n, opaque: !n.opaque} : n)) }} className={`p-1.5 hover:bg-white/10 rounded-xl transition-colors ${note.opaque ? 'text-blue-400 bg-white/10' : 'text-gray-400'}`} title="Masque de fond"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5l16 16M4 19L20 5" /></svg></button>
                                                        <button onClick={(e) => { e.stopPropagation(); setCustomAnnotations(prev => prev.map((n, i) => i === idx ? {...n, rotation: 0} : n)) }} className="p-1.5 hover:bg-white/10 rounded-xl text-gray-400 transition-colors" title="Horizontal"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16" /></svg></button>
                                                        <button onClick={(e) => { e.stopPropagation(); setCustomAnnotations(prev => [...prev, { ...note, id: Date.now(), x: (parseFloat(note.x) + 2) + '%', y: (parseFloat(note.y) + 2) + '%' }]); }} className="p-1.5 hover:bg-white/10 rounded-xl text-gray-400 transition-colors" title="Dupliquer"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg></button>
                                                        <div className="w-px h-4 bg-white/10"></div>
                                                        <button onClick={(e) => { e.stopPropagation(); setCustomAnnotations(prev => prev.filter((_, i) => i !== idx)); setSelectedAnnotationId(null); }} className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/20 rounded-xl transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"></path></svg></button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="fixed bottom-24 md:bottom-6 right-6 flex flex-col space-y-2 z-20 no-print">
                        <button onClick={() => handleZoom(1.2)} className="p-3 bg-white/90 backdrop-blur shadow-lg rounded-full hover:bg-blue-50 text-blue-600 transition"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg></button>
                        <button onClick={() => handleZoom(0.8)} className="p-3 bg-white/90 backdrop-blur shadow-lg rounded-full hover:bg-blue-50 text-blue-600 transition"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4"/></svg></button>
                        <button onClick={handleResetView} className="p-3 bg-white/90 backdrop-blur shadow-lg rounded-full hover:bg-blue-50 text-blue-600 transition" title="Adapter à l'écran"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 0h-4m4 0l-5-5"/></svg></button>
                    </div>
                </main>

                <div className={`w-full md:w-[360px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-2xl transition-all duration-500 ease-in-out no-print h-full flex flex-col z-30 ${editingRiverainSegment ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full absolute bottom-0 md:top-0 right-0'}`}>
                    {editingRiverainSegment && activeRiverain && (
                        <div className="flex flex-col h-full">
                            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                                <div><h3 className="font-black text-xs uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1">Détails de Limite</h3><p className="text-sm font-bold text-gray-900 dark:text-white">Segment {editingRiverainSegment}</p></div>
                                <button onClick={() => setEditingRiverainSegment(null)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition-colors"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <div><label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase mb-2 tracking-tighter">Propriétaire / Riverain / Voie</label><input autoFocus type="text" value={activeRiverain.name} onChange={e => handleSaveRiverainUpdate({ ...activeRiverain, name: e.target.value })} className="w-full bg-gray-50/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-gray-900 dark:text-white font-semibold" placeholder="Titre foncier ou Nom..." /></div>
                                <div><label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase mb-2 tracking-tighter">Consistance / Nature</label><input type="text" value={activeRiverain.consistance} onChange={e => handleSaveRiverainUpdate({ ...activeRiverain, consistance: e.target.value })} className="w-full bg-gray-50/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-gray-900 dark:text-white font-semibold" placeholder="Ex: T.N, R+2..." /></div>
                                <div className="pt-2"><label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase mb-3 tracking-tighter">Traits de limites (Prolongements)</label><div className="grid grid-cols-2 gap-2 bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl">{[{id: 'both', label: 'Les deux'},{id: 'none', label: 'Aucun'},{id: 'start', label: 'Début'},{id: 'end', label: 'Fin'}].map(opt => (<button key={opt.id} onClick={() => handleSaveRiverainUpdate({...activeRiverain, showLimitLines: opt.id !== 'none', limitDirection: opt.id as any})} className={`py-2.5 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-2 ${((opt.id === 'none' && !activeRiverain.showLimitLines) || (activeRiverain.showLimitLines && activeRiverain.limitDirection === opt.id)) ? 'bg-white dark:bg-gray-700 shadow-md text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600'}`}>{opt.label}</button>))}</div></div>
                                <div className="space-y-3 pt-4"><label className="flex items-center justify-between p-4 rounded-2xl bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/50 cursor-pointer group hover:bg-blue-500/5 transition-colors"><div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${activeRiverain.isMitoyenne ? 'bg-blue-500/10 text-blue-600' : 'bg-gray-200 text-gray-400'}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></div><span className="text-xs font-black uppercase text-gray-600 dark:text-gray-400 group-hover:text-blue-600 transition-colors tracking-tighter">Limite Mitoyenne</span></div><div className="relative inline-flex items-center"><input type="checkbox" className="sr-only peer" checked={activeRiverain.isMitoyenne || false} onChange={e => handleSaveRiverainUpdate({ ...activeRiverain, isMitoyenne: e.target.checked })} /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div></div></label></div>
                            </div>
                            <div className="p-6 bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700"><button onClick={() => setEditingRiverainSegment(null)} className="w-full py-4 text-xs font-black uppercase tracking-widest bg-blue-600 text-white rounded-2xl hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-500/20 transition-all active:scale-95">Appliquer & Fermer</button></div>
                        </div>
                    )}
                </div>
            </div>
            {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} options={contextMenu.options} onClose={() => setContextMenu(null)} />}
        </div>
    );
};

export default BornageSketchView;
