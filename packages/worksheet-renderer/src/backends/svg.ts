import type { SceneFrame } from '../scene/types';
const ns = 'http://www.w3.org/2000/svg';
let nextInstance = 0;
export function createSvgBackend(svg: SVGSVGElement) {
    const instance = `worksheet-${++nextInstance}`;
    return (frame: SceneFrame): void => {
        svg.setAttribute('width', String(frame.width));
        svg.setAttribute('height', String(frame.height));
        svg.setAttribute('viewBox', `0 0 ${frame.width} ${frame.height}`);
        const fragment = document.createDocumentFragment();
        const defs = document.createElementNS(ns, 'defs');
        fragment.appendChild(defs);
        const clips = new Map<string, string>();
        const element = (tag: string, attrs: Record<string, string | number>) => {
            const el = document.createElementNS(ns, tag);
            for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
            return el;
        };
        for (const command of frame.commands) {
            const { clip: c, primitive: p } = command;
            const key = `${c.x},${c.y},${c.width},${c.height}`;
            let clipId = clips.get(key);
            if (!clipId) {
                clipId = `${instance}-clip-${clips.size}`;
                clips.set(key, clipId);
                const clip = element('clipPath', { id: clipId });
                clip.appendChild(element('rect', { x: c.x, y: c.y, width: c.width, height: c.height }));
                defs.appendChild(clip);
            }
            let node: SVGElement;
            if (p.kind === 'rect') node = element('rect', { ...p.box, fill: p.fill, stroke: p.stroke ?? 'none' });
            else if (p.kind === 'line')
                node = element('line', { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2, stroke: p.stroke, 'stroke-width': p.width ?? 1 });
            else if (p.kind === 'circle') node = element('circle', { cx: p.x, cy: p.y, r: p.radius, fill: p.fill });
            else {
                node = element('text', {
                    x: p.x,
                    y: p.y,
                    fill: p.fill,
                    'font-size': p.size ?? 12,
                    'font-family': 'sans-serif',
                    'text-anchor': p.align === 'center' ? 'middle' : p.align === 'right' ? 'end' : 'start',
                });
                node.textContent = p.text;
            }
            node.setAttribute('data-command', command.id);
            node.setAttribute('clip-path', `url(#${clipId})`);
            fragment.appendChild(node);
        }
        // S0 submits one consistent frame. S1 replaces this with keyed command updates.
        svg.replaceChildren(fragment);
    };
}
