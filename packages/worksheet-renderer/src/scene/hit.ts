import {
    contains,
    inflate,
    intersect,
    type ArcGeometry,
    type Box,
    type HeaderTarget,
    type HitRegion,
    type Point,
    type SceneFrame,
} from './types';
import { angleInArc, arcPoint, pointInArc } from './arc';

const gridSize = 48;
interface HitIndex {
    cells: Map<string, number[]>;
    broad: number[];
    bytes: number;
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
    let bytes = 128 + broad.length * 8;
    for (const [key, entries] of cells) bytes += 128 + key.length * 2 + entries.length * 8;
    indexes.set(frame, { cells, broad, bytes });
}
/** Conservative accounting units, measured heap is reported separately by benchmarks. */
export function hitIndexBytes(frame: SceneFrame): number {
    return indexes.get(frame)?.bytes ?? 0;
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
    if (geometry.kind === 'arc') {
        const distance = Math.hypot(point.x - geometry.x, point.y - geometry.y);
        // The donut hole is an explicit excluded region, including near its inner edge.
        if (distance < geometry.innerRadius) return;
        if (pointInArc(geometry, point)) return point;
        if (
            angleInArc(geometry, Math.atan2(point.y - geometry.y, point.x - geometry.x)) &&
            distance >= geometry.innerRadius &&
            distance <= geometry.outerRadius + tolerance
        )
            return point;
        if (
            geometry.endAngle - geometry.startAngle < Math.PI * 2 - 1e-10 &&
            [geometry.startAngle, geometry.endAngle].some((angle) => {
                const projected = nearest(
                    arcPoint(geometry, geometry.innerRadius, angle),
                    arcPoint(geometry, geometry.outerRadius, angle),
                    point,
                );
                return Math.hypot(projected.x - point.x, projected.y - point.y) <= tolerance;
            })
        )
            return point;
        return;
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
/** Intersect circular boundaries analytically, without polygon approximation or selecting a donut's hole. */
function arcIntersectsBox(arc: ArcGeometry, box: Box): boolean {
    const corners = [
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y },
        { x: box.x, y: box.y + box.height },
        { x: box.x + box.width, y: box.y + box.height },
    ];
    if (corners.some((point) => pointInArc(arc, point))) return true;
    const inside = (point: Point) => point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
    for (const angle of [arc.startAngle, arc.endAngle]) {
        const a = arcPoint(arc, arc.innerRadius, angle),
            b = arcPoint(arc, arc.outerRadius, angle);
        if (inside(a) || inside(b)) return true;
        if (arc.endAngle - arc.startAngle < Math.PI * 2 - 1e-10 && segmentIntersectsBox(a, b, box)) return true;
    }
    for (const radius of [arc.innerRadius, arc.outerRadius]) {
        if (!radius) continue;
        for (const x of [box.x, box.x + box.width]) {
            const squared = radius * radius - (x - arc.x) ** 2;
            if (squared < 0) continue;
            for (const y of [arc.y - Math.sqrt(squared), arc.y + Math.sqrt(squared)])
                if (y >= box.y && y <= box.y + box.height && angleInArc(arc, Math.atan2(y - arc.y, x - arc.x))) return true;
        }
        for (const y of [box.y, box.y + box.height]) {
            const squared = radius * radius - (y - arc.y) ** 2;
            if (squared < 0) continue;
            for (const x of [arc.x - Math.sqrt(squared), arc.x + Math.sqrt(squared)])
                if (x >= box.x && x <= box.x + box.width && angleInArc(arc, Math.atan2(y - arc.y, x - arc.x))) return true;
        }
    }
    return false;
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
        if (g.kind === 'arc') return arcIntersectsBox(g, box);
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
