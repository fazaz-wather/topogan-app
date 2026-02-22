
import { CoordinateSystem } from '../types';

/**
 * @file coordinateTransformationService.ts
 * @description Fournit des services de transformation de coordonnées de qualité professionnelle.
 * Gère les changements de datum entre les ellipsoïdes WGS84 et Merchich (Clarke 1880),
 * et les projections Coniques Conformes de Lambert (directes et inverses) pour les 4 zones du Maroc.
 *
 * NOTE: Cette version a été mise à jour pour une précision accrue en utilisant des paramètres d'ellipsoïde
 * standards (EPSG) et un algorithme itératif robuste pour les transformations de coordonnées.
 *
 * Basé sur les paramètres fournis par l'utilisateur, conformes aux standards géodésiques marocains.
 * La transformation de datum utilise une translation géocentrique à 3 paramètres (Molodensky-Badekas).
 * La projection est une Conique Conforme de Lambert avec 2 parallèles sécants (2SP).
 */

// #region Fonctions Utilitaires
const toRadians = (deg: number): number => deg * Math.PI / 180;
const toDegrees = (rad: number): number => rad * 180 / Math.PI;
const dmsToDd = (d: number, m: number, s: number): number => {
    const sign = d < 0 ? -1 : 1;
    return sign * (Math.abs(d) + m / 60 + s / 3600);
};
// #endregion

// #region Constantes et Paramètres Géodésiques

const Ellipsoids = {
    WGS84: {
        a: 6378137.0,       // Demi-grand axe
        f: 1 / 298.257223563, // Aplatissement
        get e2() { return 2 * this.f - this.f * this.f; } // Carré de la première excentricité
    },
    CLARKE_1880: {
        // Paramètres pour Clarke 1880 (IGN), utilisé pour le datum Merchich.
        // Source: EPSG Geodetic Parameter Dataset
        a: 6378249.2,
        b: 6356515.0, // Demi-petit axe
        get e2() { return 1 - (this.b * this.b) / (this.a * this.a); } // e² = (a²-b²)/a²
    }
};

const MERCHICH_TO_WGS84_PARAMS = {
    dx: 31,  // Décalage en X (mètres)
    dy: 146, // Décalage en Y (mètres)
    dz: 47  // Décalage en Z (mètres)
};

// --- Lambert 1SP (QGIS Style) ---
const LAMBERT_1SP_RAW_PARAMS: Record<string, any> = {
    lambert_nord_maroc: {
        phi0: toRadians(dmsToDd(33, 18, 0)),     // Latitude of origin (EPSG:26191)
        lambda0: toRadians(dmsToDd(-5, 24, 0)),   // Central Meridian
        k0: 0.9996,                               // Scale factor
        X0: 500000,                               // False Easting
        Y0: 300000,                               // False Northing
    },
    lambert_sud_maroc: {
        phi0: toRadians(dmsToDd(29, 42, 0)),      // Latitude of origin (EPSG:26192)
        lambda0: toRadians(dmsToDd(-5, 24, 0)),
        k0: 0.9996,
        X0: 500000,
        Y0: 300000,
    },
};

const precomputeLambert1SPParams = (params: any, ellipsoid: { a: number, e2: number }) => {
    const e = Math.sqrt(ellipsoid.e2);
    const { phi0, k0 } = params;

    const t_func = (phi: number) => Math.tan(Math.PI / 4 - phi / 2) / Math.pow((1 - e * Math.sin(phi)) / (1 + e * Math.sin(phi)), e / 2);
    const m = (phi: number) => Math.cos(phi) / Math.sqrt(1 - ellipsoid.e2 * Math.sin(phi) ** 2);

    const n = Math.sin(phi0);
    const t0 = t_func(phi0);
    const m0 = m(phi0);
    
    const F = (ellipsoid.a * k0 * m0) / (n * Math.pow(t0, n));
    const rho0 = F * Math.pow(t0, n);

    return { ...params, n, F, rho0, e, t_func, a: ellipsoid.a };
};

const LAMBERT_1SP_ZONES = Object.keys(LAMBERT_1SP_RAW_PARAMS).reduce((acc, key) => {
    acc[key] = precomputeLambert1SPParams(LAMBERT_1SP_RAW_PARAMS[key], Ellipsoids.CLARKE_1880);
    return acc;
}, {} as Record<string, any>);


// --- Lambert 2SP (Zones) ---
const ZONES_RAW_PARAMS: Record<string, any> = {
    lambert_z1: {
        phi1: toRadians(dmsToDd(34, 51, 59.2476)), // Parallèle sécant 1
        phi2: toRadians(dmsToDd(31, 43, 26.1323)), // Parallèle sécant 2
        phi0: toRadians(dmsToDd(33, 18, 0)), // Latitude d'origine
        lambda0: toRadians(dmsToDd(-5, 24, 0)), // Longitude d'origine
        X0: 500000, // Fausse Origine Est
        Y0: 300000, // Fausse Origine Nord
    },
    lambert_z2: {
        phi1: toRadians(dmsToDd(31, 17, 18.5767)),
        phi2: toRadians(dmsToDd(28, 6, 10.4865)),
        phi0: toRadians(dmsToDd(29, 42, 0)),
        lambda0: toRadians(dmsToDd(-5, 24, 0)),
        X0: 500000,
        Y0: 300000,
    },
    lambert_z3: {
        phi1: toRadians(dmsToDd(27, 41, 16.5113)),
        phi2: toRadians(dmsToDd(24, 30, 16.9209)),
        phi0: toRadians(dmsToDd(26, 6, 0)),
        lambda0: toRadians(dmsToDd(-5, 24, 0)),
        X0: 1200000,
        Y0: 400000,
    },
    lambert_z4: {
        phi1: toRadians(dmsToDd(24, 5, 18.4911)),
        phi2: toRadians(dmsToDd(20, 54, 19.0180)),
        phi0: toRadians(dmsToDd(22, 30, 0)),
        lambda0: toRadians(dmsToDd(-5, 24, 0)),
        X0: 1500000,
        Y0: 400000,
    }
};

const precomputeLambert2SPParams = (params: any, ellipsoid: { a: number, b: number, e2: number }) => {
    const e = Math.sqrt(ellipsoid.e2);
    const { phi1, phi2, phi0 } = params;

    const m = (phi: number) => Math.cos(phi) / Math.sqrt(1 - ellipsoid.e2 * Math.sin(phi) ** 2);
    const t_func = (phi: number) => Math.tan(Math.PI / 4 - phi / 2) / Math.pow((1 - e * Math.sin(phi)) / (1 + e * Math.sin(phi)), e / 2);

    const m1 = m(phi1);
    const m2 = m(phi2);
    const t1 = t_func(phi1);
    const t2 = t_func(phi2);
    const t0 = t_func(phi0);

    const n = (Math.log(m1) - Math.log(m2)) / (Math.log(t1) - Math.log(t2)); // Exposant du cône
    const F = m1 / (n * Math.pow(t1, n));
    const rho0 = F * Math.pow(t0, n); // Rayon de projection pour la latitude d'origine

    return { ...params, n, F, rho0, e, t_func };
};

const LAMBERT_2SP_ZONES = Object.keys(ZONES_RAW_PARAMS).reduce((acc, key) => {
    acc[key] = precomputeLambert2SPParams(ZONES_RAW_PARAMS[key], Ellipsoids.CLARKE_1880);
    return acc;
}, {} as Record<string, any>);
// #endregion

// #region Fonctions de Transformation de Coeur

/** Convertit des coordonnées géodésiques (lat, lon, h) en coordonnées cartésiennes ECEF (X, Y, Z). */
function geodeticToEcef(lat: number, lon: number, h: number, ellipsoid: { a: number, e2: number }) {
    const latRad = toRadians(lat);
    const lonRad = toRadians(lon);
    const N = ellipsoid.a / Math.sqrt(1 - ellipsoid.e2 * Math.sin(latRad) ** 2);
    const X = (N + h) * Math.cos(latRad) * Math.cos(lonRad);
    const Y = (N + h) * Math.cos(latRad) * Math.sin(lonRad);
    const Z = (N * (1 - ellipsoid.e2) + h) * Math.sin(latRad);
    return { X, Y, Z };
}

/** Convertit des coordonnées cartésiennes ECEF (X, Y, Z) en coordonnées géodésiques (lat, lon, h). */
function ecefToGeodetic(X: number, Y: number, Z: number, ellipsoid: { a: number, e2: number }) {
    const { a, e2 } = ellipsoid;
    const lonRad = Math.atan2(Y, X);
    const p = Math.sqrt(X * X + Y * Y);

    if (p < 1e-10) {
        const latRad = (Z >= 0) ? Math.PI / 2 : -Math.PI / 2;
        const h = Math.abs(Z) - a * Math.sqrt(1 - e2);
        return { lat: toDegrees(latRad), lon: toDegrees(lonRad), h };
    }

    let latRad = Math.atan2(Z, p * (1 - e2));
    let N;
    const tolerance = 1e-12;

    for (let i = 0; i < 10; i++) {
        const sinLat = Math.sin(latRad);
        N = a / Math.sqrt(1 - e2 * sinLat * sinLat);
        const newLatRad = Math.atan2(Z + N * e2 * sinLat, p);
        if (Math.abs(newLatRad - latRad) < tolerance) {
            latRad = newLatRad;
            break;
        }
        latRad = newLatRad;
    }
    
    const h = (p / Math.cos(latRad)) - N!;
    return { lat: toDegrees(latRad), lon: toDegrees(lonRad), h };
}

/** Applique une transformation de datum à 3 paramètres entre deux ellipsoïdes. */
function transformDatum(lat: number, lon: number, from: 'wgs84' | 'clarke1880', to: 'wgs84' | 'clarke1880') {
    if (from === to) return { lat, lon };

    const fromEllipsoid = from === 'wgs84' ? Ellipsoids.WGS84 : Ellipsoids.CLARKE_1880;
    const toEllipsoid = to === 'wgs84' ? Ellipsoids.WGS84 : Ellipsoids.CLARKE_1880;
    const params = MERCHICH_TO_WGS84_PARAMS;
    const sign = (from === 'wgs84') ? -1 : 1; 

    const { X: fromX, Y: fromY, Z: fromZ } = geodeticToEcef(lat, lon, 0, fromEllipsoid);
    
    const toX = fromX + sign * params.dx;
    const toY = fromY + sign * params.dy;
    const toZ = fromZ + sign * params.dz;

    const { lat: toLat, lon: toLon } = ecefToGeodetic(toX, toY, toZ, toEllipsoid);
    return { lat: toLat, lon: toLon };
}

// --- Fonctions de projection ---

function lambert1SPForward(lat: number, lon: number, zoneKey: string) {
    const params = LAMBERT_1SP_ZONES[zoneKey];
    if (!params) return null;
    const { lambda0, X0, Y0, n, F, rho0, t_func } = params;
    const t = t_func(toRadians(lat));
    const rho = F * Math.pow(t, n);
    const theta = n * (toRadians(lon) - lambda0);
    return { x: X0 + rho * Math.sin(theta), y: Y0 + rho0 - rho * Math.cos(theta) };
}

function lambert1SPInverse(x: number, y: number, zoneKey: string) {
    const params = LAMBERT_1SP_ZONES[zoneKey];
    if (!params) return null;
    const { lambda0, X0, Y0, n, F, rho0, e } = params;
    const dx = x - X0;
    const dy = rho0 - (y - Y0);
    const rho = Math.sqrt(dx * dx + dy * dy);
    if (Math.abs(rho) < 1e-9) return { lat: toDegrees(params.phi0), lon: toDegrees(lambda0) };
    const theta = Math.atan2(dx, dy);
    const t = Math.pow(rho / F, 1 / n);
    const lambda = theta / n + lambda0;
    let phi = Math.PI / 2 - 2 * Math.atan(t);
    for (let i = 0; i < 5; i++) {
        const term = Math.pow((1 - e * Math.sin(phi)) / (1 + e * Math.sin(phi)), e / 2);
        const newPhi = Math.PI / 2 - 2 * Math.atan(t * term);
        if (Math.abs(newPhi - phi) < 1e-12) { phi = newPhi; break; }
        phi = newPhi;
    }
    return { lat: toDegrees(phi), lon: toDegrees(lambda) };
}

function lambert2SPForward(lat: number, lon: number, zoneKey: string) {
    const params = LAMBERT_2SP_ZONES[zoneKey];
    if (!params) return null;
    const { lambda0, X0, Y0, n, F, rho0, t_func } = params;
    const t = t_func(toRadians(lat));
    const rho = F * Math.pow(t, n);
    const theta = n * (toRadians(lon) - lambda0);
    return { x: X0 + rho * Math.sin(theta), y: Y0 + rho0 - rho * Math.cos(theta) };
}

function lambert2SPInverse(x: number, y: number, zoneKey: string) {
    const params = LAMBERT_2SP_ZONES[zoneKey];
    if (!params) return null;
    const { lambda0, X0, Y0, n, F, rho0, e } = params;
    const dx = x - X0;
    const dy = rho0 - (y - Y0);
    const rho = Math.sqrt(dx * dx + dy * dy);
    if (Math.abs(rho) < 1e-9) return { lat: toDegrees(params.phi0), lon: toDegrees(lambda0) };
    const theta = Math.atan2(dx, dy);
    const t = Math.pow(rho / F, 1 / n);
    const lambda = theta / n + lambda0;
    let phi = Math.PI / 2 - 2 * Math.atan(t);
    for (let i = 0; i < 5; i++) {
        const term = Math.pow((1 - e * Math.sin(phi)) / (1 + e * Math.sin(phi)), e / 2);
        const newPhi = Math.PI / 2 - 2 * Math.atan(t * term);
        if (Math.abs(newPhi - phi) < 1e-12) { phi = newPhi; break; }
        phi = newPhi;
    }
    return { lat: toDegrees(phi), lon: toDegrees(lambda) };
}

// #endregion

// #region Logique de Transformation Publique
const wgs84ToLambert = (lat: number, lon: number, zone: CoordinateSystem) => {
    const clarkeCoords = transformDatum(lat, lon, 'wgs84', 'clarke1880');
    if (coordinateTransformationService.isLambert1SP(zone)) {
        return lambert1SPForward(clarkeCoords.lat, clarkeCoords.lon, zone);
    }
    return lambert2SPForward(clarkeCoords.lat, clarkeCoords.lon, zone);
};

const lambertToWgs84 = (x: number, y: number, zone: CoordinateSystem) => {
    let clarkeCoords;
    if (coordinateTransformationService.isLambert1SP(zone)) {
        clarkeCoords = lambert1SPInverse(x, y, zone);
    } else {
        clarkeCoords = lambert2SPInverse(x, y, zone);
    }
    if (!clarkeCoords) return null;
    return transformDatum(clarkeCoords.lat, clarkeCoords.lon, 'clarke1880', 'wgs84');
};

export const coordinateTransformationService = {
    isProjected(system: CoordinateSystem): boolean {
        return system.startsWith('lambert_') || system === 'local';
    },
    isLambert1SP(system: CoordinateSystem): boolean {
        return system === 'lambert_nord_maroc' || system === 'lambert_sud_maroc';
    },
    isLambert2SP(system: CoordinateSystem): boolean {
        return ['lambert_z1', 'lambert_z2', 'lambert_z3', 'lambert_z4'].includes(system);
    },
    transform(
        coords: { x: number, y: number },
        from: CoordinateSystem,
        to: CoordinateSystem,
    ): { x: number, y: number } | null {
        if (from === to) return coords;
        const fromIsLambert = this.isLambert1SP(from) || this.isLambert2SP(from);
        const toIsLambert = this.isLambert1SP(to) || this.isLambert2SP(to);
        if (from === 'wgs84' && toIsLambert) {
            return wgs84ToLambert(coords.y, coords.x, to);
        }
        if (fromIsLambert && to === 'wgs84') {
            const result = lambertToWgs84(coords.x, coords.y, from);
            return result ? { x: result.lon, y: result.lat } : null;
        }
        if (fromIsLambert && toIsLambert) {
            const wgs84Coords = lambertToWgs84(coords.x, coords.y, from);
            if (!wgs84Coords) return null;
            return wgs84ToLambert(wgs84Coords.lat, wgs84Coords.lon, to);
        }
        console.warn(`Transformation non supportée de ${from} à ${to}.`);
        return null;
    }
};
// #endregion