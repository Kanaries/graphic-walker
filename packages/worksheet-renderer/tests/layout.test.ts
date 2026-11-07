import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScene, layoutMetrics } from '../src/scene/build';
import { validateRenderCapabilities } from '../src/core/capabilities';
import { createPreparedDataSource } from '../src/core/prepared';
import type { RenderPlan } from '../src/core/types';

const plan: RenderPlan = {
    bindings: [
        {
            bindingId: 'r',
            fieldRef: 'r',
            columnKey: 'r',
            label: 'Region',
            valueType: 'string',
            positionType: 'band',
        },
        {
            bindingId: 'v',
            fieldRef: 'v',
            columnKey: 'v',
            label: 'Value',
            valueType: 'number',
            positionType: 'linear',
        },
    ],
    rows: { facets: ['r'], positions: ['v'] },
    columns: { facets: [], positions: [] },
    mark: 'point',
    domainPlanKey: 'layout',
    layout: {
        rowHeight: 96,
        columnWidth: 144,
        rowHeaderWidth: 180,
        columnHeaderHeight: 48,
        headerLabelMode: 'path',
    },
};

test('explicit fixed strips survive resize while frozen headers stay inside their viewport budget', () => {
    const wide = layoutMetrics(plan, 1440, 900),
        narrow = layoutMetrics(plan, 120, 90);
    assert.equal(wide.rowHeight, 96);
    assert.equal(wide.columnWidth, 144);
    assert.equal(wide.headerWidth, 180);
    assert.equal(wide.headerHeight, 48);
    assert.equal(narrow.rowHeight, wide.rowHeight);
    assert.equal(narrow.columnWidth, wide.columnWidth);
    assert.ok(narrow.headerWidth <= 120 * 0.35);
    assert.ok(narrow.headerHeight <= 90 * 0.4);
    for (const layout of [{ rowHeight: 0 }, { columnWidth: NaN }, { rowHeight: 63 }, { columnWidth: 16_385 }])
        assert.ok(validateRenderCapabilities({ ...plan, layout }).some((item) => item.code === 'invalid-layout'));
    assert.deepEqual(validateRenderCapabilities(plan), []);
});

test('scene uses fixed export layout and keeps preview gaps distinct from complete emptiness', async () => {
    const version = { sourceId: 'layout', snapshotId: '1', presentationId: '1' };
    const source = createPreparedDataSource({
        plan,
        version,
        records: [{ r: 'East / 亚洲', v: 7 }],
    });
    const signal = new AbortController().signal;
    const [rows, columns, domains] = await Promise.all([
        source.readAxis({ version, axis: 'row', range: { start: 0, end: 1 } }, signal),
        source.readAxis({ version, axis: 'column', range: { start: 0, end: 1 } }, signal),
        source.readDomains({ version, fieldRefs: ['v'] }, signal),
    ]);
    const input = {
        plan,
        rows,
        columns,
        domains,
        width: 600,
        height: 400,
        scrollX: 0,
        scrollY: 0,
        frameId: 1,
        panes: { version, panes: [], coveredWindows: [] },
        metrics: layoutMetrics(plan, 1440, 900),
    };
    const preview = buildScene({ ...input, dataStatus: 'preview' });
    assert.equal(preview.hits.length, 0);
    assert.ok(preview.commands.some((command) => command.primitive.kind === 'text' && command.primitive.text.includes('Preview:')));
    assert.equal(preview.headers[0].box.width, 180);
    assert.equal(preview.headers[0].path[0].fieldRef, 'r');
    const complete = buildScene({
        ...input,
        panes: {
            ...input.panes,
            coveredWindows: [{ rows: rows.range, columns: columns.range }],
        },
    });
    assert.ok(!complete.commands.some((command) => command.id.startsWith('loading:')));
    const supplied = await source.readPaneData({ version, windows: [{ rows: rows.range, columns: columns.range }] }, signal);
    const partialCoverage = buildScene({ ...input, dataStatus: 'loading', panes: { ...supplied, coveredWindows: [] } });
    assert.ok(
        partialCoverage.hits.length > 0,
        'A complete pane proves its own nonempty slot even before the source certifies surrounding empty slots',
    );
    assert.ok(!partialCoverage.commands.some((command) => command.id.startsWith('loading:')));
});
