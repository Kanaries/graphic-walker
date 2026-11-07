import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreparedDataSource } from '../src/core/prepared';
import { domainRequestForWindow } from '../src/core/domains';
import type { PreparedRecord, RenderPlan, ResultBinding } from '../src/core/types';
import { buildScene } from '../src/scene/build';
import { arcBounds, arcPoint, arcSvgPath } from '../src/scene/arc';
import { hitTest, hitsInBox } from '../src/scene/hit';
import { translatedHit, translatedPrimitive } from '../src/scene/translate';
import { serializeSceneToSvg } from '../src/export/svg';
import { svgPrimitive } from '../src/backends/svg';
import { paintCanvas } from '../src/backends/canvas';
import type { ArcGeometry, Primitive, SceneFrame } from '../src/scene/types';

const binding = (fieldRef: string, band = false): ResultBinding => ({
    fieldRef,
    bindingId: fieldRef,
    columnKey: fieldRef,
    label: fieldRef,
    valueType: band ? 'string' : 'number',
    positionType: band ? 'band' : 'linear',
    analyticType: band ? 'dimension' : 'measure',
});
const plan = (overrides: Partial<RenderPlan> = {}): RenderPlan => ({
    bindings: [binding('weight'), binding('group', true)],
    mark: 'arc',
    rows: { facets: [], positions: [] },
    columns: { facets: [], positions: [] },
    domainPlanKey: 'arc-test',
    channels: { theta: { fieldRef: 'weight' }, color: { fieldRef: 'group' } },
    ...overrides,
});
async function scene(p: RenderPlan, records: readonly PreparedRecord[]) {
    const version = { sourceId: 'arc', snapshotId: '1', presentationId: '1' },
        source = createPreparedDataSource({
            version,
            plan: p,
            records,
            getDatumKey: (record) => String(record.id),
        }),
        signal = new AbortController().signal,
        manifest = await source.describe(signal),
        window = {
            rows: { start: 0, end: manifest.rowLeafCount },
            columns: { start: 0, end: manifest.columnLeafCount },
        };
    const [rows, columns, panes] = await Promise.all([
        source.readAxis({ version, axis: 'row', range: window.rows }, signal),
        source.readAxis({ version, axis: 'column', range: window.columns }, signal),
        source.readPaneData({ version, windows: [window] }, signal),
    ]);
    const domains = await source.readDomains(domainRequestForWindow(p, version, rows.leaves, columns.leaves), signal);
    return buildScene({
        plan: p,
        rows,
        columns,
        panes,
        domains,
        width: 1000,
        height: 800,
        scrollX: 0,
        scrollY: 0,
        frameId: 1,
    });
}
function arcs(frame: SceneFrame) {
    return frame.commands.map((command) => command.primitive).filter((p): p is Extract<Primitive, { kind: 'arc' }> => p.kind === 'arc');
}
function close(actual: number, expected: number) {
    assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
}

test('pie weights make clockwise sectors from north and preserve datum identity', async () => {
    const frame = await scene(plan(), [
            { id: 'a', weight: 1, group: 'a' },
            { id: 'b', weight: 3, group: 'b' },
        ]),
        [a, b] = arcs(frame);
    close(a.startAngle, -Math.PI / 2);
    close(a.endAngle, 0);
    close(b.startAngle, 0);
    close(b.endAngle, 1.5 * Math.PI);
    assert.deepEqual(
        frame.hits.map((hit) => hit.datumKey),
        ['a', 'b'],
    );
    const point = arcPoint(a, a.outerRadius * 0.7, -Math.PI / 4);
    assert.equal(hitTest(frame, point.x, point.y, 0)?.datumKey, 'a');
    const other = arcPoint(b, b.outerRadius * 0.7, Math.PI);
    assert.equal(hitTest(frame, other.x, other.y, 0)?.datumKey, 'b');
});

test('implicit theta gives equal slices, null/zero weights disappear, and huge finite totals remain finite', async () => {
    const equal = await scene(plan({ channels: { color: { fieldRef: 'group' } } }), [
        { id: 'a', weight: 99, group: 'a' },
        { id: 'b', weight: 1, group: 'b' },
    ]);
    close(arcs(equal)[0].endAngle, Math.PI / 2);
    const zero = await scene(plan(), [
        { id: 'zero', weight: 0, group: 'z' },
        { id: 'null', weight: null, group: 'n' },
        { id: 'yes', weight: 1, group: 'y' },
    ]);
    assert.deepEqual(
        zero.hits.map((hit) => hit.datumKey),
        ['yes'],
    );
    close(arcs(zero)[0].endAngle - arcs(zero)[0].startAngle, Math.PI * 2);
    const huge = await scene(plan(), [
        { id: 'a', weight: 1e308, group: 'a' },
        { id: 'b', weight: 1e308, group: 'b' },
    ]);
    close(arcs(huge)[0].endAngle, Math.PI / 2);
    assert.equal(arcs(await scene(plan(), [{ id: 'zero', weight: 0, group: 'z' }])).length, 0);
});

test('negative theta fails explicitly without drawing a misleading signed pie', async () => {
    await assert.rejects(
        scene(plan(), [
            { id: 'a', weight: 1, group: 'a' },
            { id: 'b', weight: -1, group: 'b' },
        ]),
        /theta.*nonnegative/,
    );
});

test('donut hover and brush respect the empty hole and true circular boundaries', async () => {
    const frame = await scene(plan({ style: { arcInnerRadius: 25 } }), [{ id: 'ring', weight: 1, group: 'a' }]),
        ring = arcs(frame)[0];
    assert.equal(hitTest(frame, ring.x, ring.y), undefined);
    for (const inset of [0.01, 1, 3]) assert.equal(hitTest(frame, ring.x + ring.innerRadius - inset, ring.y), undefined, 'default pointer tolerance never enters the hole');
    assert.equal(hitTest(frame, ring.x + ring.innerRadius, ring.y)?.datumKey, 'ring');
    assert.equal(hitTest(frame, ring.x + ring.outerRadius + 2, ring.y)?.datumKey, 'ring', 'outer-edge pointer tolerance remains available');
    assert.deepEqual(hitsInBox(frame, { x: ring.x - 10, y: ring.y - 10, width: 20, height: 20 }), []);
    assert.equal(hitsInBox(frame, { x: ring.x + 30, y: ring.y - 2, width: 4, height: 4 }).length, 1);
    // This brush intersects a curved boundary although none of its corners lies inside the ring.
    assert.equal(
        hitsInBox(frame, {
            x: ring.x - 1,
            y: ring.y - ring.outerRadius - 1,
            width: 2,
            height: 2,
        }).length,
        1,
    );
    assert.equal(
        hitsInBox(frame, {
            x: ring.x + ring.outerRadius - 2,
            y: ring.y + ring.outerRadius - 2,
            width: 2,
            height: 2,
        }).length,
        0,
    );
});

test('a sector brush excludes the rest of its bounding rectangle and observes clipping', () => {
    const geometry = {
            kind: 'arc' as const,
            x: 100,
            y: 100,
            innerRadius: 20,
            outerRadius: 80,
            startAngle: -Math.PI / 2,
            endAngle: 0,
        },
        frame: SceneFrame = {
            frameId: 1,
            width: 200,
            height: 200,
            commands: [],
            headers: [],
            rowStart: 0,
            columnStart: 0,
            hits: [
                {
                    id: 'q',
                    paneKey: 'p',
                    datumKey: 'q',
                    values: {},
                    box: arcBounds(geometry),
                    clip: { x: 0, y: 0, width: 200, height: 200 },
                    geometry,
                },
            ],
        };
    assert.equal(hitsInBox(frame, { x: 172, y: 22, width: 6, height: 6 }).length, 0);
    assert.equal(hitsInBox(frame, { x: 140, y: 55, width: 4, height: 4 }).length, 1);
    frame.hits[0].clip = { x: 0, y: 0, width: 120, height: 200 };
    assert.equal(hitsInBox(frame, { x: 140, y: 55, width: 4, height: 4 }).length, 0);
    assert.equal(hitTest(frame, 142, 57, 0), undefined);
});

test('radius fields use one complete domain across facet pies and explicit ranges are pixels', async () => {
    const p = plan({
        bindings: [binding('weight'), binding('group', true), binding('r'), binding('facet', true)],
        rows: { facets: ['facet'], positions: [] },
        channels: { theta: { fieldRef: 'weight' }, radius: { fieldRef: 'r' } },
        scales: { r: { domain: [0, 100], range: [0, 60] } },
    });
    const frame = await scene(p, [
        { id: 'a', weight: 1, r: 25, facet: 'a', group: 'a' },
        { id: 'b', weight: 1, r: 100, facet: 'b', group: 'a' },
    ]);
    assert.deepEqual(
        arcs(frame).map((arc) => arc.outerRadius),
        [15, 60],
    );
});

test('arc size encodes area; constant radius and zero/null inputs have explicit semantics', async () => {
    const p = plan({
        channels: { theta: { fieldRef: 'weight' }, size: { value: Math.PI * 900 } },
    });
    close(arcs(await scene(p, [{ id: 'a', weight: 1, group: 'a' }]))[0].outerRadius, 30);
    const radius = plan({
        channels: { theta: { fieldRef: 'weight' }, radius: { value: 18 } },
    });
    close(arcs(await scene(radius, [{ id: 'a', weight: 1, group: 'a' }]))[0].outerRadius, 18);
    const variable = plan({
        bindings: [binding('weight'), binding('r')],
        channels: { theta: { fieldRef: 'weight' }, radius: { fieldRef: 'r' } },
        scales: { r: { domain: [0, 10] } },
    });
    assert.equal(
        arcs(
            await scene(variable, [
                { id: 'zero', weight: 1, r: 0 },
                { id: 'null', weight: 1, r: null },
            ]),
        ).length,
        0,
    );
    await assert.rejects(scene(variable, [{ id: 'negative', weight: 1, r: -1 }]), /radius.*nonnegative/);
});

test('default radial domains include zero so positive minima stay visible and area ratios remain proportional', async () => {
    const records = [{ id: 'a', weight: 1, r: 25 }, { id: 'b', weight: 1, r: 100 }];
    const p = plan({ bindings: [binding('weight'), binding('r')], channels: { theta: { fieldRef: 'weight' }, radius: { fieldRef: 'r' } } });
    const radial = arcs(await scene(p, records));
    assert.equal(radial.length, 2);
    close(radial[0].outerRadius / radial[1].outerRadius, 0.25);
    const sized = arcs(await scene({ ...p, channels: { theta: { fieldRef: 'weight' }, size: { fieldRef: 'r' } } }, records));
    assert.equal(sized.length, 2);
    close((sized[0].outerRadius / sized[1].outerRadius) ** 2, 0.25);
});

test('transparent arcs have no interaction target and invalid radial values fail even for zero theta', async () => {
    const transparent = await scene(plan({ channels: { theta: { fieldRef: 'weight' }, opacity: { value: 0 } } }), [{ id: 'a', weight: 1, group: 'a' }]);
    assert.equal(transparent.hits.length, 0);
    const p = plan({ bindings: [binding('weight'), binding('r')], channels: { theta: { fieldRef: 'weight' }, radius: { fieldRef: 'r' } } });
    await assert.rejects(scene(p, [{ id: 'a', weight: 0, r: -1 }]), /radius.*nonnegative/);
});

test('SVG live attributes and serialized export share true full-ring arcs', async () => {
    const frame = await scene(plan({ style: { arcInnerRadius: 20 } }), [{ id: 'a', weight: 1, group: 'a' }]),
        arc = arcs(frame)[0];
    const path = arcSvgPath(arc),
        live = svgPrimitive(arc),
        result = serializeSceneToSvg(frame, {
            maxElements: 1000,
            maxBytes: 100_000,
        });
    assert.equal((path.match(/ A/g) ?? []).length, 4);
    assert.equal(live.tag, 'path');
    assert.equal(live.attrs.d, path);
    assert.ok(result.content.includes(`d="${path}"`));
    assert.equal(/NaN|Infinity/.test(result.content), false);
    assert.throws(() => arcSvgPath({ ...arc, endAngle: Infinity }), /invalid arc/);
});

test('Canvas paints an annular path with the inner circle reversed and no second bitmap', async () => {
    const frame = await scene(plan({ style: { arcInnerRadius: 20 } }), [{ id: 'a', weight: 1, group: 'a' }]);
    frame.commands = frame.commands.filter((command) => command.primitive.kind === 'arc');
    const calls: Array<{ name: string; args: unknown[] }> = [],
        context = new Proxy(
            {},
            {
                get:
                    (_, name) =>
                    (...args: unknown[]) =>
                        calls.push({ name: String(name), args }),
                set: () => true,
            },
        );
    let contexts = 0;
    const canvas = {
        width: 0,
        height: 0,
        style: {},
        getContext: () => {
            contexts++;
            return context;
        },
    };
    paintCanvas(canvas as unknown as HTMLCanvasElement, frame, 1);
    const arcCalls = calls.filter((call) => call.name === 'arc');
    assert.equal(contexts, 1);
    assert.equal(arcCalls.length, 2);
    assert.equal(arcCalls[1].args[5], true);
    close(Number(arcCalls[1].args[3]) - Number(arcCalls[1].args[4]), Math.PI * 2);
});

test('translated cached arcs and their hit targets remain aligned after scrolling', async () => {
    const frame = await scene(plan({ style: { arcInnerRadius: 20 } }), [{ id: 'a', weight: 1, group: 'a' }]),
        arc = arcs(frame)[0];
    const shifted = translatedPrimitive(arc, 30, 40, true),
        hit = translatedHit(frame.hits[0], 30, 40, {
            x: 0,
            y: 0,
            width: 1000,
            height: 800,
        })!;
    assert.equal(shifted.kind, 'arc');
    assert.equal(hit.geometry?.kind, 'arc');
    if (shifted.kind !== 'arc' || hit.geometry?.kind !== 'arc') throw new Error('Expected arc');
    assert.equal(shifted.x, arc.x + 30);
    assert.equal(shifted.y, arc.y + 40);
    assert.equal(shifted.fill, '#ea580c');
    assert.equal(shifted.x, hit.geometry.x);
    assert.equal(shifted.y, hit.geometry.y);
    const moved = { ...frame, hits: [hit] },
        point = arcPoint(hit.geometry, 30, Math.PI);
    assert.equal(hitTest(moved, point.x, point.y, 0)?.datumKey, 'a');
});

function sizeLegend(frame: SceneFrame) {
    const swatches = frame.commands.filter(command => command.id.startsWith('legend-swatch:size:')).map(command => command.primitive);
    const labels = frame.commands.filter(command => command.id.startsWith('legend-value:size:')).map(command => command.primitive);
    return {
        radii: swatches.map(mark => { assert.equal(mark.kind, 'circle'); return mark.kind === 'circle' ? mark.radius : NaN; }),
        labels: labels.map(mark => { assert.equal(mark.kind, 'text'); return mark.kind === 'text' ? mark.text : ''; }),
    };
}
const sizedPie = (overrides: Partial<RenderPlan> = {}) => plan({
    bindings: [binding('weight'), binding('size')], channels: { theta: { fieldRef: 'weight' }, size: { fieldRef: 'size' } }, ...overrides,
});

test('arc size legend includes zero and scales real pane radii by one common factor', async () => {
    const frame = await scene(sizedPie(), [25, 50, 100].map(size => ({ id: String(size), weight: 1, size }))),
        legend = sizeLegend(frame), marks = arcs(frame);
    assert.deepEqual(legend.labels, ['0', '50', '100']);
    close(legend.radii[0], 0); close(legend.radii[1], 9 * Math.sqrt(0.5)); close(legend.radii[2], 9);
    close(marks[0].outerRadius / marks[2].outerRadius, 0.5);
    close(legend.radii[1] / legend.radii[2], marks[1].outerRadius / marks[2].outerRadius);
});

test('arc size legend respects zero false without restoring the point size range', async () => {
    const frame = await scene(sizedPie({ scales: { size: { zero: false } } }), [25, 62.5, 100].map(size => ({ id: String(size), weight: 1, size }))),
        legend = sizeLegend(frame), marks = arcs(frame);
    assert.deepEqual(legend.labels, ['25', '62.5', '100']);
    close(legend.radii[0], 0); close(legend.radii[1], 9 * Math.sqrt(0.5)); close(legend.radii[2], 9);
    assert.equal(marks.length, 2);
    close(legend.radii[1] / legend.radii[2], marks[0].outerRadius / marks[1].outerRadius);
});

test('arc size legend shares explicit area ranges, fixed domains, radius caps and pane dimensions', async () => {
    const p = sizedPie({
        layout: { rowHeight: 200, columnWidth: 300 }, style: { arcOuterRadius: 40 },
        scales: { size: { domain: [0, 100], range: [Math.PI * 100, Math.PI * 6400] } },
    });
    const frame = await scene(p, [0, 50, 100].map(size => ({ id: String(size), weight: 1, size }))),
        legend = sizeLegend(frame), marks = arcs(frame);
    assert.deepEqual(legend.labels, ['0', '50', '100']);
    assert.deepEqual(marks.map(mark => mark.outerRadius), [10, 40, 40]);
    assert.deepEqual(legend.radii, [2.25, 9, 9]);
    for (let index = 0; index < marks.length; index++) close(legend.radii[index] / marks[index].outerRadius, 9 / 40);
    const narrow = await scene({ ...p, layout: { rowHeight: 80, columnWidth: 300 } }, [0, 50, 100].map(size => ({ id: String(size), weight: 1, size })));
    assert.deepEqual(arcs(narrow).map(mark => mark.outerRadius), [10, 28, 28]);
    for (let index = 0; index < 3; index++) close(sizeLegend(narrow).radii[index] / arcs(narrow)[index].outerRadius, 9 / 28);
});
