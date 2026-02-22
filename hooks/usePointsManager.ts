
import { useCallback, SetStateAction } from 'react';
import update from 'immutability-helper';
import { Point, Notification } from '../types';

type SetPointsFn = (action: SetStateAction<Point[]>) => void;
type SetNotificationFn = (message: string, type: Notification['type']) => void;

/**
 * A hook for managing a simple list of points, designed as a compatibility layer
 * for views that operate on a single list of points within the multi-parcel system.
 * It requires a globally unique ID generator to prevent ID conflicts.
 */
export const usePointsManager = (
    setPoints: SetPointsFn, 
    setNotification: SetNotificationFn,
    getNextId: () => number // Now requires a globally unique ID generator
) => {
    
    const addPoints = useCallback((newPoints: { x: number; y: number }[]) => {
        if (newPoints.length === 0) return;

        // Generate IDs before updating state to ensure they are unique at the time of creation.
        let nextId = getNextId();
        const pointsToAdd = newPoints.map(p => ({ ...p, id: nextId++ }));

        setPoints(prevPoints => [...prevPoints, ...pointsToAdd]);
    }, [setPoints, getNextId]);

    const addPoint = useCallback((point: { x: number; y: number }) => {
        addPoints([point]);
    }, [addPoints]);

    const deletePoint = useCallback((id: number) => {
        setPoints(prevPoints => prevPoints.filter(p => p.id !== id));
    }, [setPoints]);

    const clearPoints = useCallback(() => {
        setPoints([]);
    }, [setPoints]);

    const movePoint = useCallback((dragIndex: number, hoverIndex: number) => {
        setPoints(prevPoints => {
            if (dragIndex === hoverIndex) {
                return prevPoints;
            }
            const pointToMove = prevPoints[dragIndex];
            return update(prevPoints, {
                $splice: [
                    [dragIndex, 1],
                    [hoverIndex, 0, pointToMove],
                ],
            })
        });
    }, [setPoints]);

    const updatePoint = useCallback((id: number, newCoords: { x: number; y: number }) => {
        setPoints(prevPoints => 
            prevPoints.map(p => p.id === id ? { ...p, ...newCoords } : p)
        );
    }, [setPoints]);

    return { addPoints, addPoint, deletePoint, clearPoints, movePoint, updatePoint };
};
