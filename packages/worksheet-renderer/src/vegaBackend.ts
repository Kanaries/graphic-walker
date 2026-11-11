import { parse, View, type Spec } from 'vega';
import { layers, type Layer, type Primitive, type Scene } from './scene';

// The order things are painted in within a layer. 'surface' and 'rule' hold the rects and lines marked
// `under`, so the paper and the grid stay below the marks whatever kind those are.
const slots = ['surface', 'rule', 'rect', 'shape', 'path', 'symbol', 'text'] as const;
type Slot = typeof slots[number];
export const dataName = (layer: Layer, slot: Slot) => `${layer}_${slot}`;
const slotOf = (item: Primitive): Slot => item.under && item.kind === 'rect' ? 'surface' : item.under && item.kind === 'path' ? 'rule' : item.kind;
export function sceneData(scene: Scene): Map<string, Primitive[]> {
    const data = new Map<string, Primitive[]>(layers.flatMap(layer => slots.map(slot => [dataName(layer, slot), []] as [string, Primitive[]])));
    for (const item of scene.items) data.get(dataName(item.layer, slotOf(item)))!.push(item);
    return data;
}

// Vega only paints positioned primitives. One group per scene layer keeps the paint order
// across mark types; there is one View and one canvas for the whole worksheet.
export function vegaSpec(scene: Scene): Spec {
    const data = sceneData(scene);
    const pointer = { signal: "datum.selection ? 'pointer' : 'default'" };
    return {
        $schema: 'https://vega.github.io/schema/vega/v5.json',
        width: scene.width, height: scene.height, padding: 0, autosize: 'none', background: scene.background,
        data: [...data].map(([name, values]) => ({ name, values })),
        marks: layers.map(layer => ({
            type: 'group' as const,
            encode: { update: { x: { value: 0 }, y: { value: 0 } } },
            marks: [
                { type: 'rect' as const, from: { data: dataName(layer, 'surface') }, encode: { update: {
                    x: { field: 'x' }, y: { field: 'y' }, width: { field: 'width' }, height: { field: 'height' }, fill: { field: 'fill' },
                } } },
                { type: 'path' as const, from: { data: dataName(layer, 'rule') }, interactive: false, encode: { update: {
                    x: { field: 'x' }, y: { field: 'y' }, path: { field: 'path' }, stroke: { field: 'stroke' }, strokeWidth: { signal: 'datum.strokeWidth || 1' }, strokeDash: { field: 'dash' },
                } } },
                { type: 'rect' as const, from: { data: dataName(layer, 'rect') }, encode: { update: {
                    x: { field: 'x' }, y: { field: 'y' }, width: { field: 'width' }, height: { field: 'height' },
                    fill: { field: 'fill' }, stroke: { field: 'stroke' }, opacity: { field: 'opacity' }, cursor: pointer,
                    cornerRadiusTopLeft: { signal: 'datum.radius ? datum.radius[0] : 0' }, cornerRadiusTopRight: { signal: 'datum.radius ? datum.radius[1] : 0' },
                    cornerRadiusBottomRight: { signal: 'datum.radius ? datum.radius[2] : 0' }, cornerRadiusBottomLeft: { signal: 'datum.radius ? datum.radius[3] : 0' },
                } } },
                { type: 'path' as const, from: { data: dataName(layer, 'shape') }, encode: { update: {
                    x: { field: 'x' }, y: { field: 'y' }, path: { field: 'path' }, fill: { field: 'fill' }, stroke: { field: 'stroke' }, strokeWidth: { field: 'strokeWidth' },
                    opacity: { field: 'opacity' }, cursor: pointer,
                } } },
                { type: 'path' as const, from: { data: dataName(layer, 'path') }, interactive: false, encode: { update: {
                    x: { field: 'x' }, y: { field: 'y' }, path: { field: 'path' }, stroke: { field: 'stroke' }, strokeWidth: { signal: 'datum.strokeWidth || 1.8' }, strokeDash: { field: 'dash' }, opacity: { field: 'opacity' },
                } } },
                { type: 'symbol' as const, from: { data: dataName(layer, 'symbol') }, encode: { update: {
                    x: { field: 'x' }, y: { field: 'y' }, size: { field: 'size' }, shape: { signal: "datum.symbol || 'circle'" }, fill: { field: 'fill' }, stroke: { field: 'stroke' }, strokeWidth: { field: 'strokeWidth' },
                    opacity: { field: 'opacity' }, cursor: pointer,
                } } },
                { type: 'text' as const, from: { data: dataName(layer, 'text') }, encode: { update: {
                    x: { field: 'x' }, y: { field: 'y' }, text: { field: 'text' }, fill: { field: 'fill' }, align: { field: 'align' },
                    angle: { field: 'angle' }, fontSize: { field: 'fontSize' }, fontWeight: { field: 'fontWeight' },
                    font: { signal: "datum.font || 'system-ui, sans-serif'" }, opacity: { field: 'opacity' }, cursor: pointer,
                } } },
            ],
        })),
    };
}

/**
 * The scene as a PNG data URL, `scale` device pixels per CSS pixel. Needs a canvas, so it
 * works in a browser and not in plain Node.
 */
export async function sceneToPNG(scene: Scene, scale = 2): Promise<string> {
    const view = new View(parse(vegaSpec(scene)), { renderer: 'none' });
    try { await view.runAsync(); return (await view.toCanvas(scale)).toDataURL('image/png'); }
    finally { view.finalize(); }
}

export async function sceneToSVG(scene: Scene): Promise<string> {
    const view = new View(parse(vegaSpec(scene)), { renderer: 'none' });
    try { await view.runAsync(); return await view.toSVG(); }
    finally { view.finalize(); }
}
