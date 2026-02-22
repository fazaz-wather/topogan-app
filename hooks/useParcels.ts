import React, { useCallback, useRef } from 'react';
import update from 'immutability-helper';
import { Parcel, Point, Notification } from '../types';

type SetParcelsFn = (action: React.SetStateAction<Parcel[]>) => void;
type SetNotificationFn = (message: string, type: Notification['type']) => void;

const PARCEL_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f97316', '#8b5cf6', '#eab308', '#14b8a6', '#ec4899'];

export const useParcels = (parcels: Parcel[], setParcels: SetParcelsFn, setNotification: SetNotificationFn) => {

    const getNextPointId = useCallback(() => {
        if (parcels.length === 0) return 1;
        const allPoints = parcels.flatMap(p => p.points);
        if (allPoints.length === 0) return 1;
        return Math.max(0, ...allPoints.map(p => p.id)) + 1;
    }, [parcels]);

    const getNextParcelId = useCallback(() => {
        if (parcels.length === 0) return 1;
        return Math.max(0, ...parcels.map(p => p.id)) + 1;
    }, [parcels]);
    
    const addParcel = useCallback((name?: string, points: {x: number, y: number}[] = []) => {
        const nextId = getNextParcelId();
        let pointIdCounter = getNextPointId();
        
        const newParcel: Parcel = {
            id: nextId,
            name: name || `Parcelle ${nextId}`,
            points: points.map(p => ({ ...p, id: pointIdCounter++ })),
            color: PARCEL_COLORS[(nextId - 1) % PARCEL_COLORS.length],
            isVisible: true,
            riverains: [], // Initialisation vide
        };
        setParcels(prev => [...prev, newParcel]);
        return newParcel;
    }, [setParcels, getNextParcelId, getNextPointId]);

    const deleteParcel = useCallback((parcelId: number) => {
        setParcels(prev => {
            if (prev.length <= 1) {
                setNotification("Vous ne pouvez pas supprimer la dernière parcelle.", "error");
                return prev;
            }
            return prev.filter(p => p.id !== parcelId);
        });
    }, [setParcels, setNotification]);

    const updateParcel = useCallback((parcelId: number, updates: Partial<Omit<Parcel, 'id' | 'points'>>) => {
        setParcels(prev => prev.map(p => p.id === parcelId ? { ...p, ...updates } : p));
    }, [setParcels]);
    
    const updateParcelPoints = useCallback((parcelId: number, action: React.SetStateAction<Point[]>) => {
        setParcels(prev => prev.map(p => {
            if (p.id === parcelId) {
                const newPoints = typeof action === 'function' ? action(p.points) : action;
                return { ...p, points: newPoints };
            }
            return p;
        }));
    }, [setParcels]);

    const addPoints = useCallback((parcelId: number, newPoints: { x: number; y: number }[]) => {
        if (newPoints.length === 0) return;
        let nextId = getNextPointId();
        const pointsToAdd = newPoints.map(p => ({ ...p, id: nextId++ }));
        updateParcelPoints(parcelId, prevPoints => [...prevPoints, ...pointsToAdd]);
    }, [updateParcelPoints, getNextPointId]);

    const addPoint = useCallback((parcelId: number, point: { x: number; y: number }) => {
        addPoints(parcelId, [point]);
    }, [addPoints]);

    const deletePoint = useCallback((parcelId: number, pointId: number) => {
        updateParcelPoints(parcelId, prevPoints => prevPoints.filter(p => p.id !== pointId));
    }, [updateParcelPoints]);
    
    const clearPoints = useCallback((parcelId: number) => {
        updateParcelPoints(parcelId, []);
    }, [updateParcelPoints]);
    
    const movePoint = useCallback((parcelId: number, dragIndex: number, hoverIndex: number) => {
         updateParcelPoints(parcelId, prevPoints => 
            update(prevPoints, {
                $splice: [
                    [dragIndex, 1],
                    [hoverIndex, 0, prevPoints[dragIndex]],
                ],
            })
        );
    }, [updateParcelPoints]);
    
    const updatePoint = useCallback((parcelId: number, pointId: number, newCoords: { x: number, y: number }) => {
        updateParcelPoints(parcelId, prevPoints => 
            prevPoints.map(p => p.id === pointId ? { ...p, ...newCoords } : p)
        );
    }, [updateParcelPoints]);


    return { addParcel, deleteParcel, updateParcel, updateParcelPoints, addPoints, addPoint, deletePoint, clearPoints, movePoint, updatePoint, getNextPointId };
};