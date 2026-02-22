
export interface Point {
  id: number;
  x: number;
  y: number;
  image?: string; // Base64 image data
}

export interface Riverain {
  id: number;
  segmentLabel: string; // Ex: "B1 - B2"
  name: string;
  consistance: string;
  showLimitLines?: boolean; // Indique si les limites latérales doivent être dessinées
  limitDirection?: 'both' | 'start' | 'end' | 'none'; // Direction des prolongements
  isMitoyenne?: boolean; // Indique si la limite est mitoyenne
}

export interface Parcel {
  id: number;
  name: string;
  points: Point[];
  color: string;
  isVisible: boolean;
  surveyor?: string;
  date?: string;
  bornageHour?: string;
  bornageMinute?: string;
  propriete?: string;
  situation?: string;
  titre?: string;
  requisition?: string;
  nature?: string;
  consistance?: string;
  riverains?: Riverain[];
  // Informations Propriétaire
  ownerNom?: string;
  ownerPrenom?: string;
  ownerQualite?: string;
  ownerCIN?: string;
  ownerCINExpiry?: string;
  ownerAdresse?: string;
}

export interface Annotation {
  id: number;
  x: number;
  y: number;
  text: string;
  rotation?: number;
}

export interface ImportedLayer {
  id: string;
  name: string;
  data: any; // GeoJSON FeatureCollection
  color: string;
  visible: boolean;
  type: 'point' | 'line' | 'polygon' | 'unknown';
}

export interface DistanceResult {
  from: number;
  to: number;
  distance: number;
}

export interface CalculationResults {
  area: number;
  distances: DistanceResult[];
}

export type Theme = 'light' | 'dark' | 'system';
export type MapTileLayer = 'osm' | 'dark' | 'satellite' | 'terrain' | 'google_hybrid';
export type MapMarkerStyle = 'default' | 'circle';
export type DistanceUnit = 'meters' | 'feet' | 'kilometers' | 'miles';
export type AreaUnit = 'squareMeters' | 'squareFeet' | 'hectares' | 'acres' | 'ha_a_ca';
export type CoordinateSystem = 'local' | 'wgs84' | 'lambert_nord_maroc' | 'lambert_sud_maroc' | 'lambert_z1' | 'lambert_z2' | 'lambert_z3' | 'lambert_z4';

export interface AppSettings {
  precision: number;
  theme: Theme;
  mapTileLayer: MapTileLayer;
  mapMarkerStyle: MapMarkerStyle;
  distanceUnit: DistanceUnit;
  areaUnit: AreaUnit;
  coordinateSystem: CoordinateSystem;
  mapAutoFit: boolean;
}

export type View = 
  | 'WELCOME'
  | 'SURFACE'
  | 'MAP'
  | 'COORDINATE_TRANSFORMATION'
  | 'BORNAGE_SKETCH'
  | 'CADASTRAL_PLAN'
  | 'MAPPE'
  | 'TECHNICAL_PV';

export interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export type DrawingTool = 'point' | 'line' | 'rectangle' | 'circle' | 'polygon' | 'angle' | 'text' | 'hand';
export type MapTool = 'pan' | 'point' | 'polygon' | 'annotation' | 'measure_line' | 'measure_area' | 'measure_angle';

export interface MapLayersVisibility {
    points: boolean;
    polygon: boolean;
    annotations: boolean;
}
