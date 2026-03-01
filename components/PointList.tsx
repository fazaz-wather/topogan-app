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
  onAddPhoto: (id: number) => void;
  movePoint: (dragIndex: number, hoverIndex: number) => void;
  settings: AppSettings;
  onHover: (id: number | null) => void;
  isHighlighted: boolean;
  isSearchActive: boolean;
}

const PointItem: React.FC<PointItemProps> = ({ point, index, onDeletePoint, onUpdatePoint, onAddPhoto, movePoint, settings, onHover, isHighlighted, isSearchActive }) => {
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

    const commonInputClass = "bsport-input py-1 px-2 text-xs h-auto w-full";

    return (
        <div
            ref={ref}
            onMouseEnter={() => onHover(point.id)}
            onMouseLeave={() => onHover(null)}
            data-handler-id={handlerId}
            style={{ opacity: isDragging ? 0.5 : 1 }}
            className={`flex items-center p-2 rounded-lg mb-1 transition-all duration-200 border border-transparent text-xs ${isSearchActive ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${isHighlighted ? 'bg-[#4F46E5]/10 border-[#4F46E5]/30' : 'bg-white dark:bg-[#1E293B] hover:bg-gray-50 dark:hover:bg-[#334155] border-gray-100 dark:border-gray-700'}`}
        >
          {/* ID Column */}
          <div className="w-12 flex-shrink-0 font-mono font-bold text-[#4F46E5]">B{index + 1}</div>
          
          {/* Coordinates Columns */}
          <div className="flex-grow grid grid-cols-2 gap-2 px-2" onDoubleClick={handleDoubleClick} title={isEditing ? '' : "Double-cliquez pour modifier"}>
              {isEditing ? (
                  <>
                      <input 
                        id={`x-edit-${point.id}`}
                        type="number"
                        step="any"
                        value={editX}
                        onChange={(e) => setEditX(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className={commonInputClass}
                        autoFocus
                        onFocus={(e) => e.target.select()}
                        placeholder="X"
                      />
                      <input 
                        id={`y-edit-${point.id}`}
                        type="number"
                        step="any"
                        value={editY}
                        onChange={(e) => setEditY(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className={commonInputClass}
                        placeholder="Y"
                      />
                  </>
              ) : (
                  <>
                      <div className="font-mono truncate text-gray-600 dark:text-gray-300">{point.x.toFixed(displayPrecision)}</div>
                      <div className="font-mono truncate text-gray-600 dark:text-gray-300">{point.y.toFixed(displayPrecision)}</div>
                  </>
              )}
          </div>

          {/* Actions Column */}
          <div className="flex items-center space-x-1 w-16 justify-end flex-shrink-0">
              <button 
                  onClick={() => onAddPhoto(point.id)} 
                  title={point.image ? "Modifier la photo" : "Ajouter une photo"}
                  className={`p-1 rounded transition duration-200 ${point.image ? 'text-[#4F46E5] hover:text-[#4338CA]' : 'text-gray-400 hover:text-[#4F46E5]'}`}
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
              </button>
              <button onClick={() => setIsEditing(true)} aria-label={`Modifier le sommet ${point.id}`} className="text-gray-400 hover:text-blue-500 p-1 rounded transition duration-200">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
              </button>
              <button onClick={() => onDeletePoint(point.id)} aria-label={`Supprimer le sommet ${point.id}`} className="text-gray-400 hover:text-red-500 p-1 rounded transition duration-200">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
              </button>
          </div>
        </div>
    );
};


interface PointListProps {
  points: Point[];
  onDeletePoint: (id: number) => void;
  onUpdatePoint: (id: number, coords: { x: number; y: number }) => void;
  onAddPhoto: (id: number) => void;
  onClearPoints: () => void;
  movePoint: (dragIndex: number, hoverIndex: number) => void;
  settings: AppSettings;
  highlightedPointId: number | null;
  setHighlightedPointId: (id: number | null) => void;
}

const PointList: React.FC<PointListProps> = ({ points, onDeletePoint, onUpdatePoint, onAddPhoto, onClearPoints, movePoint, settings, highlightedPointId, setHighlightedPointId }) => {
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

  const labels = useMemo(() => {
      switch (settings.coordinateSystem) {
          case 'wgs84': return { x: 'Lon', y: 'Lat' };
          default: return { x: 'X', y: 'Y' };
      }
  }, [settings.coordinateSystem]);

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
        <div className="flex justify-between items-center mb-3">
            <h3 className="bsport-label mb-0">Liste des sommets ({points.length})</h3>
            {points.length > 0 && (
                <button 
                    onClick={handleClear} 
                    className="text-[11px] font-bold text-[#EF4444] hover:text-[#DC2626] uppercase tracking-wider transition-colors"
                >
                    Tout effacer
                </button>
            )}
        </div>

        {points.length > 0 && (
            <div className="mb-4 relative">
                <input
                    type="text"
                    placeholder="Rechercher par ID, sommet (ex: B1) ou coord..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bsport-input pl-9 py-2 text-xs"
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute top-1/2 left-3 transform -translate-y-1/2 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <div className="flex items-center p-2 mb-1 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/50 rounded-lg sticky top-0 z-10 backdrop-blur-sm">
              <div className="w-12 flex-shrink-0">N°</div>
              <div className="flex-grow grid grid-cols-2 gap-2 px-2">
                  <div>{labels.x}</div>
                  <div>{labels.y}</div>
              </div>
              <div className="w-14 flex-shrink-0 text-right">Actions</div>
          </div>
          {filteredPoints.map((point) => {
             const originalIndex = points.findIndex(p => p.id === point.id);
             return (
                <PointItem 
                  key={point.id} 
                  index={originalIndex} 
                  point={point} 
                  onDeletePoint={onDeletePoint} 
                  onUpdatePoint={onUpdatePoint}
                  onAddPhoto={onAddPhoto}
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