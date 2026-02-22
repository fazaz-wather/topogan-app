
import { DistanceUnit, AreaUnit } from '../types';

// --- Conversion Factors (base units are meters and square meters) ---
const METERS_TO_FEET = 3.28084;
const METERS_TO_KILOMETERS = 0.001;
const METERS_TO_MILES = 0.000621371;

const SQMETERS_TO_SQFEET = 10.7639;
const SQMETERS_TO_HECTARES = 0.0001;
const SQMETERS_TO_ACRES = 0.000247105;

// --- Conversion Maps ---
const distanceConversionMap: Record<DistanceUnit, { factor: number; label: string }> = {
  meters: { factor: 1, label: 'm' },
  feet: { factor: METERS_TO_FEET, label: 'ft' },
  kilometers: { factor: METERS_TO_KILOMETERS, label: 'km' },
  miles: { factor: METERS_TO_MILES, label: 'mi' },
};

const areaConversionMap: Record<AreaUnit, { factor: number; label: string }> = {
  squareMeters: { factor: 1, label: 'm²' },
  squareFeet: { factor: SQMETERS_TO_SQFEET, label: 'ft²' },
  hectares: { factor: SQMETERS_TO_HECTARES, label: 'ha' },
  acres: { factor: SQMETERS_TO_ACRES, label: 'ac' },
  ha_a_ca: { factor: 1, label: 'ha a ca' },
};

/**
 * Converts a distance from meters to the specified unit.
 * @param distanceInMeters The distance in meters.
 * @param unit The target unit.
 * @returns The converted distance.
 */
export const convertDistance = (distanceInMeters: number, unit: DistanceUnit): number => {
  return distanceInMeters * (distanceConversionMap[unit]?.factor || 1);
};

/**
 * Converts an area from square meters to the specified unit.
 * @param areaInSqMeters The area in square meters.
 * @param unit The target unit.
 * @returns The converted area.
 */
export const convertArea = (areaInSqMeters: number, unit: AreaUnit): number => {
  return areaInSqMeters * (areaConversionMap[unit]?.factor || 1);
};

/**
 * Gets the display label for a given distance unit.
 * @param unit The distance unit.
 * @returns The unit's label (e.g., "m", "ft").
 */
export const getDistanceUnitLabel = (unit: DistanceUnit): string => {
  return distanceConversionMap[unit]?.label || 'unités';
};

/**
 * Gets the display label for a given area unit.
 * @param unit The area unit.
 * @returns The unit's label (e.g., "m²", "ha").
 */
export const getAreaUnitLabel = (unit: AreaUnit): string => {
  return areaConversionMap[unit]?.label || 'unités²';
};

/**
 * Formats an area value into a string with its corresponding unit label.
 * Handles special formatting for 'ha_a_ca'.
 * @param areaInSqMeters The area in square meters.
 * @param unit The target unit.
 * @param precision The number of decimal places for the final value.
 * @returns A formatted string (e.g., "1.234 ha", "1 ha 23 a 45.67 ca").
 */
export const formatArea = (areaInSqMeters: number, unit: AreaUnit, precision: number): string => {
    if (unit === 'ha_a_ca') {
        if (isNaN(areaInSqMeters)) return `0.${'0'.repeat(precision)} ca`;
        
        const totalCentiares = areaInSqMeters;
        const hectares = Math.floor(totalCentiares / 10000);
        const ares = Math.floor((totalCentiares % 10000) / 100);
        const centiares = totalCentiares % 100;

        const parts = [];
        if (hectares > 0) {
            parts.push(`${hectares} ha`);
            parts.push(`${ares} a`);
            parts.push(`${centiares.toFixed(precision)} ca`);
        } else if (ares > 0) {
            parts.push(`${ares} a`);
            parts.push(`${centiares.toFixed(precision)} ca`);
        } else {
            parts.push(`${centiares.toFixed(precision)} ca`);
        }
        return parts.join(' ');
    }

    // Default behavior for other units
    const displayedArea = convertArea(areaInSqMeters, unit);
    const areaLabel = getAreaUnitLabel(unit);
    return `${displayedArea.toFixed(precision)} ${areaLabel}`;
};
