import type { IChart, IViewField } from '../../graphic-walker/src/interfaces';
import { adaptChartToRenderPlan, type PreparedColumn } from '../../graphic-walker/src/lib/native/adapter';
import { createNestedChartFixture } from '../../graphic-walker/src/lib/native/fixtures';
import { createNativeScenario } from '../../graphic-walker/src/lib/native/scenarios';
import type { PaneWindow, PreparedRecord, RenderPlan } from '../src/core/types';

export const BENCHMARK_SEED = 0x5eed2026;
export const BENCHMARK_VIEWPORT = { width: 1440, height: 900, dpr: 2 } as const;
export const BENCHMARK_FONT = 'Arial, "Noto Sans CJK SC", sans-serif';
export type BenchmarkCase = 'B2' | 'B3' | 'B5';
export interface BenchmarkFixture {
    id: string;
    chart: IChart;
    columns: PreparedColumn[];
    records: PreparedRecord[];
    seed: number;
    expected: { rowLeaves: number; columnLeaves: number; logicalSlots: number; records: number; nonEmptyPanes: number; rowDepth: number; columnDepth: number; maxRecordsPerPane: number };
    getDatumKey(record: PreparedRecord): string;
    windowForSample(sample: number): PaneWindow;
    layout: { rowHeight: number; columnWidth: number; rowHeaderWidth: number; columnHeaderHeight: number; headerLabelMode: 'member' | 'path' };
    description: string;
}
const dimension = (fid: string, name = fid): IViewField => ({ fid, name, analyticType: 'dimension', semanticType: 'nominal' });
const measure = (fid: string): IViewField => ({ fid, name: fid, analyticType: 'measure', semanticType: 'quantitative' });
function hash(value: number, seed: number): number {
    let x = (value ^ seed) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    return (x ^ (x >>> 16)) >>> 0;
}
/** Unequal boundaries split child groups at parent boundaries; no axis is a six-level fixed-width template. */
export function memberColumns(axis: 'r' | 'c', count: number): string[][] {
    const factors = count > 1000 ? [16001, 2701, 431, 67, 7, 1] : count > 100 ? [401, 137, 31, 11, 3, 1] : [47, 23, 11, 5, 2, 1];
    return Array.from({ length: 6 }, (_, depth) => Array.from({ length: count }, (_, rank) => `${axis}${depth}:${Math.floor(rank / factors[depth])}`));
}
function chartForGrid(): IChart {
    const chart = createNestedChartFixture().chart;
    const rows = Array.from({ length: 6 }, (_, index) => dimension(`r${index}`, `Row level ${index + 1}`));
    const columns = Array.from({ length: 6 }, (_, index) => dimension(`c${index}`, `Column level ${index + 1}`));
    const x = measure('x'), y = measure('y');
    chart.encodings.rows = [...rows, y]; chart.encodings.columns = [...columns, x];
    chart.encodings.dimensions = [...rows, ...columns]; chart.encodings.measures = [x, y];
    chart.config.defaultAggregated = false; chart.config.geoms = ['point'];
    chart.layout.zeroScale = false;
    chart.layout.size = { mode: 'fixed', width: 1440, height: 900 };
    return chart;
}

/** Generate actual prepared records on demand. The browser HTML never contains this array. */
export function createBenchmarkFixture(kind: BenchmarkCase, options: { seed?: number; smoke?: boolean; svgStress?: boolean } = {}): BenchmarkFixture {
    const seed = options.seed ?? BENCHMARK_SEED;
    const rowLeaves = options.smoke ? 20 : kind === 'B3' ? 100_000 : 100;
    const columnLeaves = options.smoke ? 20 : kind === 'B3' ? 1000 : 100;
    const rowMembers = memberColumns('r', rowLeaves), columnMembers = memberColumns('c', columnLeaves);
    const chart = chartForGrid();
    const records: PreparedRecord[] = [];
    const recordsPerPane = kind === 'B3' ? 1 : 20;
    const columnsPerRow = kind === 'B3' ? 10 : columnLeaves;
    for (let row = 0; row < rowLeaves; row++) {
        // B3 has ten real occupied columns per row. Contiguous blocks retain sorted member order.
        const startColumn = kind === 'B3' ? Math.floor(row / Math.max(1, rowLeaves / (columnLeaves / 10))) * 10 : 0;
        for (let offset = 0; offset < columnsPerRow; offset++) {
            const column = (startColumn + offset) % columnLeaves;
            const points = options.svgStress && kind === 'B5' && row < 10 && column < 10 ? 50 : recordsPerPane;
            for (let point = 0; point < points; point++) {
                const identity = row * columnLeaves * 64 + column * 64 + point;
                const datum: Record<string, unknown> = { id: `${kind}:${row}:${column}:${point}`, row, column, point };
                for (let depth = 0; depth < 6; depth++) { datum[`r${depth}`] = rowMembers[depth][row]; datum[`c${depth}`] = columnMembers[depth][column]; }
                datum.x = (hash(identity, seed) % 20001) / 100 - 100;
                datum.y = (hash(identity, seed ^ 0xa5a5a5a5) % 20001) / 100 - 100;
                records.push(datum);
            }
        }
    }
    const columns: PreparedColumn[] = [
        ...Array.from({ length: 6 }, (_, index) => ({ columnKey: `r${index}`, valueType: 'string' as const })),
        ...Array.from({ length: 6 }, (_, index) => ({ columnKey: `c${index}`, valueType: 'string' as const })),
        { columnKey: 'x', valueType: 'number' }, { columnKey: 'y', valueType: 'number' },
    ];
    const stress = options.svgStress && kind === 'B5';
    const layout = stress
        ? { rowHeight: 70, columnWidth: 110, rowHeaderWidth: 340, columnHeaderHeight: 200, headerLabelMode: 'member' as const }
        : { rowHeight: 120, columnWidth: 160, rowHeaderWidth: 250, columnHeaderHeight: 160, headerLabelMode: 'member' as const };
    return {
        id: `${kind}${options.smoke ? '-smoke' : ''}${stress ? '-stress' : ''}`, chart, columns, records, seed, layout,
        expected: { rowLeaves, columnLeaves, logicalSlots: rowLeaves * columnLeaves, records: records.length, nonEmptyPanes: rowLeaves * columnsPerRow, rowDepth: 6, columnDepth: 6, maxRecordsPerPane: stress ? 50 : recordsPerPane },
        getDatumKey: (record) => String(record.id),
        windowForSample(sample) {
            const row = hash(sample, seed) % Math.max(1, rowLeaves - 8);
            const column = kind === 'B3' ? Math.floor(row / Math.max(1, rowLeaves / (columnLeaves / 10))) * 10 : hash(sample, seed ^ 17) % Math.max(1, columnLeaves - 10);
            return { rows: { start: row, end: Math.min(rowLeaves, row + 8) }, columns: { start: column, end: Math.min(columnLeaves, column + 10) } };
        },
        description: kind === 'B3' ? 'One million actual prepared records in 100 million logical slots; each occupied pane has one point.' : stress ? 'Same six-level point worksheet with 50 supplied records in each of the first 100 panes, for 5,000 visible SVG marks.' : 'Ten thousand occupied panes with twenty actual prepared points per pane, six facet levels on each axis.',
    };
}

/** Mapping is separate so its time is not hidden in input generation or source indexing. */
export function adaptBenchmarkFixture(fixture: BenchmarkFixture): RenderPlan {
    const result = adaptChartToRenderPlan(fixture.chart, { columns: fixture.columns, theme: { style: { fontFamily: BENCHMARK_FONT, fontSize: 11, pointSize: 9 } } });
    if (!result.plan) throw new Error(JSON.stringify(result.diagnostics));
    return { ...result.plan, layout: fixture.layout } as RenderPlan;
}

export interface SemanticFixture {
    id: string;
    acceptance: readonly string[];
    chart: IChart;
    columns: PreparedColumn[];
    records: PreparedRecord[];
    getDatumKey(record: PreparedRecord): string;
    expected: { rowFacets?: number; columnFacets?: number; rowLeaves?: number; columnLeaves?: number; nonEmptyPanes?: number; exactTuples?: readonly (readonly unknown[])[] };
}
export function createB1Fixtures(): SemanticFixture[] {
    const fixtures: SemanticFixture[] = [];
    for (const depth of [3, 5, 10, 20]) {
        const base = createNativeScenario('scatter');
        const rows = Array.from({ length: depth }, (_, index) => dimension(`row${index}`));
        const columns = Array.from({ length: depth }, (_, index) => dimension(`column${index}`));
        base.chart.encodings.rows = [...rows, measure('Y')]; base.chart.encodings.columns = [...columns, measure('X')];
        base.chart.encodings.color = []; base.chart.encodings.size = []; base.chart.encodings.opacity = []; base.chart.encodings.shape = [];
        const records = [0, 1].map((index) => Object.fromEntries([['id', `depth:${depth}:${index}`], ['X', index + 1], ['Y', index + 2], ...rows.map((field) => [field.fid, `row:${index}`]), ...columns.map((field) => [field.fid, `column:${index}`])]));
        fixtures.push({ id: `both-axes-${depth}`, acceptance: ['A01', 'A04'], chart: base.chart, records,
            columns: [...rows, ...columns].map((field): PreparedColumn => ({ columnKey: field.fid, valueType: 'string' })).concat({ columnKey: 'X', valueType: 'number' }, { columnKey: 'Y', valueType: 'number' }),
            getDatumKey: (record) => String(record.id), expected: { rowFacets: depth, columnFacets: depth, rowLeaves: 2, columnLeaves: 2, nonEmptyPanes: 2 } });
    }
    const pair = (id: string, rowFields: IViewField[], columnFields: IViewField[], records: PreparedRecord[], expected: SemanticFixture['expected'], acceptance: string[]) => {
        const chart = chartForGrid(); chart.encodings.rows = [...rowFields, measure('y')]; chart.encodings.columns = [...columnFields, measure('x')];
        const fields = [...rowFields, ...columnFields];
        return { id, acceptance, chart, records, columns: [...new Map(fields.map((field) => [field.fid, { columnKey: field.fid, valueType: 'string' as const }])).values(), { columnKey: 'x', valueType: 'number' as const }, { columnKey: 'y', valueType: 'number' as const }], getDatumKey: (record: PreparedRecord) => String(record.id), expected };
    };
    const sparse = [{ id: 'furniture-chair', Category: 'Furniture', Product: 'Chair', x: 3, y: 8 }, { id: 'office-paper', Category: 'Office', Product: 'Paper', x: 5, y: 13 }];
    fixtures.push(pair('sparse-same-axis', [dimension('Category'), dimension('Product')], [], sparse, { rowLeaves: 2, columnLeaves: 1, nonEmptyPanes: 2 }, ['A03']));
    fixtures.push(pair('sparse-cross-axis', [dimension('Category')], [dimension('Product')], sparse, { rowLeaves: 2, columnLeaves: 2, nonEmptyPanes: 2 }, ['A03']));
    const tuples = [{ id: 'east-chair', Region: 'East', Product: 'Chair', x: 2, y: 5 }, { id: 'west-paper', Region: 'West', Product: 'Paper', x: 7, y: 11 }];
    fixtures.push(pair('exact-selection-tuples', [dimension('Region')], [dimension('Product')], tuples, { rowLeaves: 2, columnLeaves: 2, nonEmptyPanes: 2, exactTuples: [['East', 'Chair'], ['West', 'Paper']] }, ['A07']));
    const long = [{ id: 'long-label', Region: '华东地区：这是一个用于检查冻结表头和省略号的较长中文名称', Product: 'A deliberately long English product label with punctuation / and spaces', x: -12.5, y: 999.25 }];
    fixtures.push(pair('long-bilingual-labels', [dimension('Region', '区域名称 / Region')], [dimension('Product', '产品名称 / Product')], long, { rowLeaves: 1, columnLeaves: 1, nonEmptyPanes: 1 }, ['A08', 'A10']));
    return fixtures;
}

export function createB4Plan(): RenderPlan {
    const chart = chartForGrid();
    const columns: PreparedColumn[] = [...chart.encodings.dimensions.map((field): PreparedColumn => ({ columnKey: field.fid, valueType: 'string' })), { columnKey: 'x', valueType: 'number' }, { columnKey: 'y', valueType: 'number' }];
    const result = adaptChartToRenderPlan(chart, { columns, theme: { style: { fontFamily: BENCHMARK_FONT, pointSize: 9 } } });
    if (!result.plan) throw new Error(JSON.stringify(result.diagnostics));
    return { ...result.plan, layout: { rowHeight: 120, columnWidth: 160, rowHeaderWidth: 250, columnHeaderHeight: 160, headerLabelMode: 'member' } } as RenderPlan;
}
