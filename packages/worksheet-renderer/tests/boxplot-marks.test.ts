import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreparedDataSource } from '../src/core/prepared';
import { domainRequestForWindow } from '../src/core/domains';
import type { PreparedRecord, RenderPlan, ResultBinding } from '../src/core/types';
import { buildScene, type SceneInput } from '../src/scene/build';
import { createSceneCache, type CachedPaneGeometry } from '../src/scene/cache';
import { hitTest, hitsInBox } from '../src/scene/hit';

const roles = ['lower', 'q1', 'median', 'q3', 'upper'];
const binding = (fieldRef: string, band = false): ResultBinding => ({
    fieldRef, bindingId: fieldRef, columnKey: fieldRef, label: fieldRef,
    valueType: band ? 'string' : 'number', positionType: band ? 'band' : 'linear', analyticType: band ? 'dimension' : 'measure',
});
const plan = (overrides: Partial<RenderPlan> = {}): RenderPlan => ({
    mark: 'boxplot', bindings: [binding('category', true), binding('value'), binding('series', true)],
    rows: { facets: [], positions: ['value'] }, columns: { facets: [], positions: ['category'] },
    boxplot: { groupKeyColumn: '__group', roleColumn: '__role' },
    domainPlanKey: 'boxplot', barOrientation: 'vertical', stack: 'none', scales: { value: { domain: [-10, 10] } },
    ...overrides,
});
const summary = (group: string, values: readonly number[] = [-5, -2, 1, 3, 5], extra: PreparedRecord = {}): PreparedRecord[] =>
    values.map((value, index) => ({ id: `${group}:${roles[index]}`, __group: group, __role: roles[index], category: 'A', series: 'one', value, ...extra }));
const outlier = (group: string, id: string, value: number, extra: PreparedRecord = {}): PreparedRecord =>
    ({ id, __group: group, __role: 'outlier', category: 'A', series: 'one', value, ...extra });
async function input(p: RenderPlan, records: readonly PreparedRecord[]): Promise<SceneInput> {
    const version = { sourceId: 'boxplot', snapshotId: '1', presentationId: '1' },
        source = createPreparedDataSource({ plan: p, records, version, getDatumKey: (record) => String(record.id) }),
        signal = new AbortController().signal, manifest = await source.describe(signal),
        window = { rows: { start: 0, end: manifest.rowLeafCount }, columns: { start: 0, end: manifest.columnLeafCount } };
    const [rows, columns, panes] = await Promise.all([
        source.readAxis({ version, axis: 'row', range: window.rows }, signal),
        source.readAxis({ version, axis: 'column', range: window.columns }, signal),
        source.readPaneData({ version, windows: [window] }, signal),
    ]);
    const domains = await source.readDomains(domainRequestForWindow(p, version, rows.leaves, columns.leaves), signal);
    return { plan: p, rows, columns, panes, domains, width: 900, height: 600, scrollX: 0, scrollY: 0, frameId: 1 };
}
const scene = async (p: RenderPlan, records: readonly PreparedRecord[]) => buildScene(await input(p, records));
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const normalized = (value: unknown) => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'number' ? Math.round(item * 1e8) / 1e8 : item));

test('boxplot consumes prepared statistics and returns one summary target plus independent outlier datums', async () => {
    const stats = summary('a'), outliers = [outlier('a', 'raw-low', -8), outlier('a', 'raw-high', 8)],
        frame = await scene(plan(), [...stats, ...outliers]), group = frame.hits[0];
    assert.equal(frame.hits.length, 3);
    assert.equal(group.kind, 'segment');
    assert.deepEqual(group.datumKeys, stats.map((record) => record.id));
    assert.deepEqual(group.recordValues, stats);
    assert.equal(group.label, 'value: lower=-5, Q1=-2, median=1, Q3=3, upper=5');
    assert.deepEqual(frame.hits.slice(1).map((hit) => [hit.kind, hit.datumKey, hit.values.value]), [['datum', 'raw-low', -8], ['datum', 'raw-high', 8]]);
    assert.ok(frame.hits.slice(1).every((hit) => hit.geometry?.kind === 'circle'));
    const commands = frame.commands.filter((command) => command.interactionId === group.id);
    assert.equal(commands.length, 10);
    assert.equal(new Set(frame.commands.map((command) => command.id)).size, frame.commands.length);
    assert.equal(commands.filter((command) => command.id.endsWith(':median')).length, 1);
    assert.equal(commands.filter((command) => command.id.endsWith('-cap')).length, 2);
});

for (const horizontal of [false, true]) {
    test(`boxplot ${horizontal ? 'horizontal' : 'vertical'} geometry follows negative statistics and exact whisker hits`, async () => {
        const frame = await scene(plan(horizontal ? {
            rows: { facets: [], positions: ['category'] }, columns: { facets: [], positions: ['value'] }, barOrientation: 'horizontal',
        } : {}), summary('a'));
        const hit = frame.hits[0], boxCommand = frame.commands.find((command) => command.id === `${hit.id}:box`)!,
            whisker = frame.commands.find((command) => command.id === `${hit.id}:lower-whisker`)!.primitive;
        assert.equal(boxCommand.primitive.kind, 'rect');
        assert.equal(whisker.kind, 'line');
        if (boxCommand.primitive.kind !== 'rect' || whisker.kind !== 'line') return;
        const box = boxCommand.primitive.box, center = { x: (whisker.x1 + whisker.x2) / 2, y: (whisker.y1 + whisker.y2) / 2 };
        close(horizontal ? box.width : box.height, (horizontal ? hit.clip.width : hit.clip.height) * 5 / 20);
        assert.equal(hitTest(frame, center.x, center.y, 0)?.id, hit.id);
        const empty = horizontal ? { x: center.x, y: box.y + 3 } : { x: box.x + 3, y: center.y };
        assert.equal(hitTest(frame, empty.x, empty.y, 0), undefined);
        assert.equal(hitsInBox(frame, { ...empty, width: 1, height: 1 }).length, 0);
        assert.equal(hitsInBox(frame, { ...center, width: 1, height: 1 }).length, 1);
    });
}

test('complete series ordinals produce separate colored boxplots within one category', async () => {
    const frame = await scene(plan({ channels: { color: { fieldRef: 'series' } } }),
        [...summary('a', [-5, -2, 1, 3, 5], { series: 'a' }), ...summary('b', [-4, -1, 2, 4, 6], { series: 'b' })]);
    assert.equal(frame.hits.length, 2);
    const boxes = frame.hits.map((hit) => frame.commands.find((command) => command.id === `${hit.id}:box`)!.primitive);
    assert.ok(boxes.every((primitive) => primitive.kind === 'rect'));
    if (boxes[0].kind !== 'rect' || boxes[1].kind !== 'rect') return;
    assert.ok(boxes[0].box.x + boxes[0].box.width < boxes[1].box.x);
    assert.notEqual(boxes[0].fill, boxes[1].fill);
    assert.notEqual(frame.hits[0].seriesKey, frame.hits[1].seriesKey);
});

test('zero IQR keeps a median line and one selectable summary target', async () => {
    const frame = await scene(plan(), summary('flat', [2, 2, 2, 2, 2])), hit = frame.hits[0],
        median = frame.commands.find((command) => command.id === `${hit.id}:median`)!.primitive;
    assert.equal(frame.hits.length, 1);
    assert.equal(median.kind, 'line');
    if (median.kind !== 'line') return;
    assert.equal(hitTest(frame, (median.x1 + median.x2) / 2, median.y1, 0)?.id, hit.id);
    assert.ok(hit.box.height > 0);
});

test('boxplots use complete pane-scoped domains', async () => {
    const p = plan({
        bindings: [...plan().bindings, binding('facet', true)], rows: { facets: ['facet'], positions: ['value'] },
        scales: { value: { scope: { mode: 'pane' } } },
    }), frame = await scene(p, [...summary('a', [0, 2, 5, 8, 10], { facet: 'A' }), ...summary('b', [100, 120, 150, 180, 200], { facet: 'B' })]);
    assert.equal(frame.hits.length, 2);
    const boxes = frame.hits.map((hit) => frame.commands.find((command) => command.id === `${hit.id}:box`)!.primitive);
    if (boxes[0].kind !== 'rect' || boxes[1].kind !== 'rect') throw new Error('Expected box bodies');
    close(boxes[0].box.height, boxes[1].box.height);
    close(boxes[0].box.y - frame.hits[0].clip.y, boxes[1].box.y - frame.hits[1].clip.y);
});

test('multiple measure slots ignore null values belonging to the other statistic group', async () => {
    const p = plan({ bindings: [...plan().bindings, binding('other')], rows: { facets: [], positions: ['value', 'other'] },
        scales: { value: { domain: [-10, 10] }, other: { domain: [0, 200] } } });
    const a = summary('a', [-5, -2, 1, 3, 5], { other: null }),
        b = summary('b', [100, 120, 140, 160, 180]).map((record) => ({ ...record, other: record.value, value: null })),
        frame = await scene(p, [...a, ...b]);
    assert.equal(frame.hits.length, 2);
    assert.deepEqual(frame.hits.map((hit) => hit.datumKeys), [a.map((record) => record.id), b.map((record) => record.id)]);
    assert.notEqual(frame.hits[0].slotId, frame.hits[1].slotId);
});

test('group selection recolors every component identically with and without cached geometry', async () => {
    const f = await input(plan({ scales: { value: { zero: true } } }), [...summary('a'), outlier('a', 'raw', 8)]),
        entries = new Map<string, CachedPaneGeometry>(),
        cache = createSceneCache({
            get: (key) => entries.get(key), put: (key, value) => { entries.set(key, value); return true; },
            remove: (key) => { entries.delete(key); }, measure: (value) => JSON.stringify(value).length * 2,
        });
    const first = buildScene({ ...f, cache }), id = first.hits[0].id, selected = new Set([id]),
        plain = buildScene({ ...f, selected }), cached = buildScene({ ...f, cache, selected });
    assert.deepEqual(normalized(cached.commands), normalized(plain.commands));
    assert.deepEqual(normalized(cached.hits), normalized(plain.hits));
    const commands = cached.commands.filter((command) => command.interactionId === id);
    assert.equal(commands.length, 10);
    assert.ok(commands.every(({ primitive }) => primitive.kind === 'line' ? primitive.stroke === '#ea580c' : primitive.kind === 'rect' && primitive.fill === '#ea580c'));
    assert.equal(cached.paneLayer!.groups[0].selectedIds.length, 10);
    assert.equal(first.paneLayer!.groups[0].commands, cached.paneLayer!.groups[0].commands);
    assert.notEqual(cached.commands.find((command) => command.id === cached.hits[1].id)!.primitive.kind === 'circle' &&
        (cached.commands.find((command) => command.id === cached.hits[1].id)!.primitive as { fill: string }).fill, '#ea580c');
    cache.clear();
});

test('zero opacity hides summary and outlier marks', async () => {
    const frame = await scene(plan({ style: { opacity: 0 } }), [...summary('a'), outlier('a', 'raw', 8)]);
    assert.equal(frame.hits.length, 0);
    assert.equal(frame.commands.filter((command) => command.interactionId).length, 0);
});

test('missing, duplicate, unordered and mixed-category statistics fail instead of drawing a partial boxplot', async () => {
    const stats = summary('a');
    await assert.rejects(scene(plan(), stats.slice(1)), /incomplete|five prepared statistics/);
    await assert.rejects(scene(plan(), [...stats, { ...stats[0], id: 'duplicate' }]), /duplicate/);
    await assert.rejects(scene(plan(), summary('a', [-5, 2, 1, 3, 5])), /lower|ordered/);
    await assert.rejects(scene(plan(), stats.map((record, index) => index ? record : { ...record, category: 'B' })), /category|categories/);
});

test('small-sample prepared whiskers may end inside interpolated quartiles', async () => {
    // External Type 7 statistics for [1, 2, 3, 100]: Q3 is 27.25 while the last non-outlier is 3.
    const stats = summary('small', [1, 1.75, 2.5, 27.25, 3]), raw = outlier('small', 'actual-100', 100),
        frame = await scene(plan({ scales: { value: { domain: [0, 110] } } }), [...stats, raw]),
        hit = frame.hits[0], upper = frame.commands.find((command) => command.id === `${hit.id}:upper-whisker`)!.primitive;
    assert.equal(frame.hits.length, 2);
    assert.deepEqual(hit.recordValues, stats);
    assert.equal(hit.label, 'value: lower=1, Q1=1.75, median=2.5, Q3=27.25, upper=3');
    assert.equal(upper.kind, 'line');
    if (upper.kind !== 'line') return;
    assert.ok(upper.y2 > upper.y1, 'the connector runs from Q3 back into the box to the supplied whisker');
    assert.equal(frame.hits[1].values.value, 100);
    await assert.rejects(scene(plan(), [...summary('bad'), outlier('bad', 'inside', 2)]), /outside|whisker/);
});
