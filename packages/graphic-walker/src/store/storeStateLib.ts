import { viewEncodingKeys } from '@/models/visSpec';
import { DraggableFieldState, IViewField } from '../interfaces';

export function getAllFields(encodings: { dimensions: IViewField[]; measures: IViewField[] }) {
    return [...encodings.dimensions, ...encodings.measures];
}

export function getViewEncodingFields(encodings: Partial<Omit<DraggableFieldState, 'filters'>>, geom: string) {
    return viewEncodingKeys(geom).flatMap((k) => encodings[k] ?? []);
}
