import { parse, View, type Spec } from 'vega';
import { layers, type Layer, type Primitive, type Scene } from './scene';

const kinds = ['rect', 'path', 'symbol', 'text'] as const;
export const dataName = (layer: Layer, kind: Primitive['kind']) => `${layer}_${kind}`;
export function sceneData(scene: Scene): Map<string, Primitive[]> {
    const data = new Map<string, Primitive[]>(layers.flatMap(layer => kinds.map(kind => [dataName(layer, kind), []] as [string, Primitive[]])));
    for (const item of scene.items) data.get(dataName(item.layer, item.kind))!.push(item);
    return data;
}

// Vega only paints positioned primitives. One group per scene layer keeps the paint order
// across mark types; there is one View and one canvas for the whole worksheet.
export function vegaSpec(scene: Scene): Spec {
    const data = sceneData(scene);
    const pointer = { signal: "datum.selection ? 'pointer' : 'default'" };
    return {
        $schema: 'https://vega.github.io/schema/vega/v5.json',
        width: scene.width, height: scene.height, padding: 0, autosize: 'none', background: '#ffffff',
        data: [...data].map(([name, values]) => ({ name, values })),
        marks: layers.map(layer => ({
            type: 'group' as const,
            encode: { update: { x: { value: 0 }, y: { value: 0 } } },
            marks: [
                { type: 'rect' as const, from: { data: dataName(layer, 'rect') }, encode: { update: {
                    x: { field: 'x' }, y: { field: 'y' }, width: { field: 'width' }, height: { field: 'height' },
                    fill: { field: 'fill' }, stroke: { field: 'stroke' }, opacity: { field: 'opacity' }, cursor: pointer,
                } } },
                { type: 'path' as const, from: { data: dataName(layer, 'path') }, interactive: false, encode: { update: {
                    x: { field: 'x' }, y: { field: 'y' }, path: { field: 'path' }, stroke: { field: 'stroke' }, strokeWidth: { value: 1.8 }, opacity: { field: 'opacity' },
                } } },
                { type: 'symbol' as const, from: { data: dataName(layer, 'symbol') }, encode: { update: {
                    x: { field: 'x' }, y: { field: 'y' }, size: { field: 'size' }, fill: { field: 'fill' }, opacity: { field: 'opacity' }, cursor: pointer,
                } } },
                { type: 'text' as const, from: { data: dataName(layer, 'text') }, encode: { update: {
                    x: { field: 'x' }, y: { field: 'y' }, text: { field: 'text' }, fill: { field: 'fill' }, align: { field: 'align' },
                    angle: { field: 'angle' }, fontSize: { field: 'fontSize' }, fontWeight: { field: 'fontWeight' },
                    font: { value: 'system-ui, sans-serif' }, opacity: { field: 'opacity' }, cursor: pointer,
                } } },
            ],
        })),
    };
}

export async function sceneToSVG(scene: Scene): Promise<string> {
    const view = new View(parse(vegaSpec(scene)), { renderer: 'none' });
    try { await view.runAsync(); return await view.toSVG(); }
    finally { view.finalize(); }
}
