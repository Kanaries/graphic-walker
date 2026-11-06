import { contains, inflate, intersect, type Box, type HeaderTarget, type HitRegion, type Point, type SceneFrame } from './types';

const gridSize = 48;
interface HitIndex {
    cells: Map<string, number[]>;
    broad: number[];
}
const indexes = new WeakMap<SceneFrame, HitIndex>();
const overlaps = (a: Box, b: Box) => a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;
function nearest(start: Point, end: Point, point: Point): Point {
    const dx = end.x - start.x,
        dy = end.y - start.y,
        length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length)) : 0;
    return { x: start.x + dx * t, y: start.y + dy * t };
}
function pointInPolygon(points: readonly Point[], point: Point): boolean {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i],
            b = points[j];
        if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
}
export function prepareHitIndex(frame: SceneFrame): void {
    const cells = new Map<string, number[]>(),
        broad: number[] = [];
    frame.hits.forEach((hit, index) => {
        const box = intersect(inflate(hit.box, 4), hit.clip);
        if (!box.width || !box.height) return;
        const x0 = Math.floor(box.x / gridSize),
            x1 = Math.floor((box.x + box.width) / gridSize);
        const y0 = Math.floor(box.y / gridSize),
            y1 = Math.floor((box.y + box.height) / gridSize);
        // Long diagonal lines must not expand into an unbounded rectangular cell list.
        if ((x1 - x0 + 1) * (y1 - y0 + 1) > 256) {
            broad.push(index);
            return;
        }
        for (let x = x0; x <= x1; x++)
            for (let y = y0; y <= y1; y++) {
                const key = `${x}:${y}`,
                    values = cells.get(key) ?? [];
                values.push(index);
                cells.set(key, values);
            }
    });
    indexes.set(frame, { cells, broad });
}
function exactHit(hit: HitRegion, point: Point, tolerance: number): Point | undefined {
    if (!contains(hit.clip, point.x, point.y) || !contains(inflate(hit.box, tolerance), point.x, point.y)) return;
    const geometry = hit.geometry;
    if (!geometry || geometry.kind === 'rect') return point;
    if (geometry.kind === 'circle')
        return Math.hypot(point.x - geometry.x, point.y - geometry.y) <= geometry.radius + tolerance ? point : undefined;
    if (geometry.kind === 'segment') {
        const projected = nearest(geometry.start, geometry.end, point);
        return Math.hypot(projected.x - point.x, projected.y - point.y) <= geometry.width / 2 + tolerance ? projected : undefined;
    }
    if (pointInPolygon(geometry.points, point)) return point;
    return geometry.points.some((a, i) => {
        const p = nearest(a, geometry.points[(i + 1) % geometry.points.length], point);
        return Math.hypot(p.x - point.x, p.y - point.y) <= tolerance;
    })
        ? point
        : undefined;
}
export function hitTest(frame: SceneFrame, x: number, y: number, tolerance = 3): HitRegion | undefined {
    if (!indexes.has(frame)) prepareHitIndex(frame);
    const index = indexes.get(frame)!;
    const candidates =
        tolerance > 4
            ? frame.hits.map((_, i) => i)
            : [...(index.cells.get(`${Math.floor(x / gridSize)}:${Math.floor(y / gridSize)}`) ?? []), ...index.broad];
    candidates.sort((a, b) => b - a);
    for (const ordinal of candidates) {
        const hit = frame.hits[ordinal],
            hitPoint = exactHit(hit, { x, y }, tolerance);
        if (hitPoint) return { ...hit, hitPoint };
    }
}
function segmentIntersectsBox(a: Point, b: Point, box: Box): boolean {
    let lo = 0,
        hi = 1;
    const dx = b.x - a.x,
        dy = b.y - a.y;
    for (const [p, q] of [
        [-dx, a.x - box.x],
        [dx, box.x + box.width - a.x],
        [-dy, a.y - box.y],
        [dy, box.y + box.height - a.y],
    ]) {
        if (!p) {
            if (q < 0) return false;
            continue;
        }
        const t = q / p;
        if (p < 0) lo = Math.max(lo, t);
        else hi = Math.min(hi, t);
        if (lo > hi) return false;
    }
    return true;
}
function segmentNearBox(start: Point, end: Point, box: Box, radius: number): boolean {
    if (segmentIntersectsBox(start, end, box)) return true;
    const pointDistance = (point: Point) =>
        Math.hypot(
            point.x - Math.max(box.x, Math.min(point.x, box.x + box.width)),
            point.y - Math.max(box.y, Math.min(point.y, box.y + box.height)),
        );
    if (pointDistance(start) <= radius || pointDistance(end) <= radius) return true;
    return [
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y },
        { x: box.x, y: box.y + box.height },
        { x: box.x + box.width, y: box.y + box.height },
    ].some((point) => {
        const projected = nearest(start, end, point);
        return Math.hypot(point.x - projected.x, point.y - projected.y) <= radius;
    });
}
/** Select only geometry that actually intersects both the brush and the painted clip. */
export function hitsInBox(frame: SceneFrame, selection: Box): HitRegion[] {
    return frame.hits.filter((hit) => {
        const box = intersect(selection, hit.clip);
        if (!box.width || !box.height || !overlaps(inflate(hit.box, 0.5), box)) return false;
        const g = hit.geometry;
        if (!g || g.kind === 'rect') return true;
        if (g.kind === 'circle') {
            const x = Math.max(box.x, Math.min(g.x, box.x + box.width)),
                y = Math.max(box.y, Math.min(g.y, box.y + box.height));
            return Math.hypot(g.x - x, g.y - y) <= g.radius;
        }
        if (g.kind === 'segment') return segmentNearBox(g.start, g.end, box, g.width / 2);
        const corners = [
            { x: box.x, y: box.y },
            { x: box.x + box.width, y: box.y },
            { x: box.x, y: box.y + box.height },
            { x: box.x + box.width, y: box.y + box.height },
        ];
        return (
            corners.some((point) => pointInPolygon(g.points, point)) ||
            g.points.some((a, i) => contains(box, a.x, a.y) || segmentIntersectsBox(a, g.points[(i + 1) % g.points.length], box))
        );
    });
}
export function headerAt(frame: SceneFrame, x: number, y: number): HeaderTarget | undefined {
    return [...frame.headers].reverse().find((header) => contains(header.box, x, y) && contains(header.clip, x, y));
}
