import { compile } from 'vega-lite';
import { parse, View } from 'vega';
import type { IRow, IViewField } from '../interfaces';
import { prepareTemporalColumns, prepareTemporalValue } from './temporalDisplay';
import { prepareTemporalValue as nativeTemporalValue } from './native/temporal';
import { getVegaTemporalFieldMap, toVegaSpec } from './vega';

const time = (fid = 'When', offset = 0): IViewField => ({ fid, name: 'Event time', semanticType: 'temporal', analyticType: 'dimension', offset });
const measure = (fid = 'Value'): IViewField => ({ fid, name: fid, semanticType: 'quantitative', analyticType: 'measure', aggName: 'sum' });
const values = [null, 0, '2026-03-08T01:30:00-08:00', '2026-03-08T03:30:00-07:00', '2026-03-09'];
const expected = [null, 0, Date.parse('2026-03-08T01:30:00Z'), Date.parse('2026-03-08T02:30:00Z'), Date.UTC(2026, 2, 9)];
const inputRows = () => values.map((When, index) => ({ When, Value: index + 1, Other: index + 10 }));
const base = {
    rows: [measure()],
    columns: [time()],
    dataSource: inputRows(),
    defaultAggregated: false,
    geomType: 'point',
    stack: 'none' as const,
    interactiveScale: false,
    layoutMode: 'fixed',
    width: 640,
    height: 480,
    mediaTheme: 'light' as const,
    vegaConfig: {},
    displayOffset: 0,
};

beforeEach(() => jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(480));
afterEach(() => jest.restoreAllMocks());

test('native and legacy share strict per-value conversion for null, epoch zero, DST ISO and date-only input', () => {
    expect(nativeTemporalValue).toBe(prepareTemporalValue);
    const convert = (value: unknown) => prepareTemporalValue(value, { fieldOffset: 0, displayOffset: 0, localOffset: 480 });
    expect(values.map(convert)).toEqual(expected);
    expect([...values].reverse().map(convert)).toEqual([...expected].reverse());
    expect(prepareTemporalValue(0, { displayOffset: 60, fieldOffset: 0, localOffset: 480 })).toBe(-3_600_000);
});

test('display columns reuse matching offsets, separate different offsets and avoid every raw or declared key', () => {
    const field = time('When.[raw]');
    const otherOffset = time(field.fid, 60);
    const input = [
        { [field.fid]: '2026-03-09', Value: 1 },
        { [field.fid]: null, Value: 2, __gw_time_0: 'host collision on a later row' },
    ];
    const original = JSON.stringify(input);
    const prepared = prepareTemporalColumns({
        dataSource: input,
        fields: [field, { ...field }, otherOffset, measure('__gw_time_1')],
        displayOffset: 0,
        localOffset: 480,
    });
    const [first, same, different] = prepared.fields;
    expect(first.fid).toBe('__gw_time_2');
    expect(same.fid).toBe(first.fid);
    expect(different.fid).toBe('__gw_time_3');
    expect(prepared.rawFieldsByDisplay.size).toBe(2);
    expect(prepared.dataSource[0][first.fid]).toBe(Date.UTC(2026, 2, 9));
    expect(prepared.dataSource[0][different.fid]).toBe(Date.UTC(2026, 2, 9, 1));
    expect(prepared.dataSource[1][first.fid]).toBeNull();
    expect(prepared.dataSource[1].__gw_time_0).toBe('host collision on a later row');
    expect(JSON.stringify(input)).toBe(original);
    expect(field.fid).toBe('When.[raw]');
});

test('default and explicit matching offsets share one conversion and timeUnit remains declared', () => {
    const field: IViewField = {
        ...time(),
        offset: undefined,
        timeUnit: 'month',
        computed: true,
        expression: {
            op: 'dateTimeDrill',
            as: 'When',
            params: [
                { type: 'field', value: 'Source' },
                { type: 'value', value: 'month' },
            ],
        },
    };
    const prepared = prepareTemporalColumns({ dataSource: inputRows(), fields: [field, { ...field, offset: 480 }], displayOffset: 0, localOffset: 480 });
    expect(prepared.fields[0].fid).toBe(prepared.fields[1].fid);
    expect(prepared.rawFieldsByDisplay.size).toBe(1);
    expect(prepared.fields[0].timeUnit).toBe('month');
    expect(prepared.fields[0].expression).toBe(field.expression);
    expect(prepared.dataSource[2][prepared.fields[0].fid]).toBe(Date.parse('2026-03-08T09:30:00Z'));
    expect(prepared.dataSource[4][prepared.fields[0].fid]).toBe(Date.UTC(2026, 2, 9, 8));
});

test('invalid temporal values and offsets fail explicitly instead of dropping records', () => {
    for (const invalid of [undefined, false, NaN, Infinity, 1e20, 'not-a-date', {}]) {
        expect(() => prepareTemporalColumns({ dataSource: [{ When: 0 }, { When: invalid }], fields: [time()], displayOffset: 0 })).toThrow(
            /Temporal field "When", row 1:/,
        );
    }
    expect(() => prepareTemporalColumns({ dataSource: [{}], fields: [time()], displayOffset: 0 })).toThrow(/row 0/);
    expect(() => prepareTemporalColumns({ dataSource: [], fields: [time('When', Infinity)], displayOffset: 0 })).toThrow('Time offsets must be finite numbers');
    expect(() => prepareTemporalColumns({ dataSource: [], fields: [time()], displayOffset: NaN })).toThrow('Time offsets must be finite numbers');
    const empty = prepareTemporalColumns({ dataSource: [], fields: [time()], displayOffset: 0 });
    expect(empty.dataSource).toEqual([]);
    expect(empty.rawFieldsByDisplay.get(empty.fields[0].fid)).toBe('When');
});

test('non-temporal fields and temporal measures retain their original columns', () => {
    const temporalMeasure: IViewField = { ...measure(), semanticType: 'temporal' };
    const dataSource = [{ Value: 0 }];
    const fields = [temporalMeasure, measure('Other')];
    const prepared = prepareTemporalColumns({ dataSource, fields });
    expect(prepared.dataSource).toBe(dataSource);
    expect(prepared.fields).toBe(fields);
    expect(prepared.rawFieldsByDisplay.size).toBe(0);
});

test('Vega encodings and tooltips use aliases while callbacks and geom selection retain original fields', () => {
    const field = time('When.[raw]');
    const rows = inputRows().map(({ When, ...rest }) => ({ ...rest, [field.fid]: When }));
    const before = JSON.stringify(rows);
    const xValues: unknown[][] = [],
        yValues: unknown[][] = [];
    const [spec] = toVegaSpec({
        ...base,
        rows: [time(field.fid, 60)],
        columns: [field],
        details: [{ ...field }],
        dataSource: rows,
        scales: {
            column: (info) => {
                xValues.push(info.values);
                return { domain: [0, 1] };
            },
            row: (info) => {
                yValues.push(info.values);
                return { domain: [0, 1] };
            },
        },
    });
    const x = spec.encoding.x.field,
        y = spec.encoding.y.field;
    expect(x).not.toBe(y);
    expect(spec.encoding.tooltip.map((item: { field: string }) => item.field)).toEqual([x, y, x]);
    expect(spec.params[0].select.fields).toEqual(['When\\.\\[raw\\]', 'When\\.\\[raw\\]', 'When\\.\\[raw\\]']);
    expect(xValues).toEqual([values]);
    expect(yValues).toEqual([values]);
    expect(spec.data.values.map((row: IRow) => row[x])).toEqual(expected);
    expect(spec.data.values.map((row: IRow) => row[y])).toEqual(expected.map((value, index) => (value === null || index === 1 ? value : value + 3_600_000)));
    expect(spec.data.values.map((row: IRow) => row[field.fid])).toEqual(values);
    expect(spec.transform).toBeUndefined();
    expect(spec).not.toHaveProperty('dataSource');
    expect(spec).not.toHaveProperty('rawFieldsByDisplay');
    expect(getVegaTemporalFieldMap(spec)).toEqual({ [x]: field.fid, [y]: field.fid });
    expect(Object.isFrozen(getVegaTemporalFieldMap(spec))).toBe(true);
    expect(getVegaTemporalFieldMap(spec)?.constructor).toBeUndefined();
    expect(getVegaTemporalFieldMap(JSON.parse(JSON.stringify(spec)))).toBeUndefined();
    expect(JSON.stringify(rows)).toBe(before);
});

test('each repeated view carries prepared values without leaking private metadata or altering raw rows', () => {
    const rows = inputRows();
    const specs = toVegaSpec({ ...base, rows: [measure(), measure('Other')], dataSource: rows });
    expect(specs).toHaveLength(2);
    for (const spec of specs) {
        const field = spec.encoding.x.field;
        expect(spec.data.values.map((row: IRow) => row[field])).toEqual(expected);
        expect(spec.data.values.map((row: IRow) => row.When)).toEqual(values);
        expect(spec).not.toHaveProperty('rawFieldsByDisplay');
        expect(spec).not.toHaveProperty('dataSource');
        expect(spec.transform).toEqual([]);
        expect(getVegaTemporalFieldMap(spec)).toEqual({ [field]: 'When' });
    }
    expect(rows).toEqual(inputRows());
    const reordered = toVegaSpec({ ...base, dataSource: [...rows].reverse() })[0];
    expect(reordered.data.values.map((row: IRow) => row[reordered.encoding.x.field])).toEqual([...expected].reverse());
});

test('Vega retains existing timeUnit declarations on the prepared field', () => {
    const [spec] = toVegaSpec({ ...base, columns: [{ ...time(), timeUnit: 'month' }] });
    expect(spec.encoding.x.timeUnit).toBe('utcyearmonth');
    expect(spec.encoding.tooltip[0].timeUnit).toBe('utcyearmonth');
    expect(spec.encoding.x.field).not.toBe('When');
});

test.each([
    ['point text', { geomType: 'point', text: time('HiddenDate') }],
    ['text details', { geomType: 'text', text: measure(), details: [time('HiddenDate')] }],
    ['arc rows', { geomType: 'arc', rows: [time('HiddenDate')], columns: [], theta: measure() }],
    ['line shape', { geomType: 'line', shape: time('HiddenDate') }],
] as const)('inactive %s does not require a temporal query column', (_name, overrides) => {
    const dataSource = [{ Category: 'A', Value: 2 }];
    const category: IViewField = { fid: 'Category', name: 'Category', semanticType: 'nominal', analyticType: 'dimension' };
    const [spec] = toVegaSpec({ ...base, columns: [category], dataSource, ...overrides });
    expect(spec.data.values).toBe(dataSource);
    expect(getVegaTemporalFieldMap(spec)).toBeUndefined();
    expect(spec.data.values[0]).toEqual({ Category: 'A', Value: 2 });
    if (overrides.geomType === 'text') expect(spec.encoding.tooltip.some((field: { field: string }) => field.field === 'HiddenDate')).toBe(false);
});

test.each([
    ['position', { columns: [time('MissingDate')] }],
    ['detail', { details: [time('MissingDate')] }],
    ['text', { geomType: 'text', text: time('MissingDate') }],
    ['arc color', { geomType: 'arc', rows: [], columns: [], theta: measure(), color: time('MissingDate') }],
] as const)('an active temporal %s still rejects a missing query column', (_name, overrides) => {
    expect(() => toVegaSpec({ ...base, ...overrides })).toThrow(/Temporal field "MissingDate", row 0:/);
});

test('compiled Vega consumes prepared numeric dates and keeps original raw values including null and zero', async () => {
    const [spec] = toVegaSpec(base);
    const compiled = compile(spec).spec;
    const view = new View(parse(compiled), { renderer: 'none' });
    try {
        await view.runAsync();
        const records = view.data('source_0');
        expect(records.map((row: IRow) => row.When)).toEqual(values);
        expect(records.map((row: IRow) => (row[spec.encoding.x.field] === null ? null : Number(row[spec.encoding.x.field])))).toEqual(expected);
    } finally {
        view.finalize();
    }
});

test('legacy Date input retains its raw object and prior ISO-style offsets without extending native input', () => {
    const date = new Date('2026-03-09T00:00:00Z');
    const field = time('When', 60);
    const prepared = prepareTemporalColumns({ dataSource: [{ When: date }], fields: [field], displayOffset: 0, localOffset: 480 });
    expect(prepared.dataSource[0].When).toBe(date);
    expect(prepared.dataSource[0][prepared.fields[0].fid]).toBe(date.getTime() - 7 * 3_600_000);
    expect(() => prepareTemporalColumns({ dataSource: [{ When: new Date(NaN) }], fields: [field], displayOffset: 0 })).toThrow(/Temporal field "When", row 0:/);
    expect(() => prepareTemporalValue(date, { fieldOffset: 60, displayOffset: 0, localOffset: 480 })).toThrow('Time results must be');
    const [spec] = toVegaSpec({ ...base, columns: [field], dataSource: [{ When: date, Value: 1 }] });
    expect(spec.data.values[0].When).toBe(date);
    expect(spec.data.values[0][spec.encoding.x.field]).toBe(date.getTime() - 7 * 3_600_000);
});
