import type { Primitive, SceneFrame } from '../scene/types';
const ns = 'http://www.w3.org/2000/svg';
let nextInstance = 0;
export function createSvgBackend(svg: SVGSVGElement) {
    const instance = `worksheet-${++nextInstance}`,
        nodes = new Map<string, { node: SVGElement; kind: Primitive['kind']; attrs: Record<string, string | number> }>(),
        clips = new Map<string, { node: SVGElement; id: string }>();
    const defs = document.createElementNS(ns, 'defs');
    svg.appendChild(defs);
    let nextClip = 0;
    const element = (tag: string, attrs: Record<string, string | number>) => {
        const node = document.createElementNS(ns, tag);
        for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
        return node;
    };
    return (frame: SceneFrame): void => {
        const clipCount = new Set(
            frame.commands
                .filter((command) => command.clip.width && command.clip.height)
                .map(({ clip: c }) => `${c.x},${c.y},${c.width},${c.height}`),
        ).size;
        if (frame.commands.length + clipCount * 2 + 1 > 10_000 || frame.hits.length > 5_000)
            throw new Error('resource-limit: SVG exceeds 5,000 marks or 10,000 elements');
        svg.setAttribute('width', String(frame.width));
        svg.setAttribute('height', String(frame.height));
        svg.setAttribute('viewBox', `0 0 ${frame.width} ${frame.height}`);
        const liveNodes = new Set<string>(),
            liveClips = new Set<string>();
        let position = 1;
        for (const { id, clip: c, primitive: p } of frame.commands) {
            if (!c.width || !c.height) continue;
            const key = `${c.x},${c.y},${c.width},${c.height}`;
            liveClips.add(key);
            let clipping = clips.get(key);
            if (!clipping) {
                const id = `${instance}-clip-${++nextClip}`,
                    node = element('clipPath', { id });
                node.appendChild(element('rect', { x: c.x, y: c.y, width: c.width, height: c.height }));
                defs.appendChild(node);
                clipping = { id, node };
                clips.set(key, clipping);
            }
            let attrs: Record<string, string | number>, tag: string;
            if (p.kind === 'rect') {
                tag = 'rect';
                attrs = { ...p.box, fill: p.fill, stroke: p.stroke ?? 'none', 'stroke-width': p.strokeWidth ?? 1 };
            } else if (p.kind === 'line') {
                tag = 'line';
                attrs = {
                    x1: p.x1,
                    y1: p.y1,
                    x2: p.x2,
                    y2: p.y2,
                    stroke: p.stroke,
                    'stroke-width': p.width ?? 1,
                    'stroke-linecap': 'round',
                };
            } else if (p.kind === 'circle') {
                tag = 'circle';
                attrs = { cx: p.x, cy: p.y, r: p.radius, fill: p.fill, stroke: p.stroke ?? 'none', 'stroke-width': p.strokeWidth ?? 1 };
            } else if (p.kind === 'path') {
                tag = 'path';
                attrs = {
                    d: p.points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ') + (p.closed ? ' Z' : ''),
                    fill: p.fill ?? 'none',
                    stroke: p.stroke ?? 'none',
                    'stroke-width': p.width ?? 1,
                    'stroke-linecap': 'round',
                };
            } else {
                tag = 'text';
                attrs = {
                    x: p.x,
                    y: p.y,
                    fill: p.fill,
                    'font-size': p.size ?? 12,
                    'font-family': p.fontFamily ?? 'sans-serif',
                    'text-anchor': p.align === 'center' ? 'middle' : p.align === 'right' ? 'end' : 'start',
                };
            }
            attrs['data-command'] = id;
            attrs['clip-path'] = `url(#${clipping.id})`;
            attrs.opacity = p.opacity ?? 1;
            let entry = nodes.get(id);
            if (!entry || entry.kind !== p.kind) {
                entry?.node.remove();
                entry = { node: element(tag, {}), kind: p.kind, attrs: {} };
                nodes.set(id, entry);
            }
            for (const key of Object.keys(entry.attrs)) if (!(key in attrs)) entry.node.removeAttribute(key);
            for (const [key, value] of Object.entries(attrs)) if (entry.attrs[key] !== value) entry.node.setAttribute(key, String(value));
            entry.attrs = attrs;
            if (p.kind === 'text' && entry.node.textContent !== p.text) entry.node.textContent = p.text;
            const before = svg.children[position];
            if (before !== entry.node) {
                if (before) svg.insertBefore(entry.node, before);
                else svg.appendChild(entry.node);
            }
            position++;
            liveNodes.add(id);
        }
        for (const [id, entry] of nodes)
            if (!liveNodes.has(id)) {
                entry.node.remove();
                nodes.delete(id);
            }
        for (const [key, clip] of clips)
            if (!liveClips.has(key)) {
                clip.node.remove();
                clips.delete(key);
            }
    };
}
