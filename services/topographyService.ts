
import { Point, DistanceResult, CoordinateSystem } from '../types';

const toRadians = (deg: number): number => deg * Math.PI / 180;
const toDegrees = (rad: number): number => rad * 180 / Math.PI;


/**
 * Calculates the area of a polygon using the Shoelace formula.
 * For WGS84, it projects coordinates to a local tangent plane before calculation.
 * @param points - An array of points representing the polygon's vertices in order.
 * @param system - The coordinate system of the points.
 * @returns The area of the polygon in square units (square meters for projected/WGS84).
 */
export const calculatePolygonArea = (points: Point[], system: CoordinateSystem = 'local'): number => {
  const n = points.length;
  if (n < 3) {
    return 0;
  }

  let pointsToCalculate = points;

  if (system === 'wgs84') {
    // Project to a local tangent plane (equirectangular projection) for area calculation.
    // This is an approximation but good for small areas.
    const R = 6371e3; // Earth's radius in meters

    // Find centroid to minimize distortion
    let avgLat = 0;
    let avgLon = 0;
    for (const p of points) {
      avgLat += p.y;
      avgLon += p.x;
    }
    avgLat /= n;
    
    const cosAvgLat = Math.cos(toRadians(avgLat));

    pointsToCalculate = points.map(p => {
      const x = toRadians(p.x) * R * cosAvgLat;
      const y = toRadians(p.y) * R;
      return { id: p.id, x, y };
    });
  }

  // Shoelace formula on planar (or projected) coordinates
  let area = 0;
  for (let i = 0; i < n; i++) {
    const p1 = pointsToCalculate[i];
    const p2 = pointsToCalculate[(i + 1) % n];
    area += (p1.x * p2.y - p2.x * p1.y);
  }

  return Math.abs(area / 2.0);
};

/**
 * Calculates the distance between two points, adapting to the coordinate system.
 * @param p1 - The first point.
 * @param p2 - The second point.
 * @param system - The coordinate system.
 * @returns The distance between the two points (in meters for WGS84).
 */
export const calculateDistanceBetweenPoints = (p1: Point, p2: Point, system: CoordinateSystem = 'local'): number => {
   if (system === 'wgs84') {
    // Haversine formula for geodetic distance
    const R = 6371e3; // Earth's radius in metres
    const lat1Rad = toRadians(p1.y);
    const lat2Rad = toRadians(p2.y);
    const deltaLat = toRadians(p2.y - p1.y);
    const deltaLon = toRadians(p2.x - p1.x);

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
  }
  // Euclidean distance for planar systems
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

/**
 * Calculates the distances of all segments of a polygon.
 * @param points - An array of points representing the polygon's vertices in order.
 * @param system - The coordinate system.
 * @returns An array of objects, each containing the start point ID, end point ID, and distance.
 */
export const calculateDistances = (points: Point[], system: CoordinateSystem = 'local'): DistanceResult[] => {
  const distances: DistanceResult[] = [];
  const n = points.length;

  if (n < 2) {
    return [];
  }

  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    distances.push({
      from: p1.id,
      to: p2.id,
      distance: calculateDistanceBetweenPoints(p1, p2, system),
    });
  }

  return distances;
};

/**
 * Calculates the coordinates of a new point based on a station, azimuth, and distance.
 * NOTE: This is a planar calculation and should not be used with WGS84 coordinates.
 * @param station The starting point (station).
 * @param azimuthDegrees The angle from North in degrees (0-360).
 * @param distance The horizontal distance to the new point.
 * @returns The coordinates of the new point.
 */
export const calculateCoordinatesFromRadiation = (
  station: Point,
  azimuthDegrees: number,
  distance: number
): { x: number; y: number } => {
  const azimuthRadians = azimuthDegrees * (Math.PI / 180);
  const deltaX = distance * Math.sin(azimuthRadians);
  const deltaY = distance * Math.cos(azimuthRadians);
  return {
    x: station.x + deltaX,
    y: station.y + deltaY,
  };
};

/**
 * Calculates intermediate points along a straight line between two points.
 * NOTE: This is a planar calculation and should not be used with WGS84 coordinates.
 * @param startPoint The first point defining the alignment.
 * @param endPoint The second point defining the alignment.
 * @param numPoints The number of intermediate points to generate.
 * @returns An array of coordinates for the new intermediate points.
 */
export const calculateAlignmentPoints = (
  startPoint: Point,
  endPoint: Point,
  numPoints: number
): { x: number; y: number }[] => {
  const newPoints: { x: number; y: number }[] = [];
  const totalSegments = numPoints + 1;

  for (let i = 1; i <= numPoints; i++) {
    const fraction = i / totalSegments;
    const newX = startPoint.x + fraction * (endPoint.x - startPoint.x);
    const newY = startPoint.y + fraction * (endPoint.y - startPoint.y);
    newPoints.push({ x: newX, y: newY });
  }

  return newPoints;
};

/**
 * Calculates the angle (in degrees) at point B for the triangle A-B-C.
 * NOTE: This is a planar calculation. For WGS84, it would require spherical trigonometry.
 * @param pA Point A
 * @param pB Point B (the vertex of the angle)
 * @param pC Point C
 * @returns The angle in decimal degrees, or NaN if points are collinear.
 */
export const calculateAngleBetweenPoints = (pA: Point, pB: Point, pC: Point): number => {
    // Using planar distance for this calculation as it's a tool for planar systems.
    const a = calculateDistanceBetweenPoints(pB, pC, 'local');
    const b = calculateDistanceBetweenPoints(pA, pC, 'local');
    const c = calculateDistanceBetweenPoints(pA, pB, 'local');

    // Law of Cosines: b^2 = a^2 + c^2 - 2ac*cos(B)
    const cosB = (a * a + c * c - b * b) / (2 * a * c);

    // Clamp the value to the [-1, 1] range to avoid floating point errors with acos
    const clampedCosB = Math.max(-1, Math.min(1, cosB));
    
    const angleRad = Math.acos(clampedCosB);
    
    return angleRad * (180 / Math.PI);
};

/**
 * Calculates the bearing (azimuth) in degrees from point 1 to point 2.
 * Adapts the calculation for the given coordinate system.
 * @param p1 The starting point.
 * @param p2 The ending point.
 * @param system The coordinate system.
 * @returns The bearing in decimal degrees (0-360).
 */
export const calculateBearing = (p1: Point, p2: Point, system: CoordinateSystem = 'local'): number => {
  if (system === 'wgs84') {
    const lat1 = toRadians(p1.y);
    const lon1 = toRadians(p1.x);
    const lat2 = toRadians(p2.y);
    const lon2 = toRadians(p2.x);

    const deltaLon = lon2 - lon1;

    const y = Math.sin(deltaLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
    
    let brng = Math.atan2(y, x);
    brng = toDegrees(brng);
    return (brng + 360) % 360; // normalize to 0-360
  }

  // Planar bearing
  const deltaX = p2.x - p1.x;
  const deltaY = p2.y - p1.y;

  if (deltaX === 0 && deltaY === 0) {
    return 0; // Points are identical
  }

  const angleRad = Math.atan2(deltaX, deltaY);
  let angleDeg = toDegrees(angleRad);

  // Normalize to 0-360
  if (angleDeg < 0) {
    angleDeg += 360;
  }

  return angleDeg;
};

/**
 * Converts decimal degrees to Degrees, Minutes, Seconds format.
 * @param dd Decimal degrees
 * @returns A string in the format "DDD° MM' SS.ss"".
 */
export const convertDecimalDegreesToDMS = (dd: number): string => {
    if (isNaN(dd)) return "Indéfini";
    const deg = Math.floor(dd);
    const minFloat = (dd - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = ((minFloat - min) * 60).toFixed(2);
    return `${deg}° ${min}' ${sec}"`;
};

/**
 * Converts decimal degrees to a DMS object.
 * @param dd Decimal degrees
 * @returns An object { d, m, s }.
 */
export const convertDDToDMS = (dd: number): { d: number, m: number, s: number } => {
    const absDd = Math.abs(dd);
    const d = Math.floor(absDd);
    const minFloat = (absDd - d) * 60;
    const m = Math.floor(minFloat);
    const s = (minFloat - m) * 60;
    return { d: dd < 0 ? -d : d, m, s };
};

/**
 * Parses numeric DMS values into decimal degrees.
 * @param d Degrees
 * @param m Minutes
 * @param s Seconds
 * @returns A number in decimal degrees.
 */
export const parseDMSToDD = (d: number, m: number, s: number): number => {
    if (isNaN(d) || isNaN(m) || isNaN(s)) return NaN;
    const sign = d < 0 ? -1 : 1;
    return sign * (Math.abs(d) + m / 60 + s / 3600);
};


/**
 * Calculates the intersection point of two lines defined by four points.
 * NOTE: This is a planar calculation and should not be used with WGS84 coordinates.
 * @param p1 Start point of line 1
 * @param p2 End point of line 1
 * @param p3 Start point of line 2
 * @param p4 End point of line 2
 * @returns The intersection point coordinates, or null if lines are parallel.
 */
export const calculateLineIntersection = (
  p1: Point, p2: Point, p3: Point, p4: Point
): { x: number; y: number } | null => {
  const den = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);

  if (Math.abs(den) < 1e-9) {
    return null; // Lines are parallel or collinear
  }

  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / den;
  
  const intersectX = p1.x + t * (p2.x - p1.x);
  const intersectY = p1.y + t * (p2.y - p1.y);
  
  return { x: intersectX, y: intersectY };
};

/**
 * Calculates resection (three-point problem) to find the observer's location.
 * NOTE: This is a planar calculation and should not be used with WGS84 coordinates.
 * @param pA First known point.
 * @param pB Second known point (central).
 * @param pC Third known point.
 * @param angleAPB_deg Angle measured at the unknown station between A and B, in degrees.
 * @param angleBPC_deg Angle measured at the unknown station between B and C, in degrees.
 * @returns The coordinates of the unknown station P, or null if on the danger circle.
 */
export const calculateResection = (
  pA: Point, pB: Point, pC: Point, 
  angleAPB_deg: number, angleBPC_deg: number
): { x: number; y: number } | null => {
  // Using the cotangent method for solving the system of equations
  // derived from the geometry of the problem.
  const T1 = 1 / Math.tan(angleAPB_deg * Math.PI / 180);
  const T2 = 1 / Math.tan(angleBPC_deg * Math.PI / 180);

  const D_N1 = pA.x - pB.x - T1 * (pA.y - pB.y);
  const D_D1 = pA.y - pB.y + T1 * (pA.x - pB.x);
  const K_A = pA.x * pA.x + pA.y * pA.y;
  const K_B = pB.x * pB.x + pB.y * pB.y;
  const D_C1 = K_A - K_B - T1 * ( (pA.x-pB.x)*(pA.y+pB.y) - (pA.y-pB.y)*(pA.x+pB.x) );

  const D_N2 = pB.x - pC.x - T2 * (pB.y - pC.y);
  const D_D2 = pB.y - pC.y + T2 * (pB.x - pC.x);
  const K_C = pC.x * pC.x + pC.y * pC.y;
  const D_C2 = K_B - K_C - T2 * ( (pB.x-pC.x)*(pB.y+pC.y) - (pB.y-pC.y)*(pB.x+pC.x) );
  
  const den_final = D_N1*D_D2 - D_N2*D_D1;
  if(Math.abs(den_final) < 1e-9) return null; // Danger circle condition

  const Px_calc = (D_C1 * D_D2 - D_C2 * D_D1) / (2 * den_final);
  const Py_calc = (D_C2 * D_N1 - D_C1 * D_N2) / (2 * den_final);

  return {x: Px_calc, y: Py_calc};
};

/**
 * Calculates the centroid of a polygon.
 * @param points - An array of points representing the polygon's vertices in order.
 * @returns The coordinates of the centroid, or null if not a valid polygon.
 */
export const calculateCentroid = (points: Point[]): { x: number; y: number } | null => {
  const n = points.length;
  if (n < 3) {
    return null;
  }
  
  let area = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const crossProduct = (p1.x * p2.y - p2.x * p1.y);
    area += crossProduct;
    cx += (p1.x + p2.x) * crossProduct;
    cy += (p1.y + p2.y) * crossProduct;
  }

  area /= 2;

  if (Math.abs(area) < 1e-9) {
    // Fallback for zero-area polygons (collinear points)
    let sumX = 0;
    let sumY = 0;
    for(const p of points) {
        sumX += p.x;
        sumY += p.y;
    }
    return { x: sumX / n, y: sumY / n };
  }

  return {
    x: cx / (6 * area),
    y: cy / (6 * area)
  };
};


// --- New Compensated Traverse Calculation ---
export interface TraverseLeg {
    angle: number; // Angle measured at the station (in degrees)
    distance: number;
}

export interface CompensatedTraverseResult {
    unadjustedPoints: { x: number; y: number }[];
    adjustedPoints: { x: number; y: number }[];
    closingError: { dx: number; dy: number; total: number };
    angularError?: { degrees: number; perStation: number };
    totalDistance: number;
    relativePrecision: number;
}

/**
 * Calculates and adjusts a traverse using angular and linear misclosure adjustments (Compass Rule).
 * @param startPoint The known starting point of the traverse.
 * @param endPoint The known closing point of the traverse.
 * @param initialBearing The bearing of the first leg in decimal degrees.
 * @param legs An array of measured angles (right-hand) and distances.
 * @param closingReferencePoint Optional known point for closing angle check.
 * @param measuredClosingAngle Optional measured angle at the end station to the closing reference point.
 * @returns A detailed result object with unadjusted/adjusted points and error analysis.
 */
export const calculateCompensatedTraverse = (
    startPoint: Point,
    endPoint: Point,
    initialBearing: number,
    legs: TraverseLeg[],
    closingReferencePoint?: Point,
    measuredClosingAngle?: number
): CompensatedTraverseResult | null => {
    if (legs.length === 0) return null;

    let totalDistance = 0;
    legs.forEach(leg => totalDistance += leg.distance);

    let bearings: number[] = [];
    let unadjustedPoints: { x: number; y: number }[] = [];
    let currentPoint: Point = { ...startPoint };
    let currentBearing = initialBearing;

    // 1. Calculate unadjusted coordinates and bearings
    for (const leg of legs) {
        bearings.push(currentBearing);
        const newPoint = calculateCoordinatesFromRadiation(currentPoint, currentBearing, leg.distance);
        unadjustedPoints.push(newPoint);
        // Assumes interior angles measured clockwise (angle to the right)
        currentBearing = (currentBearing + 180 + leg.angle) % 360;
        currentPoint = { ...newPoint, id: -1 };
    }

    // 2. Angular Misclosure Calculation & Adjustment (if applicable)
    let angularError: { degrees: number; perStation: number } | undefined = undefined;
    let adjustedLegs = [...legs];

    if (closingReferencePoint && measuredClosingAngle !== undefined && unadjustedPoints.length > 0) {
        // Theoretical closing bearing: from the *known* end point to the closing reference
        const theoreticalClosingBearing = calculateBearing(endPoint, closingReferencePoint, 'local');

        // "Measured" closing bearing, derived from the traverse's calculated orientation at the end point
        const finalBackBearing = (bearings[bearings.length - 1] + 180) % 360;
        const measuredClosingBearing = (finalBackBearing + measuredClosingAngle) % 360;
        
        let errorDegrees = theoreticalClosingBearing - measuredClosingBearing;
        // Normalize error to be between -180 and 180
        if (errorDegrees > 180) errorDegrees -= 360;
        if (errorDegrees < -180) errorDegrees += 360;
        
        const correctionPerStation = -errorDegrees / legs.length; // Distribute correction
        
        angularError = { degrees: errorDegrees, perStation: correctionPerStation };

        // Apply correction to each angle
        adjustedLegs = legs.map(leg => ({
            ...leg,
            angle: leg.angle + correctionPerStation
        }));

        // 3. Recalculate traverse with adjusted angles
        unadjustedPoints = []; // Reset and recalculate
        bearings = [];
        currentPoint = { ...startPoint };
        currentBearing = initialBearing;
        for (const leg of adjustedLegs) {
            bearings.push(currentBearing);
            const newPoint = calculateCoordinatesFromRadiation(currentPoint, currentBearing, leg.distance);
            unadjustedPoints.push(newPoint);
            currentBearing = (currentBearing + 180 + leg.angle) % 360;
            currentPoint = { ...newPoint, id: -1 };
        }
    }

    // 4. Linear Misclosure Calculation & Adjustment (Bowditch)
    const calculatedEndPoint = unadjustedPoints[unadjustedPoints.length - 1];
    const dx = endPoint.x - calculatedEndPoint.x;
    const dy = endPoint.y - calculatedEndPoint.y;
    const totalError = Math.sqrt(dx * dx + dy * dy);
    // Avoid division by zero if there's no error
    const relativePrecision = totalError > 1e-9 ? totalDistance / totalError : Infinity;

    const adjustedPoints: { x: number; y: number }[] = [];
    let cumulativeDistance = 0;

    for (let i = 0; i < unadjustedPoints.length; i++) {
        cumulativeDistance += adjustedLegs[i].distance;

        const correctionX = (cumulativeDistance / totalDistance) * dx;
        const correctionY = (cumulativeDistance / totalDistance) * dy;
        
        adjustedPoints.push({
            x: unadjustedPoints[i].x + correctionX,
            y: unadjustedPoints[i].y + correctionY,
        });
    }

    return {
        unadjustedPoints,
        adjustedPoints,
        closingError: { dx, dy, total: totalError },
        angularError, // can be undefined
        totalDistance,
        relativePrecision,
    };
};

// --- Helmert Transformation ---

export interface HelmertControlPoint {
  source: { x: number; y: number };
  target: { x: number; y: number };
}

export interface HelmertResult {
  parameters: {
    tx: number;
    ty: number;
    scale: number;
    rotation: number; // in degrees
  };
  residuals: { dx: number; dy: number; total: number }[];
  rmse: number;
}

export const calculateHelmertParameters = (controlPoints: HelmertControlPoint[]): HelmertResult | null => {
  if (controlPoints.length < 2) {
    return null;
  }

  const n = controlPoints.length;
  let sum_x = 0, sum_y = 0, sum_X = 0, sum_Y = 0;

  for (const p of controlPoints) {
    sum_x += p.source.x;
    sum_y += p.source.y;
    sum_X += p.target.x;
    sum_Y += p.target.y;
  }

  const x_mean = sum_x / n;
  const y_mean = sum_y / n;
  const X_mean = sum_X / n;
  const Y_mean = sum_Y / n;

  let sum_dx_dX = 0, sum_dy_dX = 0, sum_dx_dY = 0, sum_dy_dY = 0;
  let sum_dx2 = 0, sum_dy2 = 0;

  for (const p of controlPoints) {
    const dx = p.source.x - x_mean;
    const dy = p.source.y - y_mean;
    const dX = p.target.x - X_mean;
    const dY = p.target.y - Y_mean;

    sum_dx_dX += dx * dX;
    sum_dy_dX += dy * dX;
    sum_dx_dY += dx * dY;
    sum_dy_dY += dy * dY;
    sum_dx2 += dx * dx;
    sum_dy2 += dy * dy;
  }

  const denominator = sum_dx2 + sum_dy2;
  if (Math.abs(denominator) < 1e-9) return null; // Collinear points

  const a = (sum_dx_dX + sum_dy_dY) / denominator;
  const b = (sum_dx_dY - sum_dy_dX) / denominator;

  const tx = X_mean - a * x_mean + b * y_mean;
  const ty = Y_mean - b * x_mean - a * y_mean;
  
  const scale = Math.sqrt(a * a + b * b);
  const rotation = toDegrees(Math.atan2(b, a));

  const parameters = { tx, ty, scale, rotation };

  let sum_sq_residuals = 0;
  const residuals = controlPoints.map(p => {
      const X_calc = tx + scale * (p.source.x * Math.cos(toRadians(rotation)) - p.source.y * Math.sin(toRadians(rotation)));
      const Y_calc = ty + scale * (p.source.x * Math.sin(toRadians(rotation)) + p.source.y * Math.cos(toRadians(rotation)));
      
      const dx = p.target.x - X_calc;
      const dy = p.target.y - Y_calc;
      const total = Math.sqrt(dx*dx + dy*dy);
      sum_sq_residuals += total * total;
      
      return { dx, dy, total };
  });

  const rmse = Math.sqrt(sum_sq_residuals / n);
  
  return { parameters, residuals, rmse };
};

export const applyHelmertTransformation = (point: {x:number, y:number}, params: HelmertResult['parameters']): {x:number, y:number} => {
    const { tx, ty, scale, rotation } = params;
    const rotRad = toRadians(rotation);
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);

    const x_target = tx + scale * (point.x * cosR - point.y * sinR);
    const y_target = ty + scale * (point.x * sinR + point.y * cosR);

    return { x: x_target, y: y_target };
};
