import { COUNT_FIELD_ID } from '../../constants';
import { builders } from './builders';
import { IAutoVizChartType, IAutoVizRule } from './types';

const INF = Infinity;

/** canonical palette order, also the tie-breaker of effectiveness ranking */
export const AUTO_VIZ_CHART_ORDER: IAutoVizChartType[] = [
    'table',
    'highlight_table',
    'heatmap',
    'bar',
    'stacked_bar',
    'grouped_bar',
    'line',
    'area',
    'histogram',
    'scatter',
    'circle_view',
    'pie',
    'boxplot',
    'poi_map',
    'choropleth_map',
];

/**
 * The declarative Auto Viz rule table.
 *
 * `dim` / `mea` / `requires` implement the expressiveness filter (hard constraints):
 * a chart type is only offered when it can encode all selected fields without
 * fabricating facts. `score` implements the effectiveness ranking (soft ordering):
 * among legal candidates, position-encoding, intent-matching charts win.
 *
 * Score conventions — the champion of a typical intent scores in the 85–95 band:
 * - pure dimensions → table (90)
 * - single measure → histogram (90)
 * - two+ measures → scatter (93 alone / 84 with dimensions)
 * - temporal + measure → line (92)
 * - category + measure → bar (85 for the 1×1 case / 80 otherwise)
 * - geographic fields → maps (poi 95 so it beats scatter on a lon/lat pair, choropleth 86)
 * Weak-perception encodings (pie: angle, heatmap: color) stay in the 35–70 band
 * so they are offered but never become the default over a position-based chart.
 */
export const AUTO_VIZ_RULES: IAutoVizRule[] = [
    {
        chartType: 'table',
        dim: [0, INF],
        mea: [0, INF],
        score: (f) => (f.nMea === 0 ? 90 : 20),
        build: builders.table,
    },
    {
        chartType: 'highlight_table',
        dim: [1, INF],
        mea: [1, 1],
        score: () => 55,
        build: builders.highlight_table,
    },
    {
        chartType: 'heatmap',
        dim: [2, INF],
        mea: [0, 2],
        score: (f) => (f.nMea <= 1 ? 70 : 60),
        build: builders.heatmap,
    },
    {
        chartType: 'bar',
        dim: [1, INF],
        mea: [1, INF],
        score: (f) => (f.nDim === 1 && f.nMea === 1 ? 85 : 80),
        build: builders.bar,
    },
    {
        chartType: 'stacked_bar',
        dim: [2, INF],
        mea: [1, INF],
        score: () => 62,
        build: builders.stacked_bar,
    },
    {
        chartType: 'grouped_bar',
        dim: [2, INF],
        mea: [1, INF],
        score: () => 58,
        build: builders.grouped_bar,
    },
    {
        chartType: 'line',
        dim: [1, INF],
        mea: [1, INF],
        requires: ['temporal_or_ordinal'],
        score: (f) => (f.temporalDims.length > 0 ? 92 : 75),
        build: builders.line,
    },
    {
        chartType: 'area',
        dim: [1, INF],
        mea: [1, INF],
        requires: ['temporal'],
        score: () => 68,
        build: builders.area,
    },
    {
        chartType: 'histogram',
        dim: [0, 0],
        mea: [1, 1],
        check: (f) => (f.measures[0]?.fid === COUNT_FIELD_ID ? 'need_raw_measure' : null),
        score: () => 90,
        build: builders.histogram,
    },
    {
        chartType: 'scatter',
        dim: [0, INF],
        mea: [2, 4],
        score: (f) => (f.nDim === 0 ? 93 : 84),
        build: builders.scatter,
    },
    {
        chartType: 'circle_view',
        dim: [1, INF],
        mea: [1, INF],
        score: () => 45,
        build: builders.circle_view,
    },
    {
        chartType: 'pie',
        dim: [1, 2],
        mea: [1, 2],
        score: () => 35,
        build: builders.pie,
    },
    {
        chartType: 'boxplot',
        dim: [1, INF],
        mea: [1, INF],
        score: () => 48,
        build: builders.boxplot,
    },
    {
        chartType: 'poi_map',
        dim: [0, 2],
        mea: [0, INF],
        requires: ['lon_lat'],
        check: (f) => (f.nonGeoMeasures.length > 2 ? 'too_many_measures' : null),
        score: () => 95,
        build: builders.poi_map,
    },
    {
        chartType: 'choropleth_map',
        dim: [1, INF],
        mea: [0, 1],
        requires: ['geo_feature'],
        score: () => 86,
        build: builders.choropleth_map,
    },
];
