import type { IViewField } from '../interfaces';
import { walkFid } from '../lib/sql';
import { toWorkflow } from './workflow';

const dim = (fid: string): IViewField => ({ fid, name: fid, semanticType: 'nominal', analyticType: 'dimension' });
const mea = (fid: string): IViewField => ({ fid, name: fid, semanticType: 'quantitative', analyticType: 'measure', aggName: 'sum' });
const calc = (fid: string, name: string, sql: string, aggName: string): IViewField => ({
    fid, name, semanticType: 'quantitative', analyticType: 'measure', computed: true, aggName,
    expression: { op: 'expr', as: fid, params: [{ type: 'sql', value: sql }] },
});

describe('fields an expression reads', () => {
    test('are found inside function calls and branches, and the star of count(*) is not one', () => {
        expect(walkFid('sum(a) / sum("B")').sort()).toEqual(['B', 'a']);
        expect(walkFid('case when a > 1 then round(b, 2) else c end').sort()).toEqual(['a', 'b', 'c']);
        expect(walkFid('count(*)')).toEqual([]);
        expect(walkFid('a + 1')).toEqual(['a']);
    });
});

describe('toWorkflow with aggregate expressions', () => {
    const margin = calc('f_margin', 'Margin', 'Sales - Cost', 'sum');
    const logged = calc('f_logged', 'Logged', 'ln(Margin)', 'sum');
    const rate = calc('f_rate', 'Rate', 'sum(Margin) / sum(Sales)', 'expr');
    const fields = [dim('Region'), mea('Sales'), mea('Cost'), margin, logged, rate];

    test('a computed field that only an aggregate expression reads is computed before the grouping', () => {
        const steps = toWorkflow([], fields, [dim('Region')], [rate], true, 'none');
        expect(steps.map((step) => step.type)).toEqual(['transform', 'view']);
        expect(steps[0]).toMatchObject({ transform: [{ key: 'f_margin' }] });
        expect(steps[1]).toMatchObject({ query: [{ op: 'aggregate', groupBy: ['Region'], measures: [{ field: '((sum (f_margin) ) / (sum ("Sales") ))', agg: 'expr', asFieldKey: 'f_rate' }] }] });
    });
    test('a computed field that reads another one through a function comes after it', () => {
        const steps = toWorkflow([], fields, [dim('Region')], [logged], true, 'none');
        expect(steps[0]).toMatchObject({ type: 'transform', transform: [{ key: 'f_margin' }, { key: 'f_logged' }] });
    });
    test('a chart without computed fields has no transform step', () => {
        expect(toWorkflow([], fields, [dim('Region')], [mea('Sales')], true, 'none').map((step) => step.type)).toEqual(['view']);
    });
});
