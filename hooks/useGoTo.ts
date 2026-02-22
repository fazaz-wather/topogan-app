import { useState, useCallback } from 'react';
import { CoordinateSystem, Notification } from '../types';
import { coordinateTransformationService } from '../services/coordinateTransformationService';

type SetNotificationFn = (message: string, type: Notification['type'], duration?: number) => void;

/**
 * Encapsulates the logic for the "Go To Coordinate" feature, including modal state and coordinate transformation.
 */
export const useGoTo = (setNotification: SetNotificationFn) => {
    const [isGoToModalOpen, setIsGoToModalOpen] = useState(false);
    const [goToCoords, setGoToCoords] = useState<{ point: { x: number; y: number }, key: number } | null>(null);

    const openGoToModal = useCallback(() => setIsGoToModalOpen(true), []);
    const closeGoToModal = useCallback(() => setIsGoToModalOpen(false), []);

    const handleGoTo = useCallback((coords: { x: number, y: number }, system: CoordinateSystem) => {
        let wgsCoords = { x: coords.x, y: coords.y }; // WGS84 uses x for lon, y for lat
        
        if (system !== 'wgs84') {
            const transformed = coordinateTransformationService.transform(coords, system, 'wgs84');
            if (!transformed) {
                setNotification(`Impossible de transformer les coordonnées de ${system}. Vérifiez qu'elles sont dans les limites de la zone.`, 'error');
                return;
            }
            // The service returns { x: lon, y: lat } which is what we need.
            wgsCoords = transformed;
        }

        setGoToCoords({ point: wgsCoords, key: Date.now() });
        setNotification('Recentrage de la carte sur les coordonnées spécifiées...', 'info');
    }, [setNotification]);

    return {
        goToCoords,
        isGoToModalOpen,
        openGoToModal,
        closeGoToModal,
        handleGoTo,
    };
};