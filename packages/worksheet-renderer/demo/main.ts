import { createWorksheet, createPreparedDataSource, axisLeafKey, headerKey, paneKey, toTypedValue } from '../src';
import type { AxisLeaf, ControlledRequest, HeaderSpan, RenderDataSource, RenderPlan, ReadVersion, WorksheetInput } from '../src';
import { adaptChartToRenderPlan } from '../../graphic-walker/src/lib/native/adapter';
import { createNestedChartFixture } from '../../graphic-walker/src/lib/native/fixtures';
import { createNativeScenario, type NativeScenario } from '../../graphic-walker/src/lib/native/scenarios';
import type { NativeWorksheetLayout } from '../../graphic-walker/src/lib/native/presentation';
import { seriesIdentityFor, seriesKeyFor } from '../src/core/series';
import { createControlledDemo } from './controlled';
const fixture = createNestedChartFixture(),
    adapted = adaptChartToRenderPlan(fixture.chart, { columns: fixture.columns });
if (!adapted.plan) throw new Error(JSON.stringify(adapted.diagnostics));
const plan = adapted.plan;
const normal = createPreparedDataSource({
    version: { sourceId: 'u1', snapshotId: '1', presentationId: '1' },
    plan,
    records: fixture.records,
    getDatumKey: fixture.getDatumKey,
    identityScope: 'stable',
});
let requests = 0;
function hugeSource(plan: RenderPlan): RenderDataSource {
    const version: ReadVersion = { sourceId: 'programmatic-scroll-fixture', snapshotId: '1', presentationId: '1' };
    const rowCount = 1_000_000,
        colCount = 4;
    const makeLeaf = (axis: 'row' | 'column', rank: number): AxisLeaf => {
        const positionRef = axis === 'row' ? plan.rows.positions[0] : plan.columns.positions[rank % 2];
        const path =
            axis === 'row'
                ? [
                      { fieldRef: plan.rows.facets[0], value: toTypedValue(`Group ${Math.floor(rank / 100)}`) },
                      { fieldRef: plan.rows.facets[1], value: toTypedValue(`Item ${rank}`) },
                  ]
                : [{ fieldRef: plan.columns.facets[0], value: toTypedValue(rank < 2 ? '2025' : '2026') }];
        return {
            rank,
            path,
            positionRef,
            slotId: positionRef,
            key: axisLeafKey(axis, path, positionRef),
            ...(plan.bindings.find((b) => b.fieldRef === positionRef)?.positionType === 'band'
                ? { bandDomainId: JSON.stringify(['domain', version, positionRef]) }
                : {}),
        };
    };
    const check = (v: ReadVersion, signal: AbortSignal) => {
        signal.throwIfAborted();
        if (v.sourceId !== version.sourceId || v.snapshotId !== version.snapshotId || v.presentationId !== version.presentationId)
            throw new Error('version-expired');
    };
    return {
        version,
        async describe(signal) {
            signal.throwIfAborted();
            return {
                version,
                domainPlanKey: plan.domainPlanKey,
                rowLeafCount: rowCount,
                columnLeafCount: colCount,
                recordCount: rowCount * 2,
                nonEmptyPaneCount: rowCount * colCount,
                status: 'complete',
                identityScope: 'stable',
                capabilities: {
                    randomAxisAccess: true,
                    locateByKey: true,
                    maxAxisWindow: 1000,
                    maxPaneWindows: 4,
                    domainPlanKeys: [plan.domainPlanKey],
                },
            };
        },
        async readAxis(req, signal) {
            check(req.version, signal);
            requests++;
            const leaves: AxisLeaf[] = [],
                spans = new Map<string, HeaderSpan>();
            for (let rank = req.range.start; rank < req.range.end; rank++) {
                const leaf = makeLeaf(req.axis, rank);
                leaves.push(leaf);
                leaf.path.forEach((_, depth) => {
                    const path = leaf.path.slice(0, depth + 1),
                        value = path[depth].value,
                        label = value.type === 'null' ? '∅' : String('value' in value ? value.value : '');
                    const start = req.axis === 'row' ? (depth === 0 ? Math.floor(rank / 100) * 100 : rank) : Math.floor(rank / 2) * 2;
                    const end = req.axis === 'row' ? (depth === 0 ? Math.min(rowCount, start + 100) : start + 1) : start + 2;
                    const key = headerKey(req.axis, path);
                    spans.set(key, {
                        key,
                        path,
                        depth,
                        start,
                        end,
                        label,
                        ...(depth > 0 ? { parentKey: headerKey(req.axis, path.slice(0, -1)) } : {}),
                    });
                });
                if (req.axis === 'column') {
                    const key = JSON.stringify(['slot-header', leaf.key]);
                    spans.set(key, {
                        key,
                        parentKey: headerKey('column', leaf.path),
                        path: leaf.path,
                        depth: leaf.path.length,
                        start: rank,
                        end: rank + 1,
                        label: plan.bindings.find((b) => b.fieldRef === leaf.positionRef)!.label,
                    });
                }
            }
            return { version, axis: req.axis, range: req.range, leaves, ancestors: [...spans.values()] };
        },
        async readPaneData(req, signal) {
            check(req.version, signal);
            requests++;
            const panes = [];
            for (const window of req.windows)
                for (let r = window.rows.start; r < window.rows.end; r++)
                    for (let c = window.columns.start; c < window.columns.end; c++) {
                        const row = makeLeaf('row', r),
                            column = makeLeaf('column', c);
                        const values = {
                            Region: `Group ${Math.floor(r / 100)}`,
                            Category: `Item ${r}`,
                            Subcategory: r % 2 ? 'Premium' : 'Standard',
                            Year: c < 2 ? '2025' : '2026',
                            Sales_sum: 100 + (r % 90),
                            Profit_sum: r % 3 === 0 ? -30 : 40,
                        };
                        panes.push({
                            key: paneKey(row.key, column.key),
                            rowKey: row.key,
                            columnKey: column.key,
                            rowRank: r,
                            columnRank: c,
                            rowSlotId: row.slotId,
                            columnSlotId: column.slotId,
                            rowPath: row.path,
                            columnPath: column.path,
                            complete: true,
                            seriesCount: 1,
                            records: [{ datumKey: `record:${r}:${Math.floor(c / 2)}`, ordinal: r, values,
                                seriesKey: seriesKeyFor(paneKey(row.key, column.key), seriesIdentityFor(plan, values)), seriesOrdinal: 0 }],
                        });
                    }
            return { version, panes, coveredWindows: req.windows };
        },
        async readDomains(req, signal) {
            check(req.version, signal);
            const result = await normal.readDomains({ ...req, version: normal.version }, signal);
            return {
                ...result,
                version,
                ...(result.series ? { series: { ...result.series, domainId: JSON.stringify(['series-domain', version, plan.domainPlanKey]) } } : {}),
                domains: Object.fromEntries(
                    Object.entries(result.domains).map(([ref, domain]) => {
                        const column = plan.bindings.find((b) => b.fieldRef === ref)!.columnKey;
                        return [
                            ref,
                            {
                                ...domain,
                                domainId: JSON.stringify(['domain', version, ref]),
                                values: column === 'Sales_sum' ? [100, 189] : column === 'Profit_sum' ? [-30, 40] : domain.values,
                            },
                        ];
                    }),
                ),
            };
        },
        async locate(req, signal) {
            check(req.version, signal);
            if (req.axis === 'column') {
                for (let i = 0; i < 4; i++) {
                    const leaf = makeLeaf('column', i);
                    if (leaf.key === req.key) return { version, status: 'found', rank: i, leaf };
                }
            } else {
                try {
                    const parsed = JSON.parse(req.key);
                    const value = parsed[2][1][1][1];
                    const rank = Number(String(value).replace('Item ', ''));
                    if (Number.isInteger(rank) && rank >= 0 && rank < rowCount) {
                        const leaf = makeLeaf('row', rank);
                        if (leaf.key === req.key) return { version, status: 'found', rank, leaf };
                    }
                } catch {}
            }
            return { version, status: 'missing' };
        },
    };
}
const huge = hugeSource(plan),
    backend = document.querySelector<HTMLSelectElement>('#backend')!,
    example = document.querySelector<HTMLSelectElement>('#example')!;
const view = createWorksheet(document.querySelector<HTMLElement>('#chart')!, { plan, source: normal });
const scope = document.querySelector<HTMLSelectElement>('#scope')!;
const controlled = createControlledDemo();
let active: WorksheetInput = { plan, source: normal };
function chooseScenario() {
    scope.disabled = example.value !== 'scope';
    document.querySelector<HTMLElement>('#controlled-status')!.hidden = example.value !== 'controlled';
    if (example.value === 'controlled') {
        active = controlled.getInput();
        document.querySelector('#description')!.textContent = controlled.description;
        document.querySelector('#controlled-status')!.textContent = 'Host ready. Collapse or sort a header to send a request; confirmation takes 550 ms.';
        return;
    }
    if (example.value === 'nested' || example.value === 'huge') {
        active = { plan, source: example.value === 'huge' ? huge : normal };
        document.querySelector('#description')!.textContent = example.value === 'huge'
            ? 'This random-access source supplies real records for requested windows across one million logical rows.'
            : createNativeScenario('nested').description;
        return;
    }
    const selected = createNativeScenario(example.value as NativeScenario);
    if (example.value === 'scope') {
        const layout = selected.chart.layout as typeof selected.chart.layout & NativeWorksheetLayout;
        layout.worksheet = { ...layout.worksheet, scaleScopes: { y: scope.value === 'prefix'
            ? { mode: 'prefix', rowDepth: 1, columnDepth: 0 } : { mode: scope.value as 'shared' | 'pane' } } };
    }
    const adapted = adaptChartToRenderPlan(selected.chart, { columns: selected.columns, ...selected.presentation, records: selected.records });
    if (!adapted.plan) throw new Error(adapted.diagnostics.map((diagnostic) => `${diagnostic.configRef}: ${diagnostic.message}`).join('\n'));
    active = { plan: adapted.plan, source: createPreparedDataSource({
        version: { sourceId: `scenario:${example.value}`, snapshotId: '1', presentationId: `scope:${scope.value}` },
        plan: adapted.plan, records: selected.records, getDatumKey: selected.getDatumKey,
    }) };
    document.querySelector('#description')!.textContent = selected.description;
}
function report() {
    const s = view.getViewState();
    document.querySelector('#selection')!.textContent = s.selectedTargets.length
        ? JSON.stringify(s.selectedTargets.map((x) => x.values))
        : s.pendingSelection.length
          ? 'Selection awaiting current data.'
          : 'Select a bar to inspect its prepared values.';
    document.querySelector('#summary')!.textContent =
        `${s.manifest?.rowLeafCount.toLocaleString() ?? '…'} row positions × ${s.manifest?.columnLeafCount ?? '…'} columns · ${s.frame?.hits.length ?? 0} visible marks · offset ${Math.round(s.scrollX)}, ${Math.round(s.scrollY)} · ${s.cacheWindows} cached windows`;
}
view.on('ready', report);
view.on('viewStateChange', report);
view.on('loadStateChange', report);
view.on('diagnostic', (e) => {
    document.querySelector('#error')!.textContent = e.message;
});
view.on('selectionChange', (e) => {
    document.querySelector('#selection')!.textContent = e.targets.length ? JSON.stringify(e.targets.map((x) => x.values)) : 'No selection.';
});
view.on('requestStateChange', (event) => {
    if (example.value !== 'controlled') return;
    document.querySelector('#controlled-status')!.textContent = `${event.requestId}: ${event.status}${event.reason ? ` · ${event.reason}` : ''}`;
});
const acceptControlledRequest = async (request: ControlledRequest) => {
    if (example.value !== 'controlled') {
        view.rejectRequest(request.requestId, 'Choose the controlled headers example to change the host presentation.');
        return;
    }
    const previous = active;
    try {
        const acknowledged = await controlled.accept(request, () => example.value === 'controlled' && active === previous
            && view.getViewState().requests.some((pending) => pending.requestId === request.requestId));
        if (!acknowledged) return;
        active = controlled.getInput();
        document.querySelector('#error')!.textContent = '';
        await view.update({ ...acknowledged, backend: backend.value as 'canvas' | 'svg' });
        report();
    } catch (error) { document.querySelector('#error')!.textContent = String(error); }
};
view.on('collapseRequest', acceptControlledRequest);
view.on('sortRequest', acceptControlledRequest);
const update = async () => {
    document.querySelector('#error')!.textContent = '';
    await view.update({ ...active, backend: backend.value as 'canvas' | 'svg' });
    report();
};
backend.addEventListener('change', update);
const changeExample = async () => {
    try { chooseScenario(); await update(); view.scrollToPosition({ x: 0, y: 0 }); }
    catch (error) { document.querySelector('#error')!.textContent = String(error); }
};
example.addEventListener('change', changeExample);
scope.addEventListener('change', changeExample);
document.querySelector('#first')!.addEventListener('click', () => view.scrollToPosition({ x: 0, y: 0 }));
document
    .querySelector('#last')!
    .addEventListener('click', () => view.scrollToPosition({ x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER }));
document.querySelector('#export')!.addEventListener('click', async () => {
    try {
        const svg = await view.export({ format: 'svg' }),
            url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })),
            a = document.createElement('a');
        a.href = url;
        a.download = 'worksheet.svg';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
        document.querySelector('#error')!.textContent = String(e);
    }
});
(window as any).worksheetDemo = { view, plan, normal, huge, controlled, getRequests: () => requests,
    getCurrent: () => active,
    setExample: async (name: string) => { example.value = name; await changeExample(); },
    setScope: async (name: string) => { scope.value = name; await changeExample(); },
};
chooseScenario();
void view.ready.then(report);
