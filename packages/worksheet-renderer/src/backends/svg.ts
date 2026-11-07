import type { Primitive, SceneFrame } from '../scene/types';
export function svgPrimitive(primitive: Primitive): { tag: string; attrs: Record<string, string | number>; text?: string } {
    const p = primitive;
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
    attrs.opacity = p.opacity ?? 1;
    return { tag, attrs, text: p.kind === 'text' ? p.text : undefined };
}

const ns = 'http://www.w3.org/2000/svg';
let nextInstance = 0;
type Command = SceneFrame['commands'][number];
type Entry = { node: SVGElement; kind: Primitive['kind']; attrs: Record<string, string | number> };
type Group = {
    node: SVGElement;
    nodes: Map<string, Entry>;
    commands: readonly Command[];
    selection: string;
    clipKeys: Map<string, Command['clip']>;
    count: number;
    x: number;
    y: number;
};
const clipKey = (c: Command['clip']) => `${c.x},${c.y},${c.width},${c.height}`;
export function createSvgBackend(svg: SVGSVGElement) {
    const instance = `worksheet-${++nextInstance}`,
        nodes = new Map<string, Entry>(),
        groups = new Map<string, Group>(),
        clips = new Map<string, { node: SVGElement; id: string }>();
    const element = (tag: string, attrs: Record<string, string | number> = {}) => {
        const node = document.createElementNS(ns, tag);
        for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
        return node;
    };
    const defs = element('defs');
    svg.appendChild(defs);
    let nextClip = 0,
        layer: SVGElement | undefined,
        translated: SVGElement | undefined;
    let lastWidth = -1,
        lastHeight = -1,
        lastTransform = '',
        lastLayerClip = '';
    const clipping = (key: string, clip: Command['clip']) => {
        let entry = clips.get(key);
        if (!entry) {
            const id = `${instance}-clip-${++nextClip}`,
                node = element('clipPath', { id });
            node.appendChild(element('rect', { ...clip }));
            defs.appendChild(node);
            entry = { id, node };
            clips.set(key, entry);
        }
        return entry.id;
    };
    const paintCommands = (
        parent: SVGElement,
        commands: readonly Command[],
        entries: Map<string, Entry>,
        selected: ReadonlySet<string>,
        initial: ChildNode | null,
        skip?: ChildNode,
    ): ChildNode | null => {
        const live = new Set(commands.filter((command) => command.clip.width > 0 && command.clip.height > 0).map((command) => command.id));
        // Remove obsolete nodes before ordering successors: retained siblings need no moves.
        let before = initial;
        for (const [id, entry] of entries)
            if (!live.has(id)) {
                if (before === entry.node) before = before.nextSibling;
                entry.node.remove();
                entries.delete(id);
            }
        for (const { id, clip, primitive } of commands) {
            if (clip.width <= 0 || clip.height <= 0) continue;
            if (skip && before === skip) before = before.nextSibling;
            const { tag, attrs } = svgPrimitive(primitive);
            if (selected.has(id)) {
                if (primitive.kind === 'line') attrs.stroke = '#ea580c';
                else attrs.fill = '#ea580c';
            }
            attrs['data-command'] = id;
            attrs['clip-path'] = `url(#${clipping(clipKey(clip), clip)})`;
            let entry = entries.get(id);
            if (!entry || entry.kind !== primitive.kind) {
                if (entry?.node === before) before = before.nextSibling;
                entry?.node.remove();
                entry = { node: element(tag), kind: primitive.kind, attrs: {} };
                entries.set(id, entry);
            }
            for (const key of Object.keys(entry.attrs)) if (!(key in attrs)) entry.node.removeAttribute(key);
            for (const [key, value] of Object.entries(attrs)) if (entry.attrs[key] !== value) entry.node.setAttribute(key, String(value));
            entry.attrs = attrs;
            if (primitive.kind === 'text' && entry.node.textContent !== primitive.text) entry.node.textContent = primitive.text;
            if (before !== entry.node) {
                if (before) parent.insertBefore(entry.node, before);
                else parent.appendChild(entry.node);
            }
            before = entry.node.nextSibling;
        }
        return before;
    };
    const noSelection = new Set<string>();
    return (frame: SceneFrame): void => {
        const data = frame.paneLayer;
        const rootCommands = data
            ? [...frame.commands.slice(0, data.commandStart), ...frame.commands.slice(data.commandEnd)]
            : frame.commands;
        const liveClips = new Map<string, Command['clip']>();
        let count = 0;
        for (const command of rootCommands)
            if (command.clip.width > 0 && command.clip.height > 0) {
                liveClips.set(clipKey(command.clip), command.clip);
                count++;
            }
        const prepared =
            data?.groups.map((item) => {
                const current = groups.get(item.id);
                let clipKeys: Map<string, Command['clip']>, commandCount: number;
                if (current?.commands === item.commands) {
                    clipKeys = current.clipKeys;
                    commandCount = current.count;
                } else {
                    clipKeys = new Map();
                    commandCount = 0;
                    for (const command of item.commands)
                        if (command.clip.width > 0 && command.clip.height > 0) {
                            clipKeys.set(clipKey(command.clip), command.clip);
                            commandCount++;
                        }
                }
                for (const [key, clip] of clipKeys) liveClips.set(key, clip);
                count += commandCount;
                return { item, current, clipKeys, commandCount };
            }) ?? [];
        if (data) liveClips.set(clipKey(data.clip), data.clip);
        const elementCount = count + liveClips.size * 2 + 2 + (data ? prepared.length + 2 : 0);
        if (elementCount > 10_000 || frame.hits.length > 5_000)
            throw new Error('resource-limit: SVG exceeds 5,000 marks or 10,000 elements');
        if (lastWidth !== frame.width) {
            svg.setAttribute('width', String(frame.width));
            lastWidth = frame.width;
        }
        if (lastHeight !== frame.height) {
            svg.setAttribute('height', String(frame.height));
            lastHeight = frame.height;
        }
        const viewBox = `0 0 ${frame.width} ${frame.height}`;
        if (svg.getAttribute?.('viewBox') !== viewBox) svg.setAttribute('viewBox', viewBox);
        for (const [key, clip] of clips)
            if (!liveClips.has(key)) {
                clip.node.remove();
                clips.delete(key);
            }
        for (const [key, clip] of liveClips) clipping(key, clip);
        const liveGroups = new Set(prepared.map((value) => value.item.id));
        for (const [id, group] of groups)
            if (!liveGroups.has(id)) {
                group.node.remove();
                groups.delete(id);
            }
        if (!data) {
            layer?.remove();
            layer = translated = undefined;
            lastTransform = lastLayerClip = '';
            paintCommands(svg, rootCommands, nodes, noSelection, defs.nextSibling);
            return;
        }
        if (!layer) {
            layer = element('g', { 'data-worksheet-layer': 'panes' });
            translated = element('g');
            layer.appendChild(translated);
        }
        const layerClip = `url(#${clipping(clipKey(data.clip), data.clip)})`,
            transform = `translate(${data.x} ${data.y})`;
        if (layerClip !== lastLayerClip) {
            layer.setAttribute('clip-path', layerClip);
            lastLayerClip = layerClip;
        }
        if (transform !== lastTransform) {
            translated!.setAttribute('transform', transform);
            lastTransform = transform;
        }
        let before = translated!.firstChild;
        for (const { item, current, clipKeys, commandCount } of prepared) {
            let group = current;
            if (!group) {
                group = {
                    node: element('g', { 'data-pane': item.id }),
                    nodes: new Map(),
                    commands: [],
                    selection: '',
                    clipKeys,
                    count: 0,
                    x: NaN,
                    y: NaN,
                };
                groups.set(item.id, group);
            }
            if (group.x !== item.x || group.y !== item.y) {
                group.node.setAttribute('transform', `translate(${item.x} ${item.y})`);
                group.x = item.x;
                group.y = item.y;
            }
            const selection = JSON.stringify(item.selectedIds);
            if (group.commands !== item.commands || group.selection !== selection) {
                paintCommands(group.node, item.commands, group.nodes, new Set(item.selectedIds), group.node.firstChild);
                group.commands = item.commands;
                group.selection = selection;
                group.clipKeys = clipKeys;
                group.count = commandCount;
            }
            if (before !== group.node) {
                if (before) translated!.insertBefore(group.node, before);
                else translated!.appendChild(group.node);
            }
            before = group.node.nextSibling;
        }
        // Root chrome is small; reconcile it once, then insert the shared pane layer
        // immediately after the background without moving retained mark nodes.
        paintCommands(svg, rootCommands, nodes, noSelection, defs.nextSibling, layer);
        const afterBackground = data.commandStart
            ? nodes.get(frame.commands[data.commandStart - 1].id)?.node.nextSibling
            : defs.nextSibling;
        if (afterBackground !== layer) {
            if (afterBackground) svg.insertBefore(layer, afterBackground);
            else svg.appendChild(layer);
        }
    };
}
