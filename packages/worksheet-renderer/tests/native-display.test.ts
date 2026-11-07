import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreparedDataSource, typedValueKey, type ControlledRequest, type WorksheetEvents } from '@kanaries/worksheet-renderer';
import { createNestedChartFixture } from '../../graphic-walker/src/lib/native/fixtures';
import { adaptChartToRenderPlan } from '../../graphic-walker/src/lib/native/adapter';
import { nativeTheme } from '../../graphic-walker/src/lib/native/theme';
import { emptyNativeDisplayState, orderNativeDomains, prepareNativeDisplay, updateNativeDisplay } from '../../graphic-walker/src/lib/native/viewState';
import { mapNativeSelection } from '../../graphic-walker/src/lib/native/events';
import { createNativeExportApi, waitForNativeChart } from '../../graphic-walker/src/utils/nativeApiExport';
const version = { sourceId: 'display', snapshotId: '1', presentationId: '1' },
    signal = () => new AbortController().signal;
function fixture() {
    const f = createNestedChartFixture(),
        adapted = adaptChartToRenderPlan(f.chart, { columns: f.columns });
    assert(adapted.plan);
    return { ...f, ...adapted, plan: adapted.plan };
}

test('native static theme projects current auto mark, dark chrome and named colors without losing explicit layout precedence', () => {
    const f = fixture();
    f.chart.config.geoms = ['auto'];
    const result = nativeTheme(
        f.chart,
        {
            bar: { color: '#123456', opacity: 0.5 },
            point: { color: '#abcdef' },
            axis: { format: ',.2f', grid: true, tickCount: 5 },
            range: { category: { scheme: 'tableau10' } },
        } as any,
        'dark',
    );
    assert.equal(result.theme.style!.color, '#123456');
    assert.equal(result.theme.style!.background, '#111827');
    assert.equal(result.theme.style!.foreground, '#e5e7eb');
    assert.equal(result.theme.axes!.row!.format, ',.2f');
    assert.equal(result.theme.axes!.column!.tickCount, 5);
    assert.equal(result.theme.scales!.color!.range!.length, 10);
    f.chart.layout.primaryColor = '#fedcba';
    const plan = adaptChartToRenderPlan(f.chart, {
        columns: f.columns,
        theme: result.theme,
    }).plan!;
    assert.equal(plan.style!.color, '#fedcba');
    assert(
        nativeTheme(f.chart, {
            bar: { color: { signal: 'x' } },
        } as any).diagnostics.some((item) => item.severity === 'error'),
    );
    assert(nativeTheme(f.chart, { axis: { labels: false } } as any).diagnostics.some((item) => item.configRef?.endsWith('labels')));
    const shared = nativeTheme(f.chart, {
        axis: { labelColor: '#111111' },
        axisX: { labelColor: '#222222' },
        axisY: { labelColor: '#333333' },
        bar: { size: 20 },
    } as any);
    assert.equal(shared.theme.style!.foreground, '#111111');
    assert.deepEqual(shared.diagnostics.map((item) => item.configRef).sort(), [
        'vegaConfig.axisX.labelColor',
        'vegaConfig.axisY.labelColor',
        'vegaConfig.bar.size',
    ]);
});

test('member sorting uses typed prepared values and collapsed parents remain empty without aggregating children', async () => {
    const f = fixture(),
        leafRef = f.plan.rows.facets[0],
        regionBinding = f.plan.bindings.find((binding) => binding.fieldRef === leafRef)!;
    assert(f.plan.rows.facets.length >= 2);
    const collapsedValue = f.records[0][regionBinding.columnKey],
        path = [
            {
                fieldRef: leafRef,
                value: { type: 'string' as const, value: String(collapsedValue) },
            },
        ];
    const request: ControlledRequest = {
        requestId: 'collapse',
        basePresentationId: '1',
        kind: 'collapse',
        target: { axis: 'row', key: 'header', path, fieldRef: leafRef },
        intent: { expanded: false },
    };
    const changed = updateNativeDisplay(emptyNativeDisplayState, request, f.plan);
    assert(changed.state);
    assert.equal(updateNativeDisplay(emptyNativeDisplayState, request, f.plan, true).state, undefined);
    const display = prepareNativeDisplay(f.plan, f.records, changed.state, f.fieldRefs);
    const source = createPreparedDataSource({
        plan: display.plan,
        records: f.records,
        version,
        getDatumKey: f.getDatumKey,
        ...display,
    });
    const manifest = await source.describe(signal()),
        rows = await source.readAxis({ version, axis: 'row', range: { start: 0, end: manifest.rowLeafCount } }, signal());
    const parents = rows.leaves.filter((leaf) => leaf.path.length === 1 && typedValueKey(leaf.path[0].value) === typedValueKey(path[0].value));
    assert(parents.length > 0);
    const panes = await source.readPaneData(
        {
            version,
            windows: [
                {
                    rows: { start: 0, end: manifest.rowLeafCount },
                    columns: { start: 0, end: manifest.columnLeafCount },
                },
            ],
        },
        signal(),
    );
    assert(parents.every((parent) => !panes.panes.some((pane) => pane.rowRank === parent.rank)));
    assert(display.diagnostics.some((item) => item.code === 'empty-parent-display'));
    const sorted = updateNativeDisplay(changed.state, { ...request, kind: 'sort', intent: { direction: 'descending' } }, f.plan).state!;
    const order = prepareNativeDisplay(f.plan, f.records, sorted, f.fieldRefs).memberOrder.find((order) => order.axis === 'row' && !order.parent.length)!;
    assert.deepEqual(
        order.values.map(typedValueKey),
        [...order.values].sort((a, b) => String((b as any).value).localeCompare(String((a as any).value))).map(typedValueKey),
    );
    f.fieldRefs.get(leafRef)!.field.sort = 'descending';
    assert(
        prepareNativeDisplay(f.plan, f.records, emptyNativeDisplayState, f.fieldRefs).diagnostics.some(
            (item) => item.code === 'unsupported-sort' && item.fieldRef === leafRef,
        ),
    );
});

test('band domains have explicit ascending display order, while a supplied fixed order is preserved', async () => {
    const f = fixture(),
        source = orderNativeDomains(
            createPreparedDataSource({
                plan: f.plan,
                records: [...f.records].reverse(),
                version,
                getDatumKey: f.getDatumKey,
            }),
            f.plan,
        );
    const domains = await source.readDomains({ version, fieldRefs: f.plan.rows.positions }, signal());
    for (const domain of Object.values(domains.domains))
        if (domain.type === 'band')
            assert.deepEqual(
                domain.values,
                [...domain.values].sort((a: any, b: any) => String(a.value).localeCompare(String(b.value))),
            );
    const ref = f.plan.rows.positions[0],
        domain = ['Standard', 'Premium'];
    const fixedPlan = { ...f.plan, scales: { ...f.plan.scales, [ref]: { domain } } };
    const fixedSource = orderNativeDomains(createPreparedDataSource({ plan: fixedPlan, records: f.records, version, getDatumKey: f.getDatumKey }), fixedPlan);
    assert.deepEqual((await fixedSource.readDomains({ version, fieldRefs: [ref] }, signal())).domains[ref].values, domain);
    f.fieldRefs.get(ref)!.field.sort = 'descending';
    assert(
        prepareNativeDisplay(fixedPlan, f.records, emptyNativeDisplayState, f.fieldRefs).diagnostics.some(
            (item) => item.code === 'unsupported-sort' && item.message.includes('two orders'),
        ),
    );
});

test('chart-list readiness waits for the requested chart index and removes subscriptions on failure or timeout', async () => {
    const listeners = new Set<() => void>();
    const context: any = {
        chartIndex: 0,
        renderStatus: 'idle',
        onRenderStatusChange(callback: () => void) {
            listeners.add(callback);
            return () => listeners.delete(callback);
        },
    };
    let done = false;
    const waiting = waitForNativeChart(context, 1, () => true).then(() => {
        done = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    assert.equal(done, false);
    context.chartIndex = 1;
    context.renderStatus = 'rendering';
    for (const callback of listeners) callback();
    assert.equal(done, false);
    context.renderStatus = 'idle';
    for (const callback of listeners) callback();
    await waiting;
    assert.equal(listeners.size, 0);
    context.renderStatus = 'error';
    await assert.rejects(
        waitForNativeChart(context, 1, () => true),
        /failed/,
    );
    assert.equal(listeners.size, 0);
    context.renderStatus = 'rendering';
    await assert.rejects(
        waitForNativeChart(context, 1, () => true, 1),
        /Timed out/,
    );
    assert.equal(listeners.size, 0);
});

test('native selection preserves paired targets and raw line endpoints; only a matched simple pointer click carries coordinates', () => {
    const f = fixture(),
        refs = [...f.fieldRefs.keys()].slice(0, 2),
        target = (id: string, raw: string) => ({
            kind: 'datum' as const,
            markId: id,
            paneKey: id,
            slotId: 'slot',
            datumKeys: [id],
            values: refs.map((fieldRef) => ({
                fieldRef,
                value: 1,
                raw,
                datumKey: id,
            })),
        });
    const event: WorksheetEvents['selectionChange'] = {
        version,
        frameId: 1,
        inputRevision: 1,
        operation: 'replace',
        source: 'pointer',
        targets: [target('East/Chair', 'East'), target('West/Paper', 'West')],
    };
    const paired = mapNativeSelection(event, f.fieldRefs, {
        clientX: 10,
        clientY: 20,
    });
    assert.equal(paired.targets.length, 2);
    assert.equal(paired.interaction, undefined);
    assert.equal(paired.targets[1].values[0].raw, 'West');
    const line = {
        ...target('a', 'original A'),
        kind: 'segment' as const,
        datumKeys: ['a', 'b'],
        values: [...target('a', 'original A').values, ...target('b', 'original B').values],
    };
    const selected = mapNativeSelection({ ...event, targets: [line] }, f.fieldRefs, { clientX: 10, clientY: 20 });
    assert.deepEqual(
        selected.targets[0].endpoints.map((endpoint) => endpoint.values[0].raw),
        ['original A', 'original B'],
    );
    assert.equal(selected.interaction!.clientX, 10);
    assert(selected.targets[0].values.every((value) => value.configRef.startsWith('encodings.')));
    for (const source of ['keyboard', 'input'] as const)
        assert.equal(
            mapNativeSelection({ ...event, source, targets: [line] }, f.fieldRefs, {
                clientX: 1,
                clientY: 2,
            }).interaction,
            undefined,
        );
    for (const operation of ['clear', 'toggle', 'add'] as const)
        assert.equal(mapNativeSelection({ ...event, operation, targets: [line] }, f.fieldRefs, { clientX: 1, clientY: 2 }).interaction, undefined);
});

test('legacy native exports are single complete viewport arrays, reject stale input and cancel a pending ready task on dispose', async () => {
    let generation = 1,
        blocked: string | undefined,
        calls = 0;
    const controller: any = {
        async exportViewport({ format }: { format: string }) {
            calls++;
            return {
                content: format === 'svg' ? '<svg/>' : 'data:image/png;base64,YQ==',
                metadata: { width: 500, height: 300, dpr: 2 },
            };
        },
    };
    const container: any = {
        isConnected: true,
        querySelector() {
            return null;
        },
    };
    const api = createNativeExportApi(() => ({
        controller,
        generation,
        ready: Promise.resolve(),
        blocked,
        container,
        name: 'Chart',
    }));
    assert.deepEqual(await api.handle.getSVGData(), ['<svg/>']);
    assert.deepEqual(await api.handle.getCanvasData(), ['data:image/png;base64,YQ==']);
    const exported = await api.exportChart('svg');
    assert.equal(exported.chartType, 'native');
    assert.equal(exported.nRows, 1);
    assert.equal(exported.nCols, 1);
    assert.equal(exported.charts.length, 1);
    assert.equal(exported.combinedData, '<svg/>');
    blocked = 'stale query';
    await assert.rejects(api.handle.getSVGData(), /stale query/);
    assert.equal(calls, 3);
    blocked = undefined;
    const stale = api.handle.getSVGData();
    generation++;
    await assert.rejects(stale, /version-expired/);
    api.dispose();
    const pending = createNativeExportApi(() => ({
        controller,
        generation,
        ready: new Promise(() => {}),
        container,
        name: 'Chart',
    }));
    const waiting = pending.handle.getSVGData();
    pending.dispose();
    await assert.rejects(waiting, { name: 'AbortError' });
});
