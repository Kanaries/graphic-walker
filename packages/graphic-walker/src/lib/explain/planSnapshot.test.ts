import type { IViewField } from '../../interfaces';
import { contributingDimExplainer, defaultExplainers, uniqueMarkExplainer } from './index';
import type { IExplainContext } from './types';

const field = (fid: string, analyticType: 'dimension' | 'measure', semanticType: 'nominal' | 'quantitative', aggName?: string): IViewField =>
    ({ fid, name: fid, analyticType, semanticType, aggName } as unknown as IViewField);

const REGION = field('region', 'dimension', 'nominal');
const CHANNEL = field('channel', 'dimension', 'nominal');
const AGE = field('age', 'dimension', 'quantitative');
const SALES = field('sales', 'measure', 'quantitative', 'mean');
const TRAFFIC = field('traffic', 'measure', 'quantitative');

const ctx: IExplainContext = {
    allFields: [REGION, SALES, CHANNEL, AGE, TRAFFIC],
    viewDimensions: [REGION],
    viewMeasures: [SALES],
    viewFilters: [],
    selectedMark: { region: 'B' },
};

describe('explain plan snapshots', () => {
    it.each(defaultExplainers)('$type workflow payload stays stable', (explainer) => {
        expect(explainer.isApplicable(ctx)).toEqual({ applicable: true });
        expect(explainer.plan(ctx)).toMatchSnapshot(explainer.type);
    });

    it('contributing dimensions and unique mark share payloads for engine deduplication', () => {
        expect(contributingDimExplainer.plan(ctx)).toEqual(uniqueMarkExplainer.plan(ctx));
    });

    it('bins quantitative hidden dimensions in planned payloads', () => {
        const payloads = contributingDimExplainer.plan(ctx);
        const hasAgeBin = payloads.some((payload) =>
            payload.workflow.some(
                (step) =>
                    step.type === 'transform' &&
                    step.transform.some((transform) => transform.key === 'age__explain_bin' && transform.expression.op === 'bin')
            )
        );

        expect(hasAgeBin).toBe(true);
    });
});
