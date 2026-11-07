jest.mock('nanoid', () => ({ nanoid: () => 'native-canonical-id' }));
jest.mock('../computation/clientComputation', () => ({ getComputation: jest.fn() }));
import type { IChart, IMutField, IRendererType, IViewField, IWorksheetLayout } from '../interfaces';
import { normalize } from './normalize';
import { createMemoryProvider } from '../dataSourceProvider/memory';
import { syncProviderSpecs } from '../dataSource/syncSpecs';
import { fromSnapshot, performers, redo, undo, resolveChart, exportFullRaw, importFull } from './visSpecHistory';
import { VizSpecStore } from '../store/visualSpecStore';
import { getLegacyRendererDiagnostics } from '../lib/native/legacyCapabilities';

const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
const eventDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'CustomEvent');
beforeAll(() => {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { dispatchEvent: jest.fn() } });
    Object.defineProperty(globalThis, 'CustomEvent', { configurable: true, value: class { constructor(public type: string, public init?: unknown) {} } });
});
afterAll(() => {
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor); else Reflect.deleteProperty(globalThis, 'document');
    if (eventDescriptor) Object.defineProperty(globalThis, 'CustomEvent', eventDescriptor); else Reflect.deleteProperty(globalThis, 'CustomEvent');
});

const dim = (fid: string): IViewField => ({ fid, name: fid, analyticType: 'dimension', semanticType: 'nominal' });
const mea = (fid: string): IViewField => ({ fid, name: fid, analyticType: 'measure', semanticType: 'quantitative', aggName: 'sum' });
const dims = Array.from({ length: 40 }, (_, index) => dim(`d${index}`));
const meta: IMutField[] = [...dims, mea('sales'), mea('profit')];
const worksheet: IWorksheetLayout = { scaleScopes: { x: { mode: 'prefix', rowDepth: 1, columnDepth: 2 }, y: { mode: 'pane' } }, barLayout: 'grouped' };
const chart = (depth = 20, renderer: IRendererType = 'native') => normalize({
    visId: 'deep-native', config: { geoms: ['bar'] }, layout: { renderer, worksheet, stack: 'none' },
    encodings: { rows: [mea('sales'), ...dims.slice(0, depth), mea('profit')], columns: [mea('profit'), ...dims.slice(20, 20 + depth)] },
}, meta);
const axes = (value: IChart) => ({ rows: value.encodings.rows.map(field => field.fid), columns: value.encodings.columns.map(field => field.fid) });
function expectPreserved(value: IChart, expected: IChart) {
    expect(axes(value)).toEqual(axes(expected)); expect(value.layout.worksheet).toEqual(worksheet);
}

describe.each([3, 5, 10, 20])('canonical axes with %i dimensions', depth => {
    test.each<IRendererType>(['native', 'vega-lite', 'observable-plot'])('%s retains all fields with stable dimension/measure order and idempotent normalization', renderer => {
        const value = chart(depth, renderer);
        expect(value.encodings.rows.map(field => field.fid)).toEqual([...dims.slice(0, depth).map(field => field.fid), 'sales', 'profit']);
        expect(value.encodings.columns.map(field => field.fid)).toEqual([...dims.slice(20, 20 + depth).map(field => field.fid), 'profit']);
        expect(normalize(value, meta)).toEqual(value); expect(value.layout.renderer).toBe(renderer);
        if (renderer !== 'native') expect(getLegacyRendererDiagnostics(value, renderer).length).toBeGreaterThan(0);
    });
});

test('renderer changes, field edits, geom changes and undo/redo preserve deep fields in editor history', () => {
    const initial = chart(), snapshot = JSON.stringify(initial);
    let history = fromSnapshot(initial);
    for (const renderer of ['vega-lite', 'observable-plot', 'native'] as const) {
        history = performers.setLayout(history, [['renderer', renderer]]);
        expectPreserved(history.now, initial); expect(history.now.layout.renderer).toBe(renderer);
        history = performers.setConfig(history, 'geoms', ['line']); expectPreserved(history.now, initial);
    }
    const edited = performers.reorderField(history, 'rows', 0, 19);
    expect(edited.now.encodings.rows.map(field => field.fid)).toEqual(['d19', ...dims.slice(1, 19).map(field => field.fid), 'd0', 'sales', 'profit']);
    expectPreserved(undo(edited).now, initial);
    expect(redo(undo(edited)).now).toEqual(edited.now);
    const raw = exportFullRaw(edited);
    expect(resolveChart(raw)).toEqual(edited.now); expect(importFull(raw).now).toEqual(edited.now);
    expect(JSON.stringify(initial)).toBe(snapshot);
});

test('all store code, raw-history and replacement entry points roundtrip native layout and complete axes', () => {
    const value = chart(), store = new VizSpecStore(meta);
    store.importCode([value]); expectPreserved(store.exportCode()[0], value);
    store.setVisualLayout('renderer', 'observable-plot'); store.setVisualConfig('geoms', ['point']);
    expectPreserved(store.exportCode()[0], value); store.undo(); store.undo(); expect(store.exportCode()[0].layout.renderer).toBe('native');
    store.redo(); expect(store.exportCode()[0].layout.renderer).toBe('observable-plot');
    const raw = store.exportCurrentChart(); expectPreserved(resolveChart(raw), value);
    store.importRaw([raw]); expectPreserved(store.exportCode()[0], value);
    store.appendRaw(raw); expectPreserved(store.exportCode()[1], value);
    store.appendFromCode(value); expectPreserved(store.exportCode()[2], value);
    const shallow = chart(3); store.replaceNow(shallow); expectPreserved(store.exportCode()[2], shallow);
    store.applyChart(value); expectPreserved(store.exportCode()[2], value);
    store.undo(); expectPreserved(store.exportCode()[2], shallow); store.redo(); expectPreserved(store.exportCode()[2], value);
    const restored = new VizSpecStore(meta); restored.importRaw(store.exportAllCharts());
    expect(restored.exportCode().map(axes)).toEqual(store.exportCode().map(axes));
});

test('legacy and terse inputs keep complete axes, while Pivot and geographic retain their original routes and coordinate rules', () => {
    const legacy = normalize({ visId: 'legacy', config: { geoms: ['bar'], stack: 'none' }, encodings: { rows: [...dims.slice(0, 10), mea('sales')], columns: dims.slice(20, 30) } } as any, meta);
    expect(legacy.encodings.rows).toHaveLength(11); expect(legacy.encodings.columns).toHaveLength(10);
    const terse = normalize({ mark: 'bar', x: dims.slice(20, 30).map(field => field.fid), y: [...dims.slice(0, 10).map(field => field.fid), 'sum(sales)'], layout: { renderer: 'native', worksheet } }, meta);
    expect(terse.encodings.rows).toHaveLength(11); expect(terse.encodings.columns).toHaveLength(10); expect(terse.layout.worksheet).toEqual(worksheet);
    for (const config of [{ geoms: ['table'] }, { geoms: ['poi'], coordSystem: 'geographic' as const }]) {
        const routed = normalize({ ...chart(), config, encodings: { ...chart().encodings, latitude: [mea('sales'), mea('profit')], longitude: [mea('profit'), mea('sales')] } }, meta);
        expectPreserved(routed, chart()); expect(getLegacyRendererDiagnostics(routed)).toEqual([]);
        expect(routed.encodings.latitude).toHaveLength(1); expect(routed.encodings.longitude).toHaveLength(1);
        expect(routed.encodings.latitude[0]).toMatchObject({ fid: 'sales', analyticType: 'dimension', semanticType: 'quantitative' });
    }
});

test('published canonical schema exposes only approved worksheet display extensions and keeps the existing renderer default', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const current = fs.readFileSync(path.join(__dirname, '../../public/tersespec_v1.json'), 'utf8');
    const playground = fs.readFileSync(path.join(__dirname, '../../../playground/public/tersespec_v1.json'), 'utf8');
    expect(current).toBe(playground);
    const definitions = JSON.parse(current).definitions;
    expect(definitions.IRendererType.enum).toEqual(['vega-lite', 'observable-plot', 'native']);
    expect(JSON.parse(current).properties.layout.properties.renderer.default).toBe('vega-lite');
    expect(Object.keys(definitions.IWorksheetLayout.properties)).toEqual(['scaleScopes', 'barLayout']);
    expect(definitions.IWorksheetLayout.additionalProperties).toBe(false);
    const scopes = definitions.IWorksheetScaleScope.anyOf;
    expect(scopes.map((scope: any) => scope.properties.mode.const)).toEqual(['shared', 'pane', 'prefix']);
    for (const depth of ['rowDepth', 'columnDepth']) expect(scopes[2].properties[depth]).toEqual({ type: 'integer', minimum: 0 });
});


test('provider save, file reload and asynchronous spec sync preserve full native history', async () => {
    const value = chart(), store = new VizSpecStore(meta);
    store.importCode([value]); store.setVisualLayout('renderer', 'observable-plot'); store.setVisualConfig('geoms', ['line']);
    const provider = createMemoryProvider(), datasetId = await provider.addDataSource([], meta, 'Native worksheet fixture');
    await provider.saveSpecs(datasetId, JSON.stringify(store.exportAllCharts()));
    const loaded = createMemoryProvider(provider.exportData()), restored = new VizSpecStore(meta);
    await syncProviderSpecs(loaded, datasetId, { current: restored });
    expect(restored.exportCode().map(axes)).toEqual(store.exportCode().map(axes));
    expect(restored.exportCode()[0].layout.worksheet).toEqual(worksheet);
    restored.undo(); restored.undo(); expect(restored.exportCode()[0].layout.renderer).toBe('native');
    expectPreserved(restored.exportCode()[0], value);
});
