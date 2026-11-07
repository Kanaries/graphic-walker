import type { Axis, MemberPath, PreparedRecord } from '../core/types';

export interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface Point {
    x: number;
    y: number;
}
export type Primitive = (
    | { kind: 'rect'; box: Box; fill: string; stroke?: string; strokeWidth?: number }
    | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; width?: number }
    | {
          kind: 'text';
          x: number;
          y: number;
          text: string;
          fill: string;
          size?: number;
          fontFamily?: string;
          align?: 'left' | 'center' | 'right';
      }
    | { kind: 'circle'; x: number; y: number; radius: number; fill: string; stroke?: string; strokeWidth?: number }
    | { kind: 'path'; points: readonly Point[]; closed?: boolean; fill?: string; stroke?: string; width?: number }
) & { opacity?: number };
export interface DrawCommand {
    id: string;
    clip: Box;
    primitive: Primitive;
}
export type HitGeometry =
    | { kind: 'rect'; box: Box }
    | { kind: 'circle'; x: number; y: number; radius: number }
    | { kind: 'polygon'; points: readonly Point[] }
    | { kind: 'segment'; start: Point; end: Point; width: number };
export interface HitRegion {
    id: string;
    paneKey: string;
    datumKey: string;
    box: Box;
    clip: Box;
    values: PreparedRecord;
    kind?: 'datum' | 'segment';
    datumKeys?: readonly string[];
    slotId?: string;
    seriesKey?: string;
    recordValues?: readonly PreparedRecord[];
    rowKey?: string;
    columnKey?: string;
    label?: string;
    geometry?: HitGeometry;
    hitPoint?: Point;
}
export interface HeaderTarget {
    kind: 'header';
    id: string;
    key: string;
    axis: Axis;
    path: MemberPath;
    fieldRef?: string;
    box: Box;
    clip: Box;
    label: string;
    expanded?: boolean;
    canCollapse: boolean;
}
export interface SceneFrame {
    frameId: number;
    width: number;
    height: number;
    commands: DrawCommand[];
    hits: HitRegion[];
    headers: HeaderTarget[];
    rowStart: number;
    columnStart: number;
    /** Optional stable local geometry. The flattened commands/hits remain in viewport coordinates. */
    paneLayer?: {
        clip: Box;
        x: number;
        y: number;
        commandStart: number;
        commandEnd: number;
        groups: Array<{ id: string; x: number; y: number; commands: readonly DrawCommand[]; selectedIds: readonly string[] }>;
    };
    /** Conservative resident cost including local payloads retained from an evictable cache. */
    retainedBytes?: number;
}
export function contains(box: Box, x: number, y: number): boolean {
    return x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height;
}
export function intersect(a: Box, b: Box): Box {
    const x = Math.max(a.x, b.x),
        y = Math.max(a.y, b.y);
    return {
        x,
        y,
        width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x),
        height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y),
    };
}
export function inflate(box: Box, amount: number): Box {
    return { x: box.x - amount, y: box.y - amount, width: box.width + amount * 2, height: box.height + amount * 2 };
}
