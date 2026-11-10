/** A screen rectangle: left, top, right, bottom. */
export interface Box { x0: number; y0: number; x1: number; y1: number }
export type Point = [number, number];

export const inside = (box: Box, x: number, y: number) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;

/** The part of a rectangle inside the box, or nothing when they do not overlap. */
export function clipRect(box: Box, x: number, y: number, width: number, height: number): [number, number, number, number] | undefined {
    const x0 = Math.max(x, box.x0), y0 = Math.max(y, box.y0), x1 = Math.min(x + width, box.x1), y1 = Math.min(y + height, box.y1);
    return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : undefined;
}

// Liang–Barsky: the stretch of a segment inside the box, as the two parameters along it.
function span(box: Box, a: Point, b: Point): [number, number] | undefined {
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    for (const [p, q] of [[-dx, a[0] - box.x0], [dx, box.x1 - a[0]], [-dy, a[1] - box.y0], [dy, box.y1 - a[1]]]) {
        if (p === 0) { if (q < 0) return undefined; continue; }
        const t = q / p;
        if (p < 0) { if (t > t1) return undefined; if (t > t0) t0 = t; }
        else { if (t < t0) return undefined; if (t < t1) t1 = t; }
    }
    return [t0, t1];
}
const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** The pieces of a line that lie inside the box. A line that leaves and comes back is cut in two. */
export function clipLine(box: Box, points: Point[]): Point[][] {
    const pieces: Point[][] = [];
    let open: Point[] | undefined;
    // A line of one point is kept where the point is inside, so a lone value still shows.
    if (points.length === 1) return inside(box, points[0][0], points[0][1]) ? [points] : [];
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        const cut = span(box, a, b);
        if (!cut) { open = undefined; continue; }
        const from = lerp(a, b, cut[0]), to = lerp(a, b, cut[1]);
        // The piece carries on only where this segment starts at the very point the last one ended.
        if (!open || cut[0] > 0) pieces.push(open = [from]);
        open.push(to);
        if (cut[1] < 1) open = undefined;
    }
    return pieces;
}

/** The part of a closed outline inside the box, by clipping against each side in turn (Sutherland–Hodgman). */
export function clipPolygon(box: Box, points: Point[]): Point[] {
    const sides: [(p: Point) => boolean, (a: Point, b: Point) => Point][] = [
        [p => p[0] >= box.x0, (a, b) => lerp(a, b, (box.x0 - a[0]) / (b[0] - a[0]))],
        [p => p[0] <= box.x1, (a, b) => lerp(a, b, (box.x1 - a[0]) / (b[0] - a[0]))],
        [p => p[1] >= box.y0, (a, b) => lerp(a, b, (box.y0 - a[1]) / (b[1] - a[1]))],
        [p => p[1] <= box.y1, (a, b) => lerp(a, b, (box.y1 - a[1]) / (b[1] - a[1]))],
    ];
    let outline = points;
    for (const [within, cross] of sides) {
        const next: Point[] = [];
        for (let i = 0; i < outline.length; i++) {
            const a = outline[(i + outline.length - 1) % outline.length], b = outline[i];
            if (within(b)) { if (!within(a)) next.push(cross(a, b)); next.push(b); }
            else if (within(a)) next.push(cross(a, b));
        }
        outline = next;
        if (!outline.length) break;
    }
    return outline;
}
