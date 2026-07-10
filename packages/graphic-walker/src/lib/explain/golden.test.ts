import type { IRow, IViewField } from '../../interfaces';
import { getTestComputation as getComputation } from './testUtils';
import { explainMarkAll } from './engine';
import { extremeValueExplainer } from './explainers/extremeValue';
import { uniqueMarkExplainer } from './explainers/uniqueMark';
import type { IExplainContext } from './types';

/**
 * Golden-standard end-to-end tests: synthetic datasets with PLANTED signals,
 * executed through the real workflow-DSL client computation
 * (plan → dataQueryClient → analyze). The noise-control suite asserts zero
 * output on clean data — thresholds must not be relaxed to make signals pass.
 */

const field = (fid: string, analyticType: 'dimension' | 'measure', semanticType: 'nominal' | 'quantitative', aggName?: string): IViewField =>
    ({ fid, name: fid, analyticType, semanticType, aggName } as unknown as IViewField);

const REGION = field('region', 'dimension', 'nominal');
const CHANNEL = field('channel', 'dimension', 'nominal');
const NOISE_DIM = field('noise_dim', 'dimension', 'nominal');
const AGE = field('age', 'dimension', 'quantitative');
const SALES = field('sales', 'measure', 'quantitative', 'mean');

const ALL_FIELDS = [REGION, CHANNEL, NOISE_DIM, AGE, SALES];

const REGIONS = ['A', 'B', 'C', 'D'];
const ROWS_PER_REGION = 50;

/**
 * Deterministic dataset, 200 rows.
 * Planted signals (only when `planted` is true):
 *  - region B row #0 has sales = 10000 (extreme value distorting mean)
 *  - region B is 80% online channel; other regions 30% (unique composition)
 * Uniform everywhere (must never trigger):
 *  - noise_dim cycles 5 values identically in every region
 *  - age cycles 21..60 identically in every region
 */
function makeDataset(planted: boolean): IRow[] {
    const rows: IRow[] = [];
    for (const region of REGIONS) {
        for (let i = 0; i < ROWS_PER_REGION; i++) {
            const onlineShare = planted && region === 'B' ? 0.8 : 0.3;
            rows.push({
                region,
                channel: i < ROWS_PER_REGION * onlineShare ? 'online' : 'offline',
                noise_dim: `n${i % 5}`,
                age: 21 + (i % 40),
                sales: planted && region === 'B' && i === 0 ? 10000 : 50 + (i % 20),
            });
        }
    }
    return rows;
}

function makeContext(mark: string): IExplainContext {
    return {
        allFields: ALL_FIELDS,
        viewDimensions: [REGION],
        viewMeasures: [SALES],
        viewFilters: [],
        selectedMark: { region: mark },
    };
}

const EXPLAINERS = [extremeValueExplainer, uniqueMarkExplainer];

describe('golden: planted signals are found', () => {
    const computation = getComputation(makeDataset(true));

    it('extreme value: the 10000-sales record distorting region B mean is detected as strong', async () => {
        const results = await explainMarkAll(makeContext('B'), computation, EXPLAINERS);
        const extreme = results.find((r) => r.explainer === 'extreme-value')!;
        expect(extreme.status).toBe('ok');
        expect(extreme.explanations).toHaveLength(1);
        const ex = extreme.explanations[0];
        expect(ex.strength).toBe('strong');
        expect(ex.evidence.rows?.some((r) => r.sales === 10000)).toBe(true);
        // removing the bad record must restore a plausible mean
        expect(Number(ex.descriptionParams.after)).toBeLessThan(100);
        expect(Number(ex.descriptionParams.before)).toBeGreaterThan(200);
    });

    it('unique mark: region B channel composition (80% vs 30% online) is detected', async () => {
        const results = await explainMarkAll(makeContext('B'), computation, EXPLAINERS);
        const unique = results.find((r) => r.explainer === 'unique-mark')!;
        expect(unique.status).toBe('ok');
        const channelExp = unique.explanations.find((e) => e.field.fid === 'channel');
        expect(channelExp).toBeDefined();
        expect(['strong', 'moderate']).toContain(channelExp!.strength);
    });

    it('uniform fields never appear as explanations (false-positive control)', async () => {
        const results = await explainMarkAll(makeContext('B'), computation, EXPLAINERS);
        const unique = results.find((r) => r.explainer === 'unique-mark')!;
        const fids = unique.explanations.map((e) => e.field.fid);
        expect(fids).not.toContain('noise_dim');
        expect(fids).not.toContain('age');
    });
});

describe('golden: clean data produces zero explanations (noise control)', () => {
    const computation = getComputation(makeDataset(false));

    it.each(REGIONS)('region %s: no explanations of any type', async (region) => {
        const results = await explainMarkAll(makeContext(region), computation, EXPLAINERS);
        for (const result of results) {
            expect(result.status).toBe('ok');
            expect(result.explanations).toHaveLength(0);
        }
    });
});

describe('golden: guardrails', () => {
    it('marks with too few rows produce no unique-mark explanations', async () => {
        // 10 rows per region: below MIN_MARK_ROWS
        const tiny: IRow[] = [];
        for (const region of REGIONS) {
            for (let i = 0; i < 10; i++) {
                tiny.push({ region, channel: region === 'B' ? 'online' : 'offline', noise_dim: `n${i % 5}`, age: 30, sales: 50 + i });
            }
        }
        const results = await explainMarkAll(makeContext('B'), getComputation(tiny), EXPLAINERS);
        const unique = results.find((r) => r.explainer === 'unique-mark')!;
        expect(unique.explanations).toHaveLength(0);
    });

    it('temporal marks skip the extreme-value explainer with a reason', async () => {
        const TEMPORAL_DIM = { ...REGION, fid: 'date', name: 'date', semanticType: 'temporal' } as unknown as IViewField;
        const ctx: IExplainContext = {
            ...makeContext('B'),
            viewDimensions: [TEMPORAL_DIM],
            selectedMark: { date: '2024-01-01' },
        };
        const results = await explainMarkAll(ctx, getComputation(makeDataset(true)), [extremeValueExplainer]);
        expect(results[0].status).toBe('skipped');
        expect(results[0].reason).toBe('explain.skip.temporalMark');
    });
});
