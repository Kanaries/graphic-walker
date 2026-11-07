import type { IChart, IViewField } from '../../interfaces';
import type { PreparedColumn, NativeAdapterInput } from './adapter';
import type { NativeWorksheetLayout } from './presentation';
import { createNestedChartFixture } from './fixtures';

export const nativeExtendedScenarios = [
    { id: 'circle', label: 'Circle · fixed symbols and size' },
    { id: 'tick', label: 'Tick · two position axes' },
    { id: 'auto-tick', label: 'Auto · single continuous field' },
    { id: 'area', label: 'Area · zero stack and null gap' },
    { id: 'trail', label: 'Trail · changing width' },
    { id: 'pie', label: 'Pie · nested row and column facets' },
    { id: 'donut', label: 'Donut · empty center' },
    { id: 'pie-size', label: 'Pie · proportional slice area' },
    { id: 'bar-normalize', label: 'Bars · normalized stack' },
    { id: 'bar-center', label: 'Bars · centered stack' },
    { id: 'area-normalize', label: 'Area · normalized stack' },
    { id: 'area-center', label: 'Area · centered stack' },
    { id: 'boxplot', label: 'Boxplot · raw distribution' },
] as const;
export type NativeExtendedScenario = (typeof nativeExtendedScenarios)[number]['id'];
export type NativeScenario = NativeExtendedScenario | 'nested' | 'line' | 'heatmap' | 'text' | 'grouped' | 'stack' | 'scatter' | 'deep' | 'scope' | 'interval';
export interface NativeScenarioFixture {
    chart: IChart;
    records: Record<string, unknown>[];
    columns: PreparedColumn[];
    getDatumKey: (record: Readonly<Record<string, unknown>>) => string;
    presentation?: Omit<NativeAdapterInput, 'columns'>;
    description: string;
}
const dim = (fid: string, semanticType: IViewField['semanticType'] = 'nominal'): IViewField => ({ fid, name: fid, analyticType: 'dimension', semanticType });
const mea = (fid: string): IViewField => ({ fid, name: fid, analyticType: 'measure', semanticType: 'quantitative', aggName: 'sum' });

/** Deterministic prepared results and existing IChart inputs; none of these fixtures executes a query. */
export function createNativeScenario(name: NativeScenario): NativeScenarioFixture {
    const base = createNestedChartFixture();
    if (name === 'nested') return { ...base, description: 'Two regions, three categories, two years and two measure slots form 24 panes.' };
    if (name === 'deep') {
        const levels = Array.from({ length: 6 }, (_, index) => dim(`Level ${index + 1}`));
        base.chart.encodings.rows = [...levels, ...base.chart.encodings.rows];
        for (const record of base.records) for (const [index, field] of levels.entries()) record[field.fid] = `Group ${index + 1}`;
        base.columns.unshift(...levels.map((field): PreparedColumn => ({ columnKey: field.fid, valueType: 'string' })));
        return { ...base, description: 'Eight row-header levels remain intact while the last dimension stays inside each pane.' };
    }
    const chart = base.chart;
    chart.visId = `native-${name}`;
    chart.name = name;
    chart.config.defaultAggregated = false;
    chart.encodings.rows = [];
    chart.encodings.columns = [];
    chart.encodings.dimensions = [];
    chart.encodings.measures = [];
    const records: Record<string, unknown>[] = [];
    const columns: PreparedColumn[] = [];
    const add = (field: IViewField, valueType: PreparedColumn['valueType']) => {
        chart.encodings[field.analyticType === 'measure' ? 'measures' : 'dimensions'].push(field);
        columns.push({ columnKey: field.fid, valueType });
        return field;
    };
    let description = '';
    let presentation: NativeScenarioFixture['presentation'] = { theme: { style: { fontSize: 11, pointSize: 70, lineWidth: 2, barWidth: 12 } } };
    if (name === 'circle' || name === 'tick' || name === 'auto-tick') {
        const value = add(mea('Value'), 'number'), group = add(dim('Group'), 'string');
        chart.config.geoms = [name === 'auto-tick' ? 'auto' : name];
        chart.encodings.columns = [value];
        if (name !== 'auto-tick') chart.encodings.rows = [group];
        if (name === 'circle') chart.encodings.size = [add(mea('Area'), 'number')];
        chart.encodings.color = [group];
        for (let index = 0; index < 12; index++) records.push({
            __datumKey: `${name}:${index}`, Value: index === 10 ? null : index === 0 ? 0 : index - 4,
            Group: ['A', 'B', 'C'][index % 3], Area: 12 + index * 15,
        });
        description = name === 'auto-tick' ? 'Auto resolves one continuous position to tick. Zero and negative values remain visible; null has no mark.'
            : name === 'circle' ? 'Every symbol remains circular. Area varies with its supplied value; null positions are omitted.'
            : 'Ticks stand perpendicular to the numeric axis. Zero and negative values are ordinary positions.';
    } else if (name === 'area' || name === 'trail' || name === 'area-normalize' || name === 'area-center') {
        const region = add(dim('Region'), 'string'), district = add(dim('District'), 'string'), year = add(dim('Year'), 'string');
        const step = add(dim('Step', 'ordinal'), 'string'), series = add(dim('Series'), 'string'), value = add(mea('Value'), 'number');
        chart.config.geoms = [name === 'trail' ? 'trail' : 'area'];
        chart.encodings.rows = [region, district, value]; chart.encodings.columns = [year, step]; chart.encodings.color = [series];
        chart.layout.stack = name === 'area-normalize' ? 'normalize' : name === 'area-center' ? 'center' : name === 'area' ? 'zero' : 'none';
        chart.layout.format = { numberFormat: ',.0f', normalizedNumberFormat: '.0%' };
        if (name === 'trail') {
            chart.encodings.size = [add(mea('Width'), 'number')];
            chart.layout.scale = { size: { domainMin: 0, domainMax: 12, rangeMin: 1, rangeMax: 16 } };
        }
        for (let r = 0; r < 3; r++) for (let d = 0; d < 2; d++) for (let y = 0; y < 4; y++) for (let s = 0; s < 2; s++) for (let t = 0; t < 6; t++) records.push({
            __datumKey: `${name}:${r}:${d}:${y}:${s}:${t}`, Region: ['East', 'West', 'Central'][r], District: ['Local', 'Metro'][d], Year: String(2023 + y),
            Series: s ? 'Returning' : 'New', Step: String(t + 1), Width: 2 + t * 2,
            Value: t === 3 && s === 0 ? null : t === 0 && s === 0 ? 0 : (t === 1 && s === 0 && name === 'area' ? -6 : 10 + t * 4 + s * 9 + d * 3 + r * 2),
        });
        description = name === 'trail' ? 'Widths change at every vertex. Each filled segment retains both source records. Null breaks the path.'
            : `${chart.layout.stack} area layout shares complete-pane stack endpoints and two row-header levels. Null creates a visible gap.`;
    } else if (name === 'pie' || name === 'donut' || name === 'pie-size') {
        const region = add(dim('Region'), 'string'), district = add(dim('District'), 'string'), year = add(dim('Year'), 'string'), quarter = add(dim('Quarter'), 'string');
        const series = add(dim('Series'), 'string'), weight = add(mea('Weight'), 'number');
        chart.config.geoms = ['arc']; chart.encodings.rows = [region, district]; chart.encodings.columns = [year, quarter];
        chart.encodings.color = [series]; chart.encodings.theta = [weight];
        if (name === 'pie-size') chart.encodings.size = [add(mea('Area'), 'number')];
        if (name === 'donut') presentation = { theme: { style: { arcInnerRadius: 32 } } };
        for (let r = 0; r < 4; r++) for (let d = 0; d < 2; d++) for (let y = 0; y < 3; y++) for (let q = 0; q < 2; q++) for (let s = 0; s < 5; s++) records.push({
            __datumKey: `${name}:${r}:${d}:${y}:${q}:${s}`, Region: ['East', 'West', 'Central', 'North'][r], District: ['Local', 'Metro'][d],
            Year: String(2024 + y), Quarter: ['Q1', 'Q2'][q], Series: ['A', 'B', 'C', 'Zero', 'Missing'][s], Weight: [1, 2, 3, 0, null][s], Area: 25 + s * 25,
        });
        description = name === 'donut' ? 'Two row and two column levels group complete rings. The inner circle has no hover or selection target.'
            : name === 'pie-size' ? 'Weight controls angle. Area controls squared radius with one scale across every pane.'
            : 'Two row and two column levels group complete pies. A/B/C occupy 1/6, 2/6 and 3/6 of each circle; zero and null create no sector.';
    } else if (name === 'boxplot') {
        const region = add(dim('Region'), 'string'), category = add(dim('Category'), 'string'), value = add(mea('Value'), 'number');
        chart.config.geoms = ['boxplot']; chart.encodings.rows = [region, value]; chart.encodings.columns = [category];
        const distribution = [0, 1, 2, 3, 4, 5, 6, 7, 8, 30, null];
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let i = 0; i < distribution.length; i++) records.push({
            __datumKey: `boxplot:${r}:${c}:${i}`, Region: ['East', 'West', 'Central'][r], Category: ['Office', 'Furniture', 'Technology'][c],
            Value: distribution[i] === null ? null : Number(distribution[i]) + r * 4 + c * 2,
        });
        description = 'GW computes quartiles, actual whisker endpoints and outliers from complete raw groups. The rendering package receives only prepared statistics.';
    } else if (name === 'line') {
        const region = add(dim('Region'), 'string'), month = add(dim('Month', 'temporal'), 'time');
        const series = add(dim('Series'), 'string'), value = add(mea('Value'), 'number');
        chart.config.geoms = ['line'];
        chart.encodings.rows = [region, value]; chart.encodings.columns = [month]; chart.encodings.color = [series];
        chart.layout.zeroScale = false; chart.layout.format = { numberFormat: ',.0f', timeFormat: '%b' };
        for (let r = 0; r < 2; r++) for (let s = 0; s < 2; s++) for (let m = 0; m < 8; m++) records.push({
            __datumKey: `line:${r}:${s}:${m}`, Region: r ? 'West' : 'East', Series: s ? 'Returning' : 'New', Month: Date.UTC(2026, m, 1),
            Value: m === 3 && s === 0 ? null : 18 + r * 15 + s * 12 + (m % 4) * 8,
        });
        description = 'Each region has two ordered series. A supplied null creates a gap in the New series.';
    } else if (name === 'heatmap' || name === 'text') {
        const category = add(dim('Category'), 'string'), month = add(dim('Month', 'ordinal'), 'string'), value = add(mea('Value'), 'number');
        chart.config.geoms = [name === 'heatmap' ? 'rect' : 'text'];
        chart.encodings.rows = [category]; chart.encodings.columns = [month]; chart.encodings.color = [value];
        if (name === 'text') chart.encodings.text = [value];
        chart.layout.colorPalette = 'redblue'; chart.layout.format = { numberFormat: ',.1f' };
        for (let c = 0; c < 3; c++) for (let m = 0; m < 4; m++) records.push({ __datumKey: `${name}:${c}:${m}`, Category: ['Furniture', 'Office', 'Technology'][c], Month: ['Jan', 'Feb', 'Mar', 'Apr'][m], Value: (c - 1) * 22 + m * 7.25 });
        description = name === 'heatmap' ? 'Band positions form cells; supplied values drive the continuous color legend.' : 'Each cell displays its supplied value with one decimal place.';
    } else if (name === 'scatter') {
        const x = add(mea('X'), 'number'), y = add(mea('Y'), 'number'), group = add(dim('Group'), 'string');
        const size = add(mea('Area'), 'number'), opacity = add(mea('Opacity'), 'number');
        chart.config.geoms = ['point']; chart.encodings.rows = [y]; chart.encodings.columns = [x];
        chart.encodings.color = [group]; chart.encodings.shape = [group]; chart.encodings.size = [size]; chart.encodings.opacity = [opacity];
        for (let i = 0; i < 12; i++) records.push({ __datumKey: `point:${i}`, X: i + 1, Y: 10 + (i * 7) % 23, Group: ['A', 'B', 'C'][i % 3], Area: 10 + i * 8, Opacity: 0.2 + (i % 5) * 0.2 });
        presentation = { ...presentation, resolvedScales: { size: { range: [20, 180] }, opacity: { domain: [0, 1], range: [0.15, 1] }, shape: { range: ['circle', 'square', 'diamond'] } } };
        description = 'The prepared Area controls point area; Group controls symbol and color; Opacity controls transparency.';
    } else if (name === 'interval') {
        const range = add(dim('Range', 'quantitative'), 'interval'), value = add(mea('Value'), 'number');
        chart.config.geoms = ['bar']; chart.encodings.rows = [value]; chart.encodings.columns = [range];
        for (const [index, interval] of [[0, 10], [10, 25], [25, 50]].entries()) records.push({ __datumKey: `interval:${index}`, Range: interval, Value: [20, 45, 30][index] });
        description = 'These interval endpoints were supplied by the host. Each bar uses its exact boundaries.';
    } else {
        const region = add(dim('Region'), 'string'), category = add(dim('Category'), 'string'), series = add(dim('Series'), 'string'), value = add(mea('Value'), 'number');
        chart.config.geoms = ['bar']; chart.encodings.rows = [region, value]; chart.encodings.columns = [category]; chart.encodings.color = [series];
        if (name === 'scope') chart.encodings.rows = [region, add(dim('District'), 'string'), value];
        const worksheet: NativeWorksheetLayout['worksheet'] = {};
        if (name === 'grouped' || name === 'scope') worksheet.barLayout = 'grouped';
        if (name === 'scope') worksheet.scaleScopes = { y: { mode: 'prefix', rowDepth: 1, columnDepth: 0 } };
        (chart.layout as typeof chart.layout & NativeWorksheetLayout).worksheet = worksheet;
        chart.layout.stack = name === 'stack' ? 'zero' : name === 'bar-normalize' ? 'normalize' : name === 'bar-center' ? 'center' : 'none'; chart.layout.format = { numberFormat: ',.0f', normalizedNumberFormat: '.0%' };
        for (let r = 0; r < 3; r++) for (let d = 0; d < (name === 'scope' ? 2 : 1); d++) for (let c = 0; c < 3; c++) for (let s = 0; s < 3; s++) records.push({
            __datumKey: `bar:${r}:${d}:${c}:${s}`, Region: ['East', 'West', 'Central'][r],
            ...(name === 'scope' ? { District: ['Local', 'Metro'][d] } : {}),
            Category: ['Office', 'Furniture', 'Technology'][c], Series: ['Online', 'Store', 'Partner'][s],
            Value: (s === 2 ? -1 : 1) * (10 + c * 6 + s * 5) * (name === 'scope' ? 10 ** r * (d ? 4 : 1) : r + 1),
        });
        description = name === 'bar-normalize' ? 'Each complete position stacks absolute magnitudes into 100%; selection retains the original signed values.' : name === 'bar-center' ? 'The supplied series stack around a shared centered baseline.' : name === 'stack' ? 'Positive and negative supplied values stack separately around zero.' : name === 'scope' ? 'Each Region has Local and Metro panes with different value ranges. Region prefix shares their axis; per pane fits each district; shared uses one domain across all six panes.' : 'Complete series order keeps grouped bar positions stable across panes.';
    }
    return { chart, records, columns, getDatumKey: (record) => String(record.__datumKey), presentation, description };
}
