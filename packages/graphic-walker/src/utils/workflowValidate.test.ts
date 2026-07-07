jest.mock('nanoid', () => ({ nanoid: () => 'mock-id' }));

import { IViewField, TerseSpec } from '../interfaces';
import { validateWorkflowFields, assertValidWorkflowFields } from './workflowValidate';
import { normalize } from '../models/normalize';
import { chartToWorkflow } from './workflow';

const dim = (fid: string): IViewField => ({ fid, name: fid, semanticType: 'nominal', analyticType: 'dimension' });
const mea = (fid: string): IViewField => ({ fid, name: fid, semanticType: 'quantitative', analyticType: 'measure', aggName: 'sum' });
const binOf = (fid: string, base: string): IViewField => ({
    fid,
    name: fid,
    semanticType: 'ordinal',
    analyticType: 'dimension',
    computed: true,
    expression: { op: 'bin', as: fid, params: [{ type: 'field', value: base }] },
});
const exprOf = (fid: string, sql: string): IViewField => ({
    fid,
    name: fid,
    semanticType: 'quantitative',
    analyticType: 'measure',
    aggName: 'sum',
    computed: true,
    expression: { op: 'expr', as: fid, params: [{ type: 'sql', value: sql }] },
});

describe('validateWorkflowFields', () => {
    test('valid field sets produce no issues', () => {
        expect(validateWorkflowFields([dim('region'), mea('sales'), binOf('b1', 'sales'), exprOf('e1', '"sales" * 2')])).toEqual([]);
    });

    test('dangling field param is a missing-field issue when the dataset schema is supplied', () => {
        expect(validateWorkflowFields([dim('region'), binOf('b1', 'ghost')], [])).toEqual([{ type: 'missing-field', fid: 'b1', missing: 'ghost' }]);
    });

    test('missing-field check is skipped without a schema (existence is judged against the dataset, not the pools)', () => {
        expect(validateWorkflowFields([dim('region'), binOf('b1', 'order_date')])).toEqual([]);
        // and a raw dataset column outside the pools is legal when the schema knows it
        expect(validateWorkflowFields([dim('region'), binOf('b1', 'order_date')], [{ fid: 'order_date', name: 'Order Date' }])).toEqual([]);
    });

    test('unresolved SQL ref is a missing-field issue, resolution mirrors replaceFid (name ?? fid, lowercased)', () => {
        const named: IViewField = { ...mea('sales'), name: 'Sales' };
        // resolves via lowercased name
        expect(validateWorkflowFields([named, exprOf('e1', '"SALES" * 2')], [])).toEqual([]);
        // unresolved ref reported
        expect(validateWorkflowFields([named, exprOf('e2', '"ghost" + 1')], [])).toEqual([{ type: 'missing-field', fid: 'e2', missing: 'ghost' }]);
    });

    test('cyclic computed dependencies are reported with the cycle path', () => {
        const a = exprOf('a', '"b" + 1');
        const b = exprOf('b', '"a" + 1');
        const issues = validateWorkflowFields([a, b]);
        const cycles = issues.filter((i) => i.type === 'cyclic-dependency');
        expect(cycles.length).toBeGreaterThanOrEqual(1);
        expect((cycles[0] as { cycle: string[] }).cycle).toEqual(expect.arrayContaining(['a', 'b']));
    });

    test('self-reference is a cycle of length one', () => {
        const issues = validateWorkflowFields([exprOf('a', '"a" + 1')]);
        expect(issues).toContainEqual({ type: 'cyclic-dependency', cycle: ['a', 'a'] });
    });

    test('duplicate fids in the pools are reported', () => {
        expect(validateWorkflowFields([mea('sales'), { ...mea('sales'), name: 'Sales 2' }])).toEqual([{ type: 'duplicate-fid', fid: 'sales' }]);
    });

    test('assertValidWorkflowFields aggregates issues into one error', () => {
        expect(() => assertValidWorkflowFields([binOf('b1', 'ghost'), exprOf('a', '"a" + 1')], [])).toThrow(/unknown field 'ghost'[\s\S]*cyclic/);
    });
});

describe('characterization: treeShake terminates on cycles but orders transforms unsatisfiably', () => {
    test('chartToWorkflow does not hang on a cyclic chart (the validator exists to catch this class beforehand)', () => {
        const a = exprOf('a', '"b" + 1');
        const b = exprOf('b', '"a" + 1');
        const chart = {
            visId: 'cycle',
            name: 'cycle',
            encodings: {
                dimensions: [dim('region')],
                measures: [mea('sales'), a, b],
                rows: [a],
                columns: [dim('region')],
                color: [],
                opacity: [],
                size: [],
                shape: [],
                radius: [],
                theta: [],
                longitude: [],
                latitude: [],
                geoId: [],
                details: [],
                filters: [],
                text: [],
            },
            config: { defaultAggregated: true, geoms: ['bar'], coordSystem: 'generic' as const, limit: -1 },
            layout: {
                showTableSummary: false,
                format: {},
                resolve: {},
                size: { mode: 'auto' as const, width: 320, height: 200 },
                interactiveScale: false,
                stack: 'stack' as const,
                showActions: false,
                zeroScale: true,
            },
        };
        const payload = chartToWorkflow(chart);
        expect(Array.isArray(payload.workflow)).toBe(true);
    });
});

describe('normalize integration', () => {
    const META = [
        { fid: 'region', name: 'Region', semanticType: 'nominal' as const, analyticType: 'dimension' as const },
        { fid: 'sales', name: 'Sales', semanticType: 'quantitative' as const, analyticType: 'measure' as const },
    ];

    test('normalize throws on a chart whose computed fields form a cycle', () => {
        const valid = normalize({ encodings: { columns: [dim('region')] } }, META);
        const doctored = {
            ...valid,
            encodings: {
                ...valid.encodings,
                measures: [...valid.encodings.measures, exprOf('a', '"b" + 1'), exprOf('b', '"a" + 1')],
            },
        };
        expect(() => normalize(doctored, META)).toThrow(/cyclic computed-field dependency/);
    });

    test('normalize throws on a dangling computed reference', () => {
        const valid = normalize({ encodings: { columns: [dim('region')] } }, META);
        const doctored = {
            ...valid,
            encodings: { ...valid.encodings, dimensions: [...valid.encodings.dimensions, binOf('b1', 'ghost')] },
        };
        expect(() => normalize(doctored, META)).toThrow(/unknown field 'ghost'/);
    });

    test('normalize stays green for valid terse and canonical inputs (idempotency intact)', () => {
        const once = normalize({ x: 'Region', y: 'sum(Sales)' } as TerseSpec, META);
        expect(normalize(once, META)).toEqual(once);
    });
});
