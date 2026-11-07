import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreparedDataSource } from '../src/core/prepared';
import { domainRequestForWindow } from '../src/core/domains';
import type { PreparedRecord, RenderPlan, ResultBinding } from '../src/core/types';
import { buildScene } from '../src/scene/build';
import { hitTest, hitsInBox } from '../src/scene/hit';
import type { HitRegion, Point, SceneFrame } from '../src/scene/types';

const binding = (fieldRef: string, type: 'band' | 'linear' = 'linear'): ResultBinding => ({
    fieldRef, bindingId: fieldRef, columnKey: fieldRef, valueType: type === 'band' ? 'string' : 'number',
    positionType: type, analyticType: type === 'band' ? 'dimension' : 'measure', label: fieldRef,
});
const plan = (mark: RenderPlan['mark'], overrides: Partial<RenderPlan> = {}): RenderPlan => ({
    bindings: [binding('x'), binding('y'), binding('series', 'band'), binding('size')],
    rows: { facets: [], positions: ['y'] }, columns: { facets: [], positions: ['x'] },
    mark, stack: 'none', domainPlanKey: 'extended',
    scales: { x: { domain: [0, 10] }, y: { domain: [0, 10] } },
    ...overrides,
});
async function scene(p: RenderPlan, records: readonly PreparedRecord[], explicitOrder = false): Promise<SceneFrame> {
    const version = { sourceId: 'extended', snapshotId: '1', presentationId: '1' },
        source = createPreparedDataSource({
            version, plan: p, records, getDatumKey: (record) => String(record.id),
            getSequenceOrder: explicitOrder ? (record) => Number(record.order) : undefined,
        }),
        signal = new AbortController().signal,
        manifest = await source.describe(signal),
        window = { rows: { start: 0, end: manifest.rowLeafCount }, columns: { start: 0, end: manifest.columnLeafCount } };
    const [rows, columns, panes] = await Promise.all([
        source.readAxis({ version, axis: 'row', range: window.rows }, signal),
        source.readAxis({ version, axis: 'column', range: window.columns }, signal),
        source.readPaneData({ version, windows: [window] }, signal),
    ]);
    const domains = await source.readDomains(domainRequestForWindow(p, version, rows.leaves, columns.leaves), signal);
    return buildScene({ plan: p, rows, columns, panes, domains, width: 900, height: 600, scrollX: 0, scrollY: 0, frameId: 1 });
}
const polygon = (hit: HitRegion): readonly Point[] => {
    assert.equal(hit.geometry?.kind, 'polygon');
    if (hit.geometry?.kind !== 'polygon') throw new Error('Expected polygon');
    return hit.geometry.points;
};
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

// These use the complete source/scene path so scale domains and series identity participate in the assertions.
test('circle always paints circular geometry with area-scaled size', async () => {
    const frame = await scene(plan('circle', { channels: { size: { value: Math.PI * 25 } } }), [{ id: 'a', x: 5, y: 5 }]);
    const hit = frame.hits[0];
    assert.equal(hit.geometry?.kind, 'circle');
    assert.equal(frame.commands.find((command) => command.id === hit.id)?.primitive.kind, 'circle');
    close(hit.box.width, 10);
    assert.equal(hitTest(frame, hit.box.x + 0.1, hit.box.y + 0.1, 0), undefined);
    assert.equal(hitTest(frame, hit.box.x + 5, hit.box.y + 5, 0)?.id, hit.id);
});

test('tick length and thickness are independent for single x/y and two-axis positions', async () => {
    const records = [{ id: 'a', x: 5, y: 5 }],
        style = { tickSize: 24, tickThickness: 3 };
    const xOnly = await scene(plan('tick', { rows: { facets: [], positions: [] }, style }), records),
        yOnly = await scene(plan('tick', { columns: { facets: [], positions: [] }, style }), records),
        both = await scene(plan('tick', { style }), records);
    assert.deepEqual([xOnly.hits[0].box.width, xOnly.hits[0].box.height], [3, 24]);
    assert.deepEqual([yOnly.hits[0].box.width, yOnly.hits[0].box.height], [24, 3]);
    assert.deepEqual([both.hits[0].box.width, both.hits[0].box.height], [3, 24]);
    const band = await scene(plan('tick', {
        bindings: [binding('x', 'band'), binding('y')],
        scales: { y: { domain: [0, 10] } }, channels: { size: { value: 30 } }, style: { lineWidth: 2 },
    }), [{ id: 'a', x: 'A', y: 5 }]);
    assert.deepEqual([band.hits[0].box.width, band.hits[0].box.height], [30, 2]);
    const hidden = await scene(plan('tick', { channels: { size: { value: 0 } } }), records);
    assert.equal(hidden.hits.length, 0);
});

test('tick size legend uses the same field mapping as its rendered length', async () => {
    const frame = await scene(plan('tick', { channels: { size: { fieldRef: 'size' } }, scales: {
        x: { domain: [0, 10] }, y: { domain: [0, 10] }, size: { domain: [0, 10], range: [4, 24] },
    } }), [{ id: 'a', x: 4, y: 4, size: 0 }, { id: 'b', x: 6, y: 6, size: 10 }]);
    assert.deepEqual(frame.hits.map((hit) => hit.box.height), [4, 24]);
    const samples = frame.commands.filter((command) => command.id.startsWith('legend-swatch:size:'));
    assert.deepEqual(samples.map(({ primitive }) => primitive.kind === 'rect' ? primitive.box.width : null), [4, 14, 24]);
});

test('area sorts progression, fills to zero, and exposes both endpoint records for picking', async () => {
    const a = { id: 'a', x: 2, y: 2 }, b = { id: 'b', x: 8, y: 8 },
        frame = await scene(plan('area'), [b, a]),
        hit = frame.hits[0], points = polygon(hit);
    assert.deepEqual(hit.datumKeys, ['a', 'b']);
    assert.deepEqual(hit.recordValues, [a, b]);
    assert.equal(hit.kind, 'segment');
    close(points[0].x, points[3].x);
    close(points[1].x, points[2].x);
    close(points[2].y, points[3].y);
    const inside = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[3].y) / 2 };
    assert.equal(hitTest(frame, inside.x, inside.y, 0)?.id, hit.id);
    assert.equal(hitTest(frame, points[0].x + 1, points[1].y + 1, 0), undefined);
    assert.equal(hitsInBox(frame, { x: inside.x, y: inside.y, width: 1, height: 1 }).length, 1);
});

test('area supports horizontal progression and keeps clipped-through segments', async () => {
    const frame = await scene(plan('area', { lineProgression: 'y' }), [{ id: 'a', x: 2, y: -10 }, { id: 'b', x: 8, y: 20 }]),
        hit = frame.hits[0], points = polygon(hit);
    close(points[2].x, points[3].x);
    assert.ok(hit.box.y < hit.clip.y);
    assert.ok(hit.box.y + hit.box.height > hit.clip.y + hit.clip.height);
    const y = hit.clip.y + hit.clip.height / 2, x = (points[2].x + (points[0].x + points[1].x) / 2) / 2;
    assert.equal(hitTest(frame, x, y, 0)?.id, hit.id);
});

for (const mark of ['area', 'trail'] as const) {
    test(`${mark} keeps series separate and breaks at null positions and values`, async () => {
        const frame = await scene(plan(mark, { channels: { color: { fieldRef: 'series' } } }), [
            { id: 'a1', x: 1, y: 1, series: 'a' }, { id: 'b1', x: 1, y: 2, series: 'b' },
            { id: 'a2', x: 2, y: 2, series: 'a' }, { id: 'b2', x: 2, y: 3, series: 'b' },
            { id: 'an', x: null, y: 3, series: 'a' }, { id: 'a3', x: 3, y: 3, series: 'a' },
            { id: 'a4', x: 4, y: null, series: 'a' }, { id: 'a5', x: 5, y: 5, series: 'a' },
        ]);
        assert.deepEqual(frame.hits.map((hit) => hit.datumKeys), [['a1', 'a2'], ['b1', 'b2']]);
        assert.notEqual(frame.hits[0].seriesKey, frame.hits[1].seriesKey);
    });
    test(`${mark} honors explicit sequence order and stable endpoint IDs`, async () => {
        const records = [{ id: 'a', x: 2, y: 2, order: 2 }, { id: 'b', x: 8, y: 8, order: 1 }, { id: 'c', x: 5, y: 3, order: 3 }];
        const frame = await scene(plan(mark), records, true), again = await scene(plan(mark), [...records].reverse(), true);
        assert.deepEqual(frame.hits.map((hit) => hit.datumKeys), [['b', 'a'], ['a', 'c']]);
        assert.deepEqual(frame.hits.map((hit) => hit.id), again.hits.map((hit) => hit.id));
    });
}

test('area retains zero-valued segments as accessible geometry', async () => {
    const frame = await scene(plan('area'), [{ id: 'a', x: 2, y: 0 }, { id: 'b', x: 8, y: 0 }]), hit = frame.hits[0];
    assert.equal(hit.box.height, 0);
    assert.deepEqual(hit.datumKeys, ['a', 'b']);
    assert.equal(hitTest(frame, hit.box.x + hit.box.width / 2, hit.box.y - 0.5)?.id, hit.id);
});

test('trail interpolates endpoint widths with filled polygon picking and brush geometry', async () => {
    const frame = await scene(plan('trail', { channels: { size: { fieldRef: 'size' } }, scales: {
        x: { domain: [0, 10] }, y: { domain: [0, 10] }, size: { domain: [0, 1], range: [2, 20] },
    } }), [{ id: 'a', x: 1, y: 5, size: 0 }, { id: 'b', x: 9, y: 5, size: 1 }]),
        hit = frame.hits[0], points = polygon(hit), centerY = (points[0].y + points[3].y) / 2;
    close(Math.abs(points[0].y - points[3].y), 2);
    close(Math.abs(points[1].y - points[2].y), 20);
    const x = points[0].x + (points[1].x - points[0].x) * 0.1;
    assert.equal(hitTest(frame, x, centerY, 0)?.id, hit.id);
    assert.equal(hitTest(frame, x, centerY + 8, 0), undefined);
    assert.equal(hitsInBox(frame, { x, y: centerY + 7, width: 1, height: 1 }).length, 0);
    assert.equal(frame.commands.find((command) => command.id === hit.id)?.primitive.kind, 'path');
});

test('trail cross-sections meet at turns and zero width produces a tapered endpoint', async () => {
    const frame = await scene(plan('trail', { channels: { size: { fieldRef: 'size' } }, scales: {
        x: { domain: [0, 10] }, y: { domain: [0, 10] }, size: { domain: [0, 1], range: [0, 20] },
    } }), [{ id: 'a', x: 2, y: 2, size: 0 }, { id: 'b', x: 5, y: 8, size: 1 }, { id: 'c', x: 8, y: 2, size: 0.5 }]);
    const a = polygon(frame.hits[0]), b = polygon(frame.hits[1]);
    assert.deepEqual(a[0], a[3]);
    assert.deepEqual(a[1], b[0]);
    assert.deepEqual(a[2], b[3]);
    assert.deepEqual(frame.hits.map((hit) => hit.datumKeys), [['a', 'b'], ['b', 'c']]);
});

test('rect size encodes area within its cell while an omitted size fills the cell', async () => {
    const base = plan('rect', { bindings: [binding('x', 'band'), binding('y', 'band')], scales: {} }),
        records = [{ id: 'a', x: 'A', y: 'B' }],
        full = await scene(base, records), sized = await scene({ ...base, channels: { size: { value: 100 } } }, records),
        hidden = await scene({ ...base, channels: { size: { value: 0 } } }, records),
        cell = full.hits[0].box, mark = sized.hits[0].box;
    close(mark.width * mark.height, 100);
    close(mark.width / mark.height, cell.width / cell.height);
    close(mark.x + mark.width / 2, cell.x + cell.width / 2);
    assert.equal(hidden.hits.length, 0);
});

test('text renders at continuous positions and size maps to font pixels with matching legend', async () => {
    const p = plan('text', { channels: { text: { value: 'Label' }, size: { fieldRef: 'size' } }, scales: {
        x: { domain: [0, 10] }, y: { domain: [0, 10] }, size: { domain: [0, 1], range: [10, 20] },
    } }), frame = await scene(p, [{ id: 'a', x: 3, y: 4, size: 0 }, { id: 'b', x: 6, y: 6, size: 1 }]);
    const marks = frame.hits.map((hit) => frame.commands.find((command) => command.id === hit.id)!.primitive);
    assert.deepEqual(marks.map((mark) => mark.kind === 'text' ? [mark.text, mark.size] : null), [['Label', 10], ['Label', 20]]);
    assert.deepEqual(frame.commands.filter((command) => command.id.startsWith('legend-swatch:size:')).map(({ primitive }) => primitive.kind === 'text' ? primitive.size : null), [10, 15, 20]);
});

for (const mode of ['zero', 'normalize', 'center'] as const) {
    test(`area ${mode} uses complete stack endpoints and preserves the original values`, async () => {
        const records = [
            { id: 'a1', x: 2, y: 2, series: 'a' }, { id: 'a2', x: 8, y: 4, series: 'a' },
            { id: 'b1', x: 2, y: 2, series: 'b' }, { id: 'b2', x: 8, y: 8, series: 'b' },
        ], maximum = mode === 'normalize' ? 1 : 12;
        const frame = await scene(plan('area', {
            stack: mode, channels: { color: { fieldRef: 'series' } },
            scales: { x: { domain: [0, 10] }, y: { domain: [0, maximum] } },
        }), records), a = polygon(frame.hits[0]), b = polygon(frame.hits[1]), clip = frame.hits[0].clip;
        const pixel = (value: number) => clip.y + clip.height * (1 - value / maximum);
        close(a[0].y, b[3].y);
        close(a[1].y, b[2].y);
        if (mode === 'zero') {
            close(a[3].y, pixel(0)); close(a[2].y, pixel(0));
            close(b[0].y, pixel(4)); close(b[1].y, pixel(12));
        } else if (mode === 'normalize') {
            close(a[0].y, pixel(0.5)); close(a[1].y, pixel(1 / 3));
            close(b[0].y, pixel(1)); close(b[1].y, pixel(1));
        } else {
            close(a[3].y, pixel(4)); close(a[2].y, pixel(0));
            close(b[0].y, pixel(8)); close(b[1].y, pixel(12));
        }
        assert.deepEqual(frame.hits[0].recordValues, records.slice(0, 2));
        assert.deepEqual(frame.hits[1].recordValues, records.slice(2));
    });
}

test('area draws both sides of a baseline crossing with exact polygon hits', async () => {
    const frame = await scene(plan('area', { scales: { x: { domain: [0, 10] }, y: { domain: [-5, 5] } } }),
        [{ id: 'a', x: 1, y: 4 }, { id: 'b', x: 9, y: -4 }]), hit = frame.hits[0], p = polygon(hit),
        x1 = p[0].x + (p[1].x - p[0].x) * 0.2, x2 = p[0].x + (p[1].x - p[0].x) * 0.8,
        above = p[3].y + (p[0].y - p[3].y) * 0.25, below = p[3].y + (p[1].y - p[3].y) * 0.25;
    assert.equal(hitTest(frame, x1, above, 0)?.id, hit.id);
    assert.equal(hitTest(frame, x2, below, 0)?.id, hit.id);
    assert.equal(hitTest(frame, x1, below, 0), undefined);
    assert.equal(hitTest(frame, x2, above, 0), undefined);
});

test('trail retains a segment whose endpoints are outside the viewport', async () => {
    const frame = await scene(plan('trail', { channels: { size: { value: 10 } } }),
        [{ id: 'a', x: -10, y: 5 }, { id: 'b', x: 20, y: 5 }]), hit = frame.hits[0];
    assert.ok(hit.box.x < hit.clip.x);
    assert.ok(hit.box.x + hit.box.width > hit.clip.x + hit.clip.width);
    assert.equal(hitTest(frame, hit.clip.x + hit.clip.width / 2, hit.box.y + 5, 0)?.id, hit.id);
});
