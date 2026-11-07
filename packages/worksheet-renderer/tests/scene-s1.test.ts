import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreparedDataSource } from '../src/core/prepared';
import { domainRequestForWindow } from '../src/core/domains';
import type { RenderPlan, PreparedRecord, ResultBinding } from '../src/core/types';
import { buildScene } from '../src/scene/build';
import { hitTest, hitsInBox, headerAt } from '../src/scene/hit';
import { validateFormat, formatValue, fitText } from '../src/scene/text';
import { resolveDomainValues } from '../src/scene/scales';

const binding = (
    fieldRef: string,
    type: 'band' | 'linear' | 'time' = 'linear',
    role: 'dimension' | 'measure' = 'measure',
): ResultBinding => ({
    fieldRef,
    bindingId: fieldRef,
    columnKey: fieldRef,
    valueType: type === 'band' ? 'string' : type === 'time' ? 'time' : 'number',
    positionType: type,
    analyticType: role,
    label: fieldRef,
});
const plan = (mark: RenderPlan['mark'], overrides: Partial<RenderPlan> = {}): RenderPlan => ({
    bindings: [binding('x', 'band', 'dimension'), binding('y'), binding('series', 'band', 'dimension')],
    rows: { facets: [], positions: ['y'] },
    columns: { facets: [], positions: ['x'] },
    domainPlanKey: 's1',
    mark,
    stack: 'none',
    ...overrides,
});
async function scene(
    p: RenderPlan,
    records: readonly PreparedRecord[],
    options: { scrollX?: number; scrollY?: number; focusId?: string; brush?: { x: number; y: number; width: number; height: number } } = {},
) {
    const version = { sourceId: 's1', snapshotId: '1', presentationId: '1' },
        source = createPreparedDataSource({ version, plan: p, records, getDatumKey: (r) => String(r.id) }),
        signal = new AbortController().signal,
        manifest = await source.describe(signal);
    const [rows, columns, panes] = await Promise.all([
        source.readAxis({ version, axis: 'row', range: { start: 0, end: manifest.rowLeafCount } }, signal),
        source.readAxis({ version, axis: 'column', range: { start: 0, end: manifest.columnLeafCount } }, signal),
        source.readPaneData(
            {
                version,
                windows: [{ rows: { start: 0, end: manifest.rowLeafCount }, columns: { start: 0, end: manifest.columnLeafCount } }],
            },
            signal,
        ),
    ]);
    const domains = await source.readDomains(domainRequestForWindow(p, version, rows.leaves, columns.leaves), signal);
    return buildScene({ plan: p, rows, columns, panes, domains, width: 900, height: 600, scrollX: 0, scrollY: 0, frameId: 1, ...options });
}

test('line groups stay in their pane/series and null progression or value breaks the path', async () => {
    const p = plan('line', { channels: { color: { fieldRef: 'series' } } });
    const records = [
        { id: 'a1', x: 'A', y: 1, series: 'a' },
        { id: 'b1', x: 'A', y: 10, series: 'b' },
        { id: 'a2', x: 'B', y: 2, series: 'a' },
        { id: 'b2', x: 'B', y: 20, series: 'b' },
        { id: 'an', x: null, y: 3, series: 'a' },
        { id: 'a3', x: 'C', y: 3, series: 'a' },
        { id: 'a4', x: 'D', y: null, series: 'a' },
        { id: 'a5', x: 'E', y: 5, series: 'a' },
    ];
    const frame = await scene(p, records),
        segments = frame.hits.filter((hit) => hit.kind === 'segment');
    assert.equal(segments.length, 2);
    assert.deepEqual(
        segments.map((hit) => hit.datumKeys),
        [
            ['a1', 'a2'],
            ['b1', 'b2'],
        ],
    );
    assert.notEqual(segments[0].seriesKey, segments[1].seriesKey);
});
test('line sequenceOrder is explicit, zero/null points are preserved as separators, and varying width fails', async () => {
    const p = plan('line', { channels: { size: { fieldRef: 'y' } } });
    await assert.rejects(
        scene(p, [
            { id: '1', x: 'A', y: 1, series: 'a' },
            { id: '2', x: 'B', y: 2, series: 'a' },
        ]),
        /constant within a series/,
    );
    const q = plan('line', {
        bindings: [binding('x', 'linear', 'dimension'), binding('y')],
        scales: { x: { domain: [0, 10] }, y: { domain: [0, 10] } },
    });
    const frame = await scene(q, [
        { id: 'a', x: -10, y: 5 },
        { id: 'b', x: 20, y: 5 },
    ]);
    const segment = frame.hits[0];
    assert.equal(segment.kind, 'segment');
    assert.ok(segment.geometry?.kind === 'segment');
    const center = { x: segment.clip.x + segment.clip.width / 2, y: segment.box.y + segment.box.height / 2 };
    assert.equal(hitTest(frame, center.x, center.y)?.id, segment.id);
    assert.equal(hitTest(frame, center.x, center.y + 20), undefined);
    assert.equal(hitsInBox(frame, { x: center.x - 2, y: center.y - 2, width: 4, height: 4 }).length, 1);
    assert.equal(hitsInBox(frame, { x: center.x - 2, y: center.y + 20, width: 4, height: 4 }).length, 0);
});
test('grouped bars use full series slots and stacked bars keep positive and negative endpoints', async () => {
    const records = [
        { id: 'a', x: 'X', y: 2, series: 'a' },
        { id: 'b', x: 'X', y: 3, series: 'b' },
        { id: 'c', x: 'X', y: -4, series: 'c' },
    ];
    const grouped = await scene(plan('bar', { channels: { color: { fieldRef: 'series' } }, barLayout: 'grouped' }), records);
    assert.equal(grouped.hits.length, 3);
    assert.ok(grouped.hits[0].box.x + grouped.hits[0].box.width < grouped.hits[1].box.x);
    const stacked = await scene(
        plan('bar', { channels: { color: { fieldRef: 'series' } }, stack: 'zero', scales: { y: { zero: true } } }),
        records,
    );
    const a = stacked.hits.find((hit) => hit.datumKey === 'a')!,
        b = stacked.hits.find((hit) => hit.datumKey === 'b')!,
        c = stacked.hits.find((hit) => hit.datumKey === 'c')!;
    assert.ok(Math.abs(a.box.y - (b.box.y + b.box.height)) < 1e-9);
    assert.ok(Math.abs(c.box.y - (a.box.y + a.box.height)) < 1e-9);
});
test('continuous and interval bars retain continuous position width and zero marks remain accessible', async () => {
    const q = plan('bar', {
        bindings: [binding('x', 'time', 'dimension'), binding('y')],
        scales: { x: { domain: [0, 1000] }, y: { zero: true } },
        style: { barWidth: 12 },
    });
    const frame = await scene(q, [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 500, y: 5 },
    ]);
    assert.equal(frame.hits[0].box.height, 0);
    assert.equal(frame.hits[1].box.width, 12);
    assert.ok(Math.abs(frame.hits[1].box.x - frame.hits[0].box.x - 90) < 1e-9);
    const interval = plan('bar', {
        bindings: [{ ...binding('x', 'linear', 'dimension'), valueType: 'interval' }, binding('y')],
        scales: { x: { domain: [0, 10] }, y: { zero: true } },
    });
    const intervals = await scene(interval, [
        { id: 'a', x: [0, 2], y: 5 },
        { id: 'b', x: [2, 8], y: 3 },
    ]);
    assert.ok(Math.abs(intervals.hits[0].box.width - 36) < 1e-9);
    assert.ok(Math.abs(intervals.hits[1].box.width - 108) < 1e-9);
});
test('point circle and diamond hit geometry rejects bounding-box corners and shapes honor area', async () => {
    const p = plan('point', { channels: { shape: { value: 'diamond' }, size: { value: 200 } } });
    const frame = await scene(p, [{ id: 'a', x: 'A', y: 4, series: 'a' }]),
        hit = frame.hits[0];
    assert.equal(hit.geometry?.kind, 'polygon');
    assert.equal(hitTest(frame, hit.box.x + 0.1, hit.box.y + 0.1, 0), undefined);
    assert.equal(hitTest(frame, hit.box.x + hit.box.width / 2, hit.box.y + hit.box.height / 2, 0)?.id, hit.id);
    assert.equal(hitsInBox(frame, { x: hit.box.x, y: hit.box.y, width: 1, height: 1 }).length, 0);
    assert.equal(hitsInBox(frame, { x: hit.box.x + 8, y: hit.box.y + 8, width: 4, height: 4 }).length, 1);
});
test('rect and text use band cells, retain duplicates and display supplied formatted values', async () => {
    const base = {
        bindings: [binding('x', 'band', 'dimension'), binding('y', 'band', 'dimension'), binding('label')],
        rows: { facets: [], positions: ['y'] },
        columns: { facets: [], positions: ['x'] },
    };
    const records = [
        { id: 'a', x: 'A', y: 'B', label: 1234.56 },
        { id: 'b', x: 'A', y: 'B', label: null },
    ];
    const rect = await scene(plan('rect', base), records);
    assert.equal(rect.hits.length, 2);
    assert.deepEqual(rect.hits[0].box, rect.hits[1].box);
    const text = await scene(
        plan('text', { ...base, channels: { text: { fieldRef: 'label' } }, axes: { label: { format: ',.1f' } } }),
        records,
    );
    const marks = text.commands.filter((command) => command.id === text.hits[0].id || command.id === text.hits[1].id);
    assert.deepEqual(
        marks.map((command) => (command.primitive.kind === 'text' ? command.primitive.text : null)),
        ['1,234.6', ''],
    );
});
test('axis settings, fixed-domain nice precedence, headers, focus and brush are shared scene commands', async () => {
    const p = plan('point', {
        bindings: [binding('group', 'band', 'dimension'), binding('x', 'band', 'dimension'), binding('y')],
        rows: { facets: ['group'], positions: ['y'] },
        axes: { y: { format: '.0%', title: 'Share', grid: true, tickCount: 4 } },
    });
    const frame = await scene(p, [{ id: 'a', group: '中文标签很长', x: 'A', y: 0.5 }]);
    assert.equal(frame.commands.filter((command) => command.id.startsWith('grid:y:')).length, 4);
    assert.ok(frame.commands.some((command) => command.primitive.kind === 'text' && command.primitive.text.includes('Share')));
    const header = frame.headers[0];
    assert.equal(headerAt(frame, header.clip.x + 2, header.clip.y + 2)?.key, header.key);
    const selected = await scene(p, [{ id: 'a', group: '中文标签很长', x: 'A', y: 0.5 }], {
        focusId: frame.hits[0].id,
        brush: { x: 200, y: 100, width: 20, height: 30 },
    });
    assert.ok(selected.commands.some((command) => command.id === 'focus-ring'));
    assert.ok(selected.commands.some((command) => command.id === 'selection-brush'));
    const domain = {
        fieldRef: 'y',
        domainId: 'y',
        type: 'linear' as const,
        values: [1.1, 9.8],
        complete: true,
        empty: false,
        extentKind: 'value' as const,
        source: 'prepared' as const,
    };
    assert.deepEqual(resolveDomainValues(domain, { nice: true }), [0, 10]);
    assert.deepEqual(resolveDomainValues(domain, { nice: true, domain: [1.1, 9.8] }), [1.1, 9.8]);
});
test('format subset and text fitting preserve explicit unsupported diagnostics', () => {
    assert.equal(formatValue(1234.567, 'linear', ',.2f'), '1,234.57');
    assert.equal(formatValue(0.42, 'linear', '.0%'), '42%');
    assert.equal(formatValue(1200, 'linear', '.2~s'), '1.2k');
    assert.equal(formatValue(Date.UTC(2025, 1, 3), 'time', '%b %Y'), 'Feb 2025');
    assert.equal(formatValue(null, 'linear', '.0f'), '');
    assert.throws(() => validateFormat('labelExpr(datum.x)'), /unsupported/);
    assert.throws(() => validateFormat('%Q', 'time'), /unsupported/);
    assert.ok(fitText('中文标签很长', 30).endsWith('…'));
    assert.equal(fitText('🙂🙂🙂', 1), '');
});

test('round line caps and box selection use the same circular endpoint geometry', () => {
    const hit = {
        id: 'line',
        paneKey: 'p',
        datumKey: 'a',
        values: {},
        box: { x: 5, y: 5, width: 20, height: 10 },
        clip: { x: 0, y: 0, width: 100, height: 100 },
        geometry: { kind: 'segment' as const, start: { x: 10, y: 10 }, end: { x: 20, y: 10 }, width: 10 },
    };
    const frame = { frameId: 1, width: 100, height: 100, rowStart: 0, columnStart: 0, commands: [], headers: [], hits: [hit] };
    assert.equal(hitTest(frame, 24, 10, 0)?.id, 'line');
    assert.equal(hitTest(frame, 24, 14, 0), undefined);
    assert.equal(hitsInBox(frame, { x: 24, y: 14, width: 0.1, height: 0.1 }).length, 0);
    assert.equal(hitsInBox(frame, { x: 24, y: 9, width: 0.1, height: 0.1 }).length, 1);
});

test('continuous color, area, opacity, shapes and their fixed legends agree', async () => {
    const p = plan('point', {
        bindings: [binding('x', 'band', 'dimension'), binding('y'), binding('c'), binding('area'), binding('alpha')],
        channels: { color: { fieldRef: 'c' }, size: { fieldRef: 'area' }, opacity: { fieldRef: 'alpha' }, shape: { value: 'triangle-up' } },
        scales: {
            c: { domain: [0, 1], range: ['blue', 'red'] },
            area: { domain: [0, 1], range: [16, 256] },
            alpha: { domain: [0, 1], range: [0, 1] },
        },
    });
    const frame = await scene(p, [{ id: 'a', x: 'A', y: 1, c: 0.25, area: 0.25, alpha: 0.5 }]);
    const mark = frame.commands.find((command) => command.id === frame.hits[0].id)!;
    assert.equal(mark.primitive.kind, 'path');
    if (mark.primitive.kind !== 'path') throw new Error('Expected triangle');
    assert.equal(mark.primitive.fill, 'rgb(64,0,191)');
    assert.equal(mark.primitive.opacity, 0.5);
    assert.equal(frame.commands.filter((command) => command.id.startsWith('legend-gradient:color')).length, 24);
    assert.equal(frame.commands.filter((command) => command.id.startsWith('legend-swatch:size')).length, 3);
    assert.equal(frame.commands.filter((command) => command.id.startsWith('legend-swatch:opacity')).length, 3);
});

test('pane position domains map each pane from its complete local extent', async () => {
    const p = plan('point', {
        bindings: [binding('group', 'band', 'dimension'), binding('x', 'band', 'dimension'), binding('y')],
        rows: { facets: ['group'], positions: ['y'] },
        scales: { y: { scope: { mode: 'pane' } } },
    });
    const frame = await scene(p, [
        { id: 'lo1', group: 'Low', x: 'A', y: 1 },
        { id: 'lo2', group: 'Low', x: 'B', y: 2 },
        { id: 'hi1', group: 'High', x: 'A', y: 100 },
        { id: 'hi2', group: 'High', x: 'B', y: 200 },
    ]);
    const low = frame.hits.find((hit) => hit.datumKey === 'lo1')!,
        high = frame.hits.find((hit) => hit.datumKey === 'hi1')!;
    assert.ok(Math.abs(high.box.y - low.box.y - 180) < 1e-9);
});

test('explicit formatting handles SI rounding, omitted type and currency signs using d3 semantics', () => {
    assert.equal(formatValue(999.5, 'linear', '.3s'), '1.00k');
    assert.equal(formatValue(-3.5, 'linear', '$.2f'), '−$3.50');
    assert.equal(formatValue(123.45, 'linear', '.2'), '1.2e+2');
    assert.equal(formatValue(1.2, 'linear', 'f'), '1.200000');
});
