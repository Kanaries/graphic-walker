import { compile } from 'vega-lite';
import type { IRow, IViewField } from '../../interfaces';
import { getTestComputation } from './testUtils';
import { explainMarkAll } from './engine';
import { defaultExplainers } from './index';
import type { IExplainContext } from './types';

/**
 * Every evidence chartSpec produced over the golden dataset must compile as
 * valid vega-lite — schema mistakes (band widths, condition syntax, layered
 * encodings) otherwise surface only as silent runtime warnings in the UI.
 */

const field = (fid: string, analyticType: 'dimension' | 'measure', semanticType: 'nominal' | 'quantitative', aggName?: string): IViewField =>
    ({ fid, name: fid, analyticType, semanticType, aggName } as unknown as IViewField);

function makeDataset(): IRow[] {
    const rows: IRow[] = [];
    for (let m = 0; m < 12; m++) {
        const onlineShare = 0.2 + 0.05 * m;
        for (let i = 0; i < 30; i++) {
            const online = i < 30 * onlineShare;
            const sales = m === 11 && i === 0 ? 10000 : 40 + (online ? 60 : 0) + (i % 5);
            rows.push({
                month: `M${String(m + 1).padStart(2, '0')}`,
                channel: online ? 'online' : 'offline',
                age: 21 + (i % 40),
                sales,
                traffic: 2 * sales + (i % 3),
            });
        }
    }
    return rows;
}

it('all evidence chart specs over the golden dataset compile as valid vega-lite', async () => {
    const ctx: IExplainContext = {
        allFields: [
            field('month', 'dimension', 'nominal'),
            field('channel', 'dimension', 'nominal'),
            field('age', 'dimension', 'quantitative'),
            field('sales', 'measure', 'quantitative', 'mean'),
            field('traffic', 'measure', 'quantitative', 'sum'),
        ],
        viewDimensions: [field('month', 'dimension', 'nominal')],
        viewMeasures: [field('sales', 'measure', 'quantitative', 'mean')],
        viewFilters: [],
        selectedMark: { month: 'M12' },
    };
    const results = await explainMarkAll(ctx, getTestComputation(makeDataset()), defaultExplainers);
    const specs = results.flatMap((r) => r.explanations.map((e) => e.evidence.chartSpec)).filter(Boolean);
    // the planted dataset must exercise all three spec builders
    // (histogram, scatter, bullet composition)
    expect(specs.length).toBeGreaterThanOrEqual(3);
    const warnings: string[] = [];
    for (const spec of specs) {
        const compiled = compile(spec as never, {
            logger: {
                level: () => 0,
                warn: (...args: unknown[]) => warnings.push(args.join(' ')),
                info: () => undefined,
                debug: () => undefined,
                error: (...args: unknown[]) => {
                    throw new Error(`vega-lite error: ${args.join(' ')}`);
                },
            } as never,
        });
        expect(compiled.spec).toBeDefined();
    }
    expect(warnings).toEqual([]);
});
