import { DraggableFieldState } from '../interfaces';

export const viewEncodingKeys = (geom: string): Exclude<keyof DraggableFieldState, 'filters'>[] => {
    switch (geom) {
        case 'choropleth':
            return ['geoId', 'color', 'opacity', 'text', 'details'];
        case 'poi':
            return ['longitude', 'latitude', 'color', 'opacity', 'size', 'details'];
        case 'arc':
            return ['radius', 'theta', 'color', 'opacity', 'size', 'details', 'text'];
        case 'bar':
        case 'tick':
        case 'line':
        case 'area':
        case 'boxplot':
            return ['columns', 'rows', 'color', 'opacity', 'size', 'details', 'text'];
        case 'text':
            return ['columns', 'rows', 'color', 'opacity', 'size', 'text'];
        case 'table':
            return ['columns', 'rows'];
        default:
            return ['columns', 'rows', 'color', 'opacity', 'size', 'details', 'shape'];
    }
};
