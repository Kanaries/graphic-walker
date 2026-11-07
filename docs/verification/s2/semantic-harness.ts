import { createB1Fixtures } from '../../../packages/worksheet-renderer/bench/fixtures';
import { adaptChartToRenderPlan } from '../../../packages/graphic-walker/src/lib/native/adapter';
import { createPreparedDataSource } from '../../../packages/worksheet-renderer/src/core/prepared';
import { createWorksheet } from '../../../packages/worksheet-renderer/src/runtime/worksheet';

const fixtures = createB1Fixtures();
const selector = document.querySelector<HTMLSelectElement>('#fixture')!;
const backend = document.querySelector<HTMLSelectElement>('#backend')!;
const host = document.querySelector<HTMLElement>('#worksheet')!;
const status = document.querySelector<HTMLElement>('#status')!;
for (const f of fixtures) { const o = document.createElement('option'); o.value = f.id; o.textContent = f.id; selector.appendChild(o); }
let view: ReturnType<typeof createWorksheet> | undefined;
async function load() {
    view?.dispose();
    const fixture = fixtures.find(f => f.id === selector.value)!;
    const adapted = adaptChartToRenderPlan(fixture.chart, { columns: fixture.columns, theme: { style: { fontFamily: 'Arial, sans-serif', fontSize: 11, pointSize: 9 } } });
    if (!adapted.plan) throw new Error(JSON.stringify(adapted.diagnostics));
    const plan = { ...adapted.plan, layout: { rowHeight: 120, columnWidth: 220, rowHeaderWidth: 520, columnHeaderHeight: 560, headerLabelMode: 'path' as const } };
    const source = createPreparedDataSource({ plan, records: fixture.records, version: { sourceId: fixture.id, snapshotId: '1', presentationId: '1' }, getDatumKey: fixture.getDatumKey });
    view = createWorksheet(host, { plan, source, backend: backend.value as 'canvas' | 'svg' }, { width: 1440, height: 900, dpr: 2, autoResize: false, accessibleName: fixture.id });
    const receipt = await view.ready;
    status.textContent = `${fixture.id}: ${receipt.status}`;
    (window as any).semantic = { view, plan, source, fixture };
}
for (const e of [selector, backend]) e.addEventListener('change', () => { load().catch(e => status.textContent = String(e)); });
load().catch(e => status.textContent = String(e));
