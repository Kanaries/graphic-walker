export interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}
export type Primitive =
    | { kind: 'rect'; box: Box; fill: string; stroke?: string }
    | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; width?: number }
    | { kind: 'text'; x: number; y: number; text: string; fill: string; size?: number; align?: 'left' | 'center' | 'right' }
    | { kind: 'circle'; x: number; y: number; radius: number; fill: string };
export interface DrawCommand {
    id: string;
    clip: Box;
    primitive: Primitive;
}
export interface HitRegion {
    id: string;
    paneKey: string;
    datumKey: string;
    box: Box;
    clip: Box;
    values: Readonly<Record<string, unknown>>;
}
export interface SceneFrame {
    frameId: number;
    width: number;
    height: number;
    commands: DrawCommand[];
    hits: HitRegion[];
    rowStart: number;
    columnStart: number;
}
export function contains(box: Box, x: number, y: number): boolean {
    return x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height;
}
