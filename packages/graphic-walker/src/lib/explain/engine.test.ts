import type { IDataQueryPayload, IRow } from '../../interfaces';
import { explainMarkAll, explainMark } from './engine';
import type { IExplainContext, IExplainer } from './types';

const CTX = { allFields: [], viewDimensions: [], viewMeasures: [], viewFilters: [], selectedMark: {} } as unknown as IExplainContext;

const PAYLOAD_A: IDataQueryPayload = { workflow: [{ type: 'view', query: [{ op: 'raw', fields: ['a'] }] }] };
// structurally identical to A but constructed separately (different key order paths)
const PAYLOAD_A_CLONE: IDataQueryPayload = JSON.parse(JSON.stringify(PAYLOAD_A));
const PAYLOAD_B: IDataQueryPayload = { workflow: [{ type: 'view', query: [{ op: 'raw', fields: ['b'] }] }] };

function makeExplainer(type: string, payloads: IDataQueryPayload[], opts?: { applicable?: boolean; analyzeDelay?: number; throwOnAnalyze?: boolean }): IExplainer {
    return {
        type: type as IExplainer['type'],
        isApplicable: () => ({ applicable: opts?.applicable ?? true, reason: 'test.reason' }),
        plan: () => payloads,
        analyze: (_ctx, results) => {
            if (opts?.throwOnAnalyze) throw new Error('analyze boom');
            return results.map((rows, i) => ({
                type: type as IExplainer['type'],
                score: rows.length + i,
                strength: 'weak' as const,
                field: { fid: 'f', name: 'f', analyticType: 'dimension', semanticType: 'nominal' } as never,
                descriptionKey: 'test',
                descriptionParams: {},
                evidence: {},
            }));
        },
    };
}

describe('explain engine', () => {
    it('dedupes structurally identical payloads across explainers', async () => {
        const calls: IDataQueryPayload[] = [];
        const computation = async (payload: IDataQueryPayload): Promise<IRow[]> => {
            calls.push(payload);
            return [{ x: 1 }];
        };
        const e1 = makeExplainer('unique-mark', [PAYLOAD_A, PAYLOAD_B]);
        const e2 = makeExplainer('contributing-dimension', [PAYLOAD_A_CLONE]);
        const results = await explainMarkAll(CTX, computation, [e1, e2]);
        expect(calls).toHaveLength(2); // A executed once, B once
        expect(results.every((r) => r.status === 'ok')).toBe(true);
    });

    it('respects the concurrency cap', async () => {
        let active = 0;
        let maxActive = 0;
        const computation = async (): Promise<IRow[]> => {
            active++;
            maxActive = Math.max(maxActive, active);
            await new Promise((r) => setTimeout(r, 10));
            active--;
            return [];
        };
        const payloads = Array.from({ length: 8 }, (_, i) => ({
            workflow: [{ type: 'view' as const, query: [{ op: 'raw' as const, fields: [`f${i}`] }] }],
        }));
        const explainer = makeExplainer('unique-mark', payloads);
        await explainMarkAll(CTX, computation, [explainer], { concurrency: 2 });
        expect(maxActive).toBeLessThanOrEqual(2);
    });

    it('yields skipped results for inapplicable explainers without querying', async () => {
        const computation = jest.fn(async (): Promise<IRow[]> => []);
        const explainer = makeExplainer('extreme-value', [PAYLOAD_A], { applicable: false });
        const results = await explainMarkAll(CTX, computation, [explainer]);
        expect(results[0].status).toBe('skipped');
        expect(results[0].reason).toBe('test.reason');
        expect(computation).not.toHaveBeenCalled();
    });

    it('isolates explainer errors: one failure does not poison the rest', async () => {
        const computation = async (): Promise<IRow[]> => [{ x: 1 }];
        const bad = makeExplainer('extreme-value', [PAYLOAD_A], { throwOnAnalyze: true });
        const good = makeExplainer('unique-mark', [PAYLOAD_B]);
        const results = await explainMarkAll(CTX, computation, [bad, good]);
        const byType = Object.fromEntries(results.map((r) => [r.explainer, r]));
        expect(byType['extreme-value'].status).toBe('error');
        expect(byType['extreme-value'].reason).toContain('analyze boom');
        expect(byType['unique-mark'].status).toBe('ok');
        expect(byType['unique-mark'].explanations).toHaveLength(1);
    });

    it('streams results in completion order, not registration order', async () => {
        const computation = async (payload: IDataQueryPayload): Promise<IRow[]> => {
            const isSlow = JSON.stringify(payload).includes('slow');
            await new Promise((r) => setTimeout(r, isSlow ? 50 : 5));
            return [];
        };
        const slow = makeExplainer('contributing-measure', [{ workflow: [{ type: 'view', query: [{ op: 'raw', fields: ['slow'] }] }] }]);
        const fast = makeExplainer('unique-mark', [{ workflow: [{ type: 'view', query: [{ op: 'raw', fields: ['fast'] }] }] }]);
        const order: string[] = [];
        for await (const result of explainMark(CTX, computation, [slow, fast])) {
            order.push(result.explainer);
        }
        expect(order).toEqual(['unique-mark', 'contributing-measure']);
    });
});
