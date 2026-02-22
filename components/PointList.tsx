import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useDrag, useDrop, DropTargetMonitor } from 'react-dnd';
import { Point, AppSettings } from '../types';

const ItemTypes = {
  POINT: 'point',
};

interface PointItemProps {
  point: Point;
  index: number;
  onDeletePoint: (id: number) => void;
  onUpdatePoint: (id: number, coords: { x: number; y: number }) => void;
  movePoint: (dragIndex: number, hoverIndex: number) => void;
  settings: AppSettings;
  onHover: (id: number | null) => void;
  isHighlighted: boolean;
  isSearchActive: boolean;
}

const PointItem: React.FC<PointItemProps> = ({ point, index, onDeletePoint, onUpdatePoint, movePoint, settings, onHover, isHighlighted, isSearchActive }) => {
    const ref = useRef<HTMLDivElement>(null);
    const { precision, coordinateSystem } = settings;
    
    const [isEditing, setIsEditing] = useState(false);
    const [editX, setEditX] = useState(point.x.toString());
    const [editY, setEditY] = useState(point.y.toString());

    const displayPrecision = useMemo(() => 
        coordinateSystem === 'wgs84' ? Math.max(6, precision) : precision,
    [coordinateSystem, precision]);

    const labels = useMemo(() => {
        switch (coordinateSystem) {
            case 'wgs84': return { x: 'Lon', y: 'Lat' };
            default: return { x: 'X', y: 'Y' };
        }
    }, [coordinateSystem]);

    useEffect(() => {
        if (!isEditing) {
            setEditX(point.x.toString());
            setEditY(point.y.toString());
        }
    }, [point.x, point.y, isEditing]);

    const handleDoubleClick = () => {
        if (isSearchActive) return;
        setIsEditing(true);
    };

    const handleSave = () => {
        setIsEditing(false);
        const newX = parseFloat(editX);
        const newY = parseFloat(editY);
        if (!isNaN(newX) && !isNaN(newY) && (newX !== point.x || newY !== point.y)) {
            onUpdatePoint(point.id, { x: newX, y: newY });
        } else {
            setEditX(point.x.toString());
            setEditY(point.y.toString());
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        } else if (e.key === 'Escape') {
            setEditX(point.x.toString());
            setEditY(point.y.toString());
            setIsEditing(false);
        }
    };

    const [{ handlerId }, drop] = useDrop({
        accept: ItemTypes.POINT,
        canDrop: () => !isEditing,
        collect(monitor) {
            return {
                handlerId: monitor.getHandlerId(),
            };
        },
        hover(item: { index: number }, monitor: DropTargetMonitor) {
            if (!ref.current || isSearchActive || isEditing) {
                return;
            }
            const dragIndex = item.index;
            const hoverIndex = index;

            if (dragIndex === hoverIndex) {
                return;
            }
            movePoint(dragIndex, hoverIndex);
            item.index = hoverIndex;
        },
    });

    const [{ isDragging }, drag] = useDrag({
        type: ItemTypes.POINT,
        item: () => ({ id: point.id, index }),
        canDrag: !isSearchActive && !isEditing,
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });
    
    drag(drop(ref));

    const commonInputClass = "w-full text-sm font-mono bg-white dark:bg-gray-700 border border-blue-500 rounded-md px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500";

    return (
        <div
            ref={ref}
            onMouseEnter={() => onHover(point.id)}
            onMouseLeave={() => onHover(null)}
            data-handler-id={handlerId}
            style={{ opacity: isDragging ? 0.5 : 1 }}
            className={`flex items-center justify-between p-2 rounded-md mb-2 shadow-sm transition-all duration-200 ${isSearchActive ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${isHighlighted ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-gray-50 dark:bg-gray-800'}`}
        >
          <div className="flex items-center space-x-3 flex-grow min-w-0">
              <span className="font-mono text-xs text-gray-500 dark:text-gray-400 w-auto px-2 h-6 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-md flex-shrink-0">B{index + 1}</span>
              <div className="flex-grow font-mono text-sm min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold text-gray-500 dark:text-gray-400">
                          ID: {point.id}
                          {point.image && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-blue-500 ml-1 inline" viewBox="0 0 20 20" fill="currentColor">
                                <title>Photo disponible</title>
                                <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                            </svg>
                          )}
                      </span>
                      <div onDoubleClick={handleDoubleClick} title={isEditing ? '' : "Double-cliquez pour modifier"}>
                          {isEditing ? (
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <label htmlFor={`x-edit-${point.id}`} className="font-semibold">{labels.x}:</label>
                                  <input 
                                    id={`x-edit-${point.id}`}
                                    type="number"
                                    step="any"
                                    value={editX}
                                    onChange={(e) => setEditX(e.target.value)}
                                    onBlur={handleSave}
                                    onKeyDown={handleKeyDown}
                                    className={`${commonInputClass} flex-1 min-w-[10ch]`}
                                    autoFocus
                                    onFocus={(e) => e.target.select()}
                                  />
                                  <label htmlFor={`y-edit-${point.id}`} className="font-semibold sm:ml-2">{labels.y}:</label>
                                  <input 
                                    id={`y-edit-${point.id}`}
                                    type="number"
                                    step="any"
                                    value={editY}
                                    onChange={(e) => setEditY(e.target.value)}
                                    onBlur={handleSave}
                                    onKeyDown={handleKeyDown}
                                    className={`${commonInputClass} flex-1 min-w-[10ch]`}
                                  />
                              </div>
                          ) : (
                              <span className="cursor-text">
                                  {labels.x}: {point.x.toFixed(displayPrecision)}, {labels.y}: {point.y.toFixed(displayPrecision)}
                              </span>
                          )}
                      </div>
                  </div>
              </div>
          </div>
          <button onClick={() => onDeletePoint(point.id)} aria-label={`Supprimer le sommet ${point.id}`} className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1 rounded-full transition duration-200 ml-2 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
          </button>
        </div>
    );
};


interface PointListProps {
  points: Point[];
  onDeletePoint: (id: number) => void;
  onUpdatePoint: (id: number, coords: { x: number; y: number }) => void;
  onClearPoints: () => void;
  movePoint: (dragIndex: number, hoverIndex: number) => void;
  settings: AppSettings;
  highlightedPointId: number | null;
  setHighlightedPointId: (id: number | null) => void;
}

const PointList: React.FC<PointListProps> = ({ points, onDeletePoint, onUpdatePoint, onClearPoints, movePoint, settings, highlightedPointId, setHighlightedPointId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredPointId, setHoveredPointId] = useState<number | null>(null);

  const handleClear = () => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer les ${points.length} sommets ? Cette action est irréversible.`)) {
      onClearPoints();
    }
  };
  
  const filteredPoints = useMemo(() => {
    if (!searchTerm.trim()) {
      return points;
    }
    const lowercasedFilter = searchTerm.toLowerCase().replace(/\s+/g, '');
    
    if (lowercasedFilter === '') return points;

    return points.filter((point, index) => {
      const displayPrecision = settings.coordinateSystem === 'wgs84' ? Math.max(6, settings.precision) : settings.precision;
      const pointLabel = `b${index + 1}`;
      
      return (
        pointLabel.includes(lowercasedFilter) ||
        point.id.toString().includes(lowercasedFilter) ||
        point.x.toFixed(displayPrecision).includes(lowercasedFilter) ||
        point.y.toFixed(displayPrecision).includes(lowercasedFilter)
      );
    });
  }, [points, searchTerm, settings]);

  const isSearchActive = !!searchTerm.trim();

  useEffect(() => {
    if (hoveredPointId !== null) {
        // Hover takes precedence
        setHighlightedPointId(hoveredPointId);
    } else if (isSearchActive && filteredPoints.length === 1) {
        // If not hovering, highlight the single search result
        setHighlightedPointId(filteredPoints[0].id);
    } else {
        // Otherwise, no highlight
        setHighlightedPointId(null);
    }
  }, [hoveredPointId, filteredPoints, isSearchActive, setHighlightedPointId]);

  return (
    <div>
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-md font-semibold">Liste des sommets ({points.length})</h3>
            {points.length > 0 && (
                <button 
                    onClick={handleClear} 
                    className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400 font-semibold"
                >
                    Tout effacer
                </button>
            )}
        </div>

        {points.length > 0 && (
            <div className="mb-3 relative">
                <input
                    type="text"
                    placeholder="Rechercher par ID, sommet (ex: B1) ou coord..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute top-1/2 left-2.5 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
        )}
      
      {points.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Aucun sommet. Ajoutez des sommets via le formulaire, la carte ou l'importation.</p>
      ) : filteredPoints.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Aucun sommet ne correspond à votre recherche.</p>
      ) : (
        <div className="max-h-60 overflow-y-auto pr-2">
          {filteredPoints.map((point) => {
             const originalIndex = points.findIndex(p => p.id === point.id);
             return (
                <PointItem 
                  key={point.id} 
                  index={originalIndex} 
                  point={point} 
                  onDeletePoint={onDeletePoint} 
                  onUpdatePoint={onUpdatePoint}
                  movePoint={movePoint} 
                  settings={settings}
                  onHover={setHoveredPointId}
                  isHighlighted={point.id === highlightedPointId}
                  isSearchActive={isSearchActive}
                />
             );
          })}
        </div>
      )}
    </div>
  );
};

export default PointList;