import type { IRow, IViewField } from '../../interfaces';
import { getTestComputation as getComputation } from './testUtils';
import { explainMarkAll } from './engine';
import { contributingDimExplainer } from './explainers/contributingDim';
import { contributingMeasureExplainer } from './explainers/contributingMeasure';
import type { IExplainContext } from './types';

/**
 * Golden tests for the model-based explainers (B/C class), run through real
 * workflow-DSL execution. 12 marks (months); planted signals:
 *  - `traffic` (hidden measure): row-level 2×sales + jitter → per-mark means
 *    track the target tightly
 *  - `channel` (hidden dimension): online share rises with month, and online
 *    rows sell for +60 → composition predicts the target
 * Noise controls that must NEVER fire:
 *  - `noise_mea`: cycling values, uncorrelated with sales
 *  - `noise_dim`: identical composition in every mark
 */

const field = (fid: string, analyticType: 'dimension' | 'measure', semanticType: 'nominal' | 'quantitative', aggName?: string): IViewField =>
    ({ fid, name: fid, analyticType, semanticType, aggName } as unknown as IViewField);

const MONTH = field('month', 'dimension', 'nominal');
const CHANNEL = field('channel', 'dimension', 'nominal');
const NOISE_DIM = field('noise_dim', 'dimension', 'nominal');
const SALES = field('sales', 'measure', 'quantitative', 'mean');
const TRAFFIC = field('traffic', 'measure', 'quantitative', 'sum');
const NOISE_MEA = field('noise_mea', 'measure', 'quantitative', 'sum');

const ALL_FIELDS = [MONTH, CHANNEL, NOISE_DIM, SALES, TRAFFIC, NOISE_MEA];
const ROWS_PER_MONTH = 30;

function makeDataset(planted: boolean): IRow[] {
    const rows: IRow[] = [];
    for (let m = 0; m < 12; m++) {
        const onlineShare = planted ? 0.2 + 0.05 * m : 0.4;
        for (let i = 0; i < ROWS_PER_MONTH; i++) {
            const online = i < ROWS_PER_MONTH * onlineShare;
            const sales = planted ? 40 + (online ? 60 : 0) + (i % 5) : 50 + (i % 20);
            rows.push({
                month: `M${String(m + 1).padStart(2, '0')}`,
                channel: online ? 'online' : 'offline',
                noise_dim: `n${i % 5}`,
                sales,
                traffic: planted ? 2 * sales + (i % 3) : 17 + ((i * 13 + m * 7) % 23),
                noise_mea: (i * 11 + m * 3) % 19,
            });
        }
    }
    return rows;
}

function makeContext(mark: string): IExplainContext {
    return {
        allFields: ALL_FIELDS,
        viewDimensions: [MONTH],
        viewMeasures: [SALES],
        viewFilters: [],
        selectedMark: { month: mark },
    };
}

const EXPLAINERS = [contributingDimExplainer, contributingMeasureExplainer];

describe('golden: model-based explainers find planted structure', () => {
    const computation = getComputation(makeDataset(true));

    it('contributing measure: hidden `traffic` predicts mean sales across marks', async () => {
        const results = await explainMarkAll(makeContext('M12'), computation, EXPLAINERS);
        const cm = results.find((r) => r.explainer === 'contributing-measure')!;
        expect(cm.status).toBe('ok');
        const traffic = cm.explanations.find((e) => e.field.fid === 'traffic');
        expect(traffic).toBeDefined();
        expect(['strong', 'moderate']).toContain(traffic!.strength);
        // noise measure must not appear
        expect(cm.explanations.map((e) => e.field.fid)).not.toContain('noise_mea');
    });

    it('contributing dimension: hidden `channel` composition predicts mean sales', async () => {
        const results = await explainMarkAll(makeContext('M12'), computation, EXPLAINERS);
        const cd = results.find((r) => r.explainer === 'contributing-dimension')!;
        expect(cd.status).toBe('ok');
        const channel = cd.explanations.find((e) => e.field.fid === 'channel');
        expect(channel).toBeDefined();
        expect(['strong', 'moderate']).toContain(channel!.strength);
        expect(cd.explanations.map((e) => e.field.fid)).not.toContain('noise_dim');
    });

    it('results are deterministic across runs (fixed-seed permutation tests)', async () => {
        const run1 = await explainMarkAll(makeContext('M06'), computation, EXPLAINERS);
        const run2 = await explainMarkAll(makeContext('M06'), computation, EXPLAINERS);
        const scores = (rs: typeof run1) => rs.flatMap((r) => r.explanations.map((e) => [e.field.fid, e.score]));
        expect(scores(run1)).toEqual(scores(run2));
    });
});

describe('golden: clean data produces zero model-based explanations', () => {
    const computation = getComputation(makeDataset(false));

    it.each(['M01', 'M06', 'M12'])('mark %s: nothing fires on structureless data', async (mark) => {
        const results = await explainMarkAll(makeContext(mark), computation, EXPLAINERS);
        for (const result of results) {
            expect(result.status).toBe('ok');
            expect(result.explanations).toHaveLength(0);
        }
    });
});

describe('golden: guardrails for model-based explainers', () => {
    it('too few marks (< 8) → no model explanations', async () => {
        const rows = makeDataset(true).filter((r) => ['M01', 'M02', 'M03', 'M04'].includes(r.month as string));
        const results = await explainMarkAll(makeContext('M01'), getComputation(rows), EXPLAINERS);
        for (const result of results) {
            expect(result.explanations).toHaveLength(0);
        }
    });

    it('non-derivable target aggregation (median) → skipped with reason', async () => {
        const MEDIAN_SALES = { ...SALES, aggName: 'median' } as unknown as IViewField;
        const ctx = { ...makeContext('M12'), viewMeasures: [MEDIAN_SALES] };
        const results = await explainMarkAll(ctx, getComputation(makeDataset(true)), EXPLAINERS);
        for (const result of results) {
            expect(result.status).toBe('skipped');
            expect(result.reason).toBe('explain.skip.noDerivableTarget');
        }
    });
});
