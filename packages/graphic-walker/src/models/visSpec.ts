import { DraggableFieldState, IVisualLayout } from '../interfaces';

export const viewEncodingKeys = (geom: string, renderer?: IVisualLayout['renderer']): Exclude<keyof DraggableFieldState, 'filters'>[] => {
    switch (geom) {
        case 'choropleth':
            return ['geoId', 'color', 'opacity', 'text', 'details'];
        case 'poi':
            return ['longitude', 'latitude', 'color', 'opacity', 'size', 'details'];
        case 'arc':
            // Only the native worksheet renders polar shelf facets. Legacy query grain stays unchanged.
            return [...(renderer === 'native' ? ['columns', 'rows'] as const : []), 'radius', 'theta', 'color', 'opacity', 'size', 'details', 'text'];
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

/** Native draws the active mark channels; retained shelf values are not new encodings. */
export const nativeEncodingKeys = (geom: string): ReturnType<typeof viewEncodingKeys> =>
    viewEncodingKeys(geom, 'native').filter((key) => (key !== 'text' || geom === 'text') && (key !== 'shape' || geom === 'point' || geom === 'auto'));
