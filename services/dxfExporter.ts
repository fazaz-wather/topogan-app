import { Point, Annotation } from '../types';

export interface DxfGeometry {
  points: Point[];
  layer: string;
  color: number; // DXF color index (7=White/Black, 1=Red, 5=Blue, etc.)
  closed: boolean;
  lineType?: string; // 'Continuous', 'DASHED', 'DOTTED'
  lineWeight?: number; // 1/100mm (e.g., 13, 25, 35, 50, 70)
}

export interface DxfExportData {
  geometries: DxfGeometry[];
  annotations: Annotation[];
  precision: number;
}

// Helper to format DXF group code and value pairs
const dxfPair = (code: number, value: string | number): string => `  ${code}\n${value}\n`;

const generateHeader = (): string => {
    let header = dxfPair(0, 'SECTION') + dxfPair(2, 'HEADER');
    header += dxfPair(9, '$ACADVER') + dxfPair(1, 'AC1009'); // AutoCAD R12/LT2 DXF
    header += dxfPair(9, '$INSUNITS') + dxfPair(70, 4); // Units: Meters
    header += dxfPair(0, 'ENDSEC');
    return header;
};

const generateLTypes = (): string => {
    let ltypes = dxfPair(0, 'TABLE') + dxfPair(2, 'LTYPE');
    
    // Continuous (Standard)
    ltypes += dxfPair(0, 'LTYPE') + dxfPair(2, 'Continuous') + dxfPair(70, 0) + dxfPair(3, 'Solid line') + dxfPair(72, 65) + dxfPair(73, 0) + dxfPair(40, 0.0);

    // DASHED (Tirets)
    // Pattern: 0.5 draw, 0.25 skip
    ltypes += dxfPair(0, 'LTYPE') + dxfPair(2, 'DASHED') + dxfPair(70, 0) + dxfPair(3, '__ __ __ __ __ __ __ __') + dxfPair(72, 65) + dxfPair(73, 2) + dxfPair(40, 0.75);
    ltypes += dxfPair(49, 0.5) + dxfPair(49, -0.25);

    // DOTTED (Pointillés)
    // Pattern: 0.0 dot, 0.25 skip
    ltypes += dxfPair(0, 'LTYPE') + dxfPair(2, 'DOTTED') + dxfPair(70, 0) + dxfPair(3, '. . . . . . . . . . . .') + dxfPair(72, 65) + dxfPair(73, 2) + dxfPair(40, 0.25);
    ltypes += dxfPair(49, 0.0) + dxfPair(49, -0.25);

    ltypes += dxfPair(0, 'ENDTAB');
    return ltypes;
};

const generateTables = (): string => {
    let tables = dxfPair(0, 'SECTION') + dxfPair(2, 'TABLES');
    
    // LType table
    tables += generateLTypes();

    // Layer table
    tables += dxfPair(0, 'TABLE') + dxfPair(2, 'LAYER');
    const layers = [
        { name: '0', color: 7 }, // White/Black
        { name: 'POINTS', color: 1 }, // Red
        { name: 'GEOMETRY', color: 5 }, // Blue
        { name: 'SKETCH', color: 3 }, // Green
        { name: 'ANNOTATIONS', color: 2 }, // Yellow
        { name: 'CONSTRUCTION', color: 8 }, // Gray
    ];
    layers.forEach(layer => {
        tables += dxfPair(0, 'LAYER');
        tables += dxfPair(2, layer.name);
        tables += dxfPair(70, 0); // Flags
        tables += dxfPair(62, layer.color); // Color number
        tables += dxfPair(6, 'Continuous'); // Default Linetype
    });
    tables += dxfPair(0, 'ENDTAB');
    
    tables += dxfPair(0, 'ENDSEC');
    return tables;
};

const generateEntities = (data: DxfExportData): string => {
    let entities = dxfPair(0, 'SECTION') + dxfPair(2, 'ENTITIES');
    const { geometries, annotations, precision } = data;

    // Geometries
    geometries.forEach(geom => {
        if (geom.points.length === 0) return;

        // Draw points as small circles for better visibility if it's the main geometry layer
        if (geom.layer === 'GEOMETRY' || geom.layer === 'POINTS') {
            geom.points.forEach(p => {
                entities += dxfPair(0, 'CIRCLE');
                entities += dxfPair(8, 'POINTS');
                entities += dxfPair(10, p.x.toFixed(precision));
                entities += dxfPair(20, p.y.toFixed(precision));
                entities += dxfPair(30, 0.0);
                entities += dxfPair(40, 0.1); // Radius of 0.1 units
            });
        }
        
        // Draw polyline
        if (geom.points.length > 1) {
            entities += dxfPair(0, 'LWPOLYLINE');
            entities += dxfPair(8, geom.layer);
            entities += dxfPair(62, geom.color);
            entities += dxfPair(6, geom.lineType || 'Continuous'); // Linetype name
            if (geom.lineWeight !== undefined) {
                entities += dxfPair(370, geom.lineWeight); // Lineweight enum
            }
            entities += dxfPair(100, 'AcDbEntity');
            entities += dxfPair(100, 'AcDbPolyline');
            entities += dxfPair(90, geom.points.length);
            entities += dxfPair(70, geom.closed ? 1 : 0);
            geom.points.forEach(p => {
                entities += dxfPair(10, p.x.toFixed(precision));
                entities += dxfPair(20, p.y.toFixed(precision));
            });
        }
    });

    // Annotations
    annotations.forEach(a => {
        entities += dxfPair(0, 'TEXT');
        entities += dxfPair(8, 'ANNOTATIONS');
        entities += dxfPair(10, a.x.toFixed(precision));
        entities += dxfPair(20, a.y.toFixed(precision));
        entities += dxfPair(30, 0.0);
        entities += dxfPair(40, 2.5); // Default text height, adjust as needed
        entities += dxfPair(1, a.text);
        if (a.rotation) {
            // DXF Rotation is counter-clockwise from East.
            // Our rotation (if CSS based) might need adjustment, but usually 0 is standard.
            // If the incoming rotation is screen-based (CW), invert it.
            // Assuming standard math angle (CCW) here for now.
            entities += dxfPair(50, a.rotation.toFixed(precision));
        }
    });

    entities += dxfPair(0, 'ENDSEC');
    return entities;
};

export const exportToDXF = (data: DxfExportData): string => {
    let dxfString = '';
    dxfString += generateHeader();
    dxfString += generateTables();
    dxfString += generateEntities(data);
    dxfString += dxfPair(0, 'EOF');
    return dxfString;
};