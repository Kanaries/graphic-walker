import type { FeatureCollection } from 'geojson';

// Three squares near the equator, where Web Mercator is close to linear. East has a hole in its
// middle. Each has its code on the feature id and a name that is written unlike the data writes it.
const square = (west: number, south: number, size: number) => [
    [west, south],
    [west + size, south],
    [west + size, south + size],
    [west, south + size],
    [west, south],
];

export const shapes: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
        { type: 'Feature', id: 'East', properties: { name: 'EAST' }, geometry: { type: 'Polygon', coordinates: [square(10, -10, 20), square(17, -3, 6)] } },
        { type: 'Feature', id: 'West', properties: { name: 'Westland' }, geometry: { type: 'Polygon', coordinates: [square(-30, -10, 20)] } },
        { type: 'Feature', id: 'North', properties: { name: 'North' }, geometry: { type: 'Polygon', coordinates: [square(-10, 20, 20)] } },
    ],
};
