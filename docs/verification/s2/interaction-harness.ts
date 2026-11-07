import { createBenchmarkFixture, adaptBenchmarkFixture } from '../../../packages/worksheet-renderer/bench/fixtures';
import { createPreparedDataSource } from '../../../packages/worksheet-renderer/src/core/prepared';
import { createWorksheet } from '../../../packages/worksheet-renderer/src/runtime/worksheet';
const selector = document.querySelector<HTMLSelectElement>('#backend')!;
const host = document.querySelector<HTMLElement>('#worksheet')!;
const status = document.querySelector<HTMLElement>('#status')!;
const fixture = createBenchmarkFixture('B2');
const plan = adaptBenchmarkFixture(fixture);
const source = createPreparedDataSource({ plan, records: fixture.records, version: { sourceId: 'B2', snapshotId: String(fixture.seed), presentationId: '1' }, getDatumKey: fixture.getDatumKey });
let view: ReturnType<typeof createWorksheet> | undefined;
async function load() {
    view?.dispose();
    view = createWorksheet(host, { plan, source, backend: selector.value as 'canvas' | 'svg' }, { width: 1440, height: 900, dpr: 2, autoResize: false, accessibleName: 'B2 interaction' });
    const receipt = await view.ready;
    const records: Array<{selectionMs:number;presentedMs:number}> = [];
    let start = 0;
    host.addEventListener('pointerdown', () => { start = performance.now(); }, { capture: true, once: false });
    view.on('selectionChange', () => { if (start) { const selectionMs = performance.now() - start; requestAnimationFrame(() => { records.push({ selectionMs, presentedMs: performance.now() - start }); }); } });
    (window as any).interaction = { view, records };
    status.textContent = receipt.status;
}
selector.addEventListener('change', () => { load().catch(e => status.textContent = String(e)); });
load().catch(e => status.textContent = String(e));
