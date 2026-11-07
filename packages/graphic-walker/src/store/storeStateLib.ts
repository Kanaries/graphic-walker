import { viewEncodingKeys } from '@/models/visSpec';
import { DraggableFieldState, IViewField, IVisualLayout } from '../interfaces';

export function getAllFields(encodings: { dimensions: IViewField[]; measures: IViewField[] }) {
    return [...encodings.dimensions, ...encodings.measures];
}

export function getViewEncodingFields(encodings: Partial<Omit<DraggableFieldState, 'filters'>>, geom: string, renderer?: IVisualLayout['renderer']) {
    return viewEncodingKeys(geom, renderer).flatMap((k) => encodings[k] ?? []);
}
