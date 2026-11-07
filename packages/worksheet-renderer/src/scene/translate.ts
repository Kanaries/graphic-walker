import { intersect, inflate, type Box, type HitGeometry, type HitRegion, type Primitive } from './types';
export function translatedBox(box: Box, x: number, y: number): Box {
    return { x: box.x + x, y: box.y + y, width: box.width, height: box.height };
}
export function translatedPrimitive(p: Primitive, x: number, y: number, selected = false): Primitive {
    if (p.kind === 'rect') return { ...p, box: translatedBox(p.box, x, y), fill: selected ? '#ea580c' : p.fill };
    if (p.kind === 'line') return { ...p, x1: p.x1 + x, y1: p.y1 + y, x2: p.x2 + x, y2: p.y2 + y, stroke: selected ? '#ea580c' : p.stroke };
    if (p.kind === 'path')
        return { ...p, points: p.points.map((point) => ({ x: point.x + x, y: point.y + y })), fill: selected ? '#ea580c' : p.fill };
    return { ...p, x: p.x + x, y: p.y + y, fill: selected ? '#ea580c' : p.fill };
}
function translatedGeometry(g: HitGeometry | undefined, x: number, y: number): HitGeometry | undefined {
    if (!g) return;
    if (g.kind === 'rect') return { kind: 'rect', box: translatedBox(g.box, x, y) };
    if (g.kind === 'circle') return { ...g, x: g.x + x, y: g.y + y };
    if (g.kind === 'segment') return { ...g, start: { x: g.start.x + x, y: g.start.y + y }, end: { x: g.end.x + x, y: g.end.y + y } };
    return { ...g, points: g.points.map((point) => ({ x: point.x + x, y: point.y + y })) };
}
export function translatedHit(hit: HitRegion, x: number, y: number, body: Box): HitRegion | undefined {
    const box = translatedBox(hit.box, x, y),
        clip = intersect(translatedBox(hit.clip, x, y), body);
    const visible = intersect(inflate(box, hit.kind === 'segment' ? 3 : 1), clip);
    if (!visible.width || !visible.height) return;
    return { ...hit, box, clip, geometry: translatedGeometry(hit.geometry, x, y) };
}
