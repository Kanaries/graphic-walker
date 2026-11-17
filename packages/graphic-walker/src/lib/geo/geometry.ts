import type { Geometry, Position } from 'geojson';

export type LatLng = [lat: number, lng: number];
export type LatLngBounds = [southWest: LatLng, northEast: LatLng];

/**
 * One drawable piece of a feature. A polygon keeps every ring: the first is the outline
 * and the rest are holes, which is the order Leaflet expects.
 */
export type GeoPart = { type: 'point'; position: LatLng } | { type: 'line'; positions: LatLng[] } | { type: 'polygon'; rings: LatLng[][] };

export const WORLD_BOUNDS: LatLngBounds = [
    [-90, -180],
    [90, 180],
];

const isPosition = (c: unknown): c is Position => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]);
const toLatLng = (c: Position): LatLng => [c[1], c[0]];
const toPath = (coords: Position[]): LatLng[] => (Array.isArray(coords) ? coords.filter(isPosition).map(toLatLng) : []);

function lineParts(coords: Position[]): GeoPart[] {
    const positions = toPath(coords);
    return positions.length >= 2 ? [{ type: 'line', positions }] : [];
}

function polygonParts(coords: Position[][]): GeoPart[] {
    if (!Array.isArray(coords) || coords.length === 0) return [];
    const outline = toPath(coords[0]);
    if (outline.length < 3) return [];
    const holes = coords
        .slice(1)
        .map(toPath)
        .filter((ring) => ring.length >= 3);
    return [{ type: 'polygon', rings: [outline, ...holes] }];
}

/** Turns a GeoJSON geometry into the pieces the map draws. GeoJSON is [lng, lat], the result is [lat, lng]. */
export function resolveParts(geometry: Geometry | null | undefined): GeoPart[] {
    if (!geometry) return [];
    switch (geometry.type) {
        case 'Point':
            return isPosition(geometry.coordinates) ? [{ type: 'point', position: toLatLng(geometry.coordinates) }] : [];
        case 'MultiPoint':
            return toPath(geometry.coordinates).map((position) => ({ type: 'point', position }));
        case 'LineString':
            return lineParts(geometry.coordinates);
        case 'MultiLineString':
            return geometry.coordinates.flatMap(lineParts);
        case 'Polygon':
            return polygonParts(geometry.coordinates);
        case 'MultiPolygon':
            return geometry.coordinates.flatMap(polygonParts);
        case 'GeometryCollection':
            return geometry.geometries.flatMap(resolveParts);
        default:
            return [];
    }
}

/** The positions that decide how far a part reaches. Holes lie inside the outline, so they are left out. */
function outerPositions(part: GeoPart): LatLng[] {
    if (part.type === 'point') return [part.position];
    if (part.type === 'line') return part.positions;
    return part.rings[0];
}

/** Grows `bounds` to hold `parts`. Pass null to start. Returns null while nothing has been added. */
export function extendBounds(bounds: LatLngBounds | null, parts: readonly GeoPart[]): LatLngBounds | null {
    let next = bounds;
    for (const part of parts) {
        for (const [lat, lng] of outerPositions(part)) {
            if (!next) {
                next = [
                    [lat, lng],
                    [lat, lng],
                ];
                continue;
            }
            if (lat < next[0][0]) next[0][0] = lat;
            if (lng < next[0][1]) next[0][1] = lng;
            if (lat > next[1][0]) next[1][0] = lat;
            if (lng > next[1][1]) next[1][1] = lng;
        }
    }
    return next;
}

/** Area-weighted centre of a ring, used to place a label. Null for a ring with no area. */
export function ringCentroid(ring: readonly LatLng[]): LatLng | null {
    let doubleArea = 0;
    let lat = 0;
    let lng = 0;
    for (let i = 0; i < ring.length; i++) {
        const [lat1, lng1] = ring[i];
        // Wrapping to the first point closes a ring whose file left it open.
        const [lat2, lng2] = ring[(i + 1) % ring.length];
        const cross = lat1 * lng2 - lat2 * lng1;
        doubleArea += cross;
        lat += (lat1 + lat2) * cross;
        lng += (lng1 + lng2) * cross;
    }
    if (!doubleArea) return null;
    const centre: LatLng = [lat / (3 * doubleArea), lng / (3 * doubleArea)];
    return Number.isFinite(centre[0]) && Number.isFinite(centre[1]) ? centre : null;
}
