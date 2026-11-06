import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreparedDataSource } from '../src/core/prepared';
import { buildScene, layoutMetrics } from '../src/scene/build';
import { adaptChartToRenderPlan } from '../../graphic-walker/src/lib/native/adapter';
import { createNestedChartFixture } from '../../graphic-walker/src/lib/native/fixtures';

test('positive bars use the zero-inclusive display domain and headers have one slot label', async () => {
    const fixture = createNestedChartFixture();
    const plan = adaptChartToRenderPlan(fixture.chart, { columns: fixture.columns }).plan!;
    const version = { sourceId: 'test', snapshotId: '1', presentationId: '1' };
    const source = createPreparedDataSource({ version, plan, records: fixture.records, getDatumKey: fixture.getDatumKey });
    const signal = new AbortController().signal;
    const [rows, columns, panes, domains] = await Promise.all([
        source.readAxis({ version, axis: 'row', range: { start: 0, end: 2 } }, signal),
        source.readAxis({ version, axis: 'column', range: { start: 0, end: 2 } }, signal),
        source.readPaneData({ version, windows: [{ rows: { start: 0, end: 2 }, columns: { start: 0, end: 2 } }] }, signal),
        source.readDomains({ version, fieldRefs: [...plan.rows.positions, ...plan.columns.positions] }, signal),
    ]);
    const frame = buildScene({ plan, rows, columns, panes, domains, width: 800, height: 540, scrollX: 0, scrollY: 0, frameId: 1 });
    const sales = frame.hits.find((h) => h.values.Sales_sum === 100)!;
    const metrics = layoutMetrics(plan, 800);
    assert.equal(sales.box.x, metrics.headerWidth + 48);
    assert.ok(sales.box.width > 0 && sales.box.width < 180);
    assert.equal(
        frame.commands.filter((c) => c.id.startsWith('cht:') && c.primitive.kind === 'text' && c.primitive.text === 'sum(Sales)').length,
        1,
    );
    assert.equal(frame.commands.filter((c) => c.id.startsWith('slot:')).length, 0);
    assert.ok(frame.hits.every((h) => Object.values(h.box).every(Number.isFinite)));
    const scrolled = buildScene({ plan, rows, columns, panes, domains, width: 800, height: 540, scrollX: 40, scrollY: 30, frameId: 2 });
    const corner = (f: typeof frame) => f.commands.find((c) => c.id === 'corner')!.primitive;
    assert.deepEqual(corner(frame), corner(scrolled));
    assert.ok(scrolled.hits.every((hit) => hit.clip.x >= metrics.headerWidth && hit.clip.y >= metrics.headerHeight));
});

test('external raw band domains use the same fixed override for position, thickness, and color', async () => {
    const fixture = createNestedChartFixture();
    const plan = adaptChartToRenderPlan(fixture.chart, { columns: fixture.columns }).plan!;
    const bandRef = plan.rows.positions[0];
    const version = { sourceId: 'raw-band', snapshotId: '1', presentationId: '1' };
    const source = createPreparedDataSource({ version, plan, records: fixture.records, getDatumKey: fixture.getDatumKey });
    const signal = new AbortController().signal;
    const window = { rows: { start: 0, end: 1 }, columns: { start: 0, end: 1 } };
    const [rows, columns, panes, domains] = await Promise.all([
        source.readAxis({ version, axis: 'row', range: window.rows }, signal),
        source.readAxis({ version, axis: 'column', range: window.columns }, signal),
        source.readPaneData({ version, windows: [window] }, signal),
        source.readDomains({ version, fieldRefs: [...plan.rows.positions, ...plan.columns.positions] }, signal),
    ]);
    const fixedPlan = {
        ...plan,
        channels: { color: { fieldRef: bandRef } },
        scales: { ...plan.scales, [bandRef]: { domain: ['Premium', 'Standard', 'Extra'] } },
    };
    const frame = buildScene({
        plan: fixedPlan,
        rows,
        columns,
        panes,
        domains,
        width: 800,
        height: 540,
        scrollX: 0,
        scrollY: 0,
        frameId: 1,
    });
    const standard = frame.hits.find((hit) => hit.values.Subcategory === 'Standard')!;
    const mark = frame.commands.find((command) => command.id === standard.id)!.primitive;
    assert.equal(mark.kind, 'rect');
    if (mark.kind !== 'rect') throw new Error('Expected a bar');
    assert.equal(mark.fill, '#f97316');
    assert.ok(Math.abs(standard.box.height - (128 / 3) * 0.72) < 1e-9);
    const metrics = layoutMetrics(plan, 800);
    assert.ok(Math.abs(standard.box.y + standard.box.height / 2 - (metrics.headerHeight + 22 + 64)) < 1e-9);
});
