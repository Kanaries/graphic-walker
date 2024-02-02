import { VegaGlobalConfig } from '../interfaces';

export type GWGlobalConfig<
    T extends VegaGlobalConfig = VegaGlobalConfig & {
        scale?: {
            continuous: {
                range: string[];
            };
        };
    }
> = {
    light: T;
    dark: T;
};

export const DEFAULT_COLOR = '#5B8FF9';
const DARK_COMMON_DESIGN: GWGlobalConfig['dark'] = {
    background: 'transparent',
    boxplot: {
        ticks: {
            fill: '#d1d5db', // change tick color to white
        },
        rule: {
            color: '#d1d5db', // change rule color to white
        },
    },
    header: {
        titleColor: '#d1d5db', // change title color to white
        labelColor: '#d1d5db', // change label color to white
    },
    axis: {
        gridColor: '#666',
        domainColor: '#d1d5db', // change axis color to white
        tickColor: '#d1d5db', // change tick color to white
        labelColor: '#d1d5db', // change label color to white
        titleColor: '#d1d5db', // change title color to white
    },
    legend: {
        labelColor: '#d1d5db', // change legend label color to white
        titleColor: '#d1d5db', // change legend title color to white
    },
    view: {
        stroke: '#666',
    },
};

export const VegaTheme = {
    light: {
        background: 'transparent',
        boxplot: { ticks: true },
    },
    dark: DARK_COMMON_DESIGN,
} as const;

/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
export const StreamlitTheme = {
    light: {
        font: 'sans-serif',
        background: 'transparent',
        fieldTitle: 'verbal',
        title: {
            align: 'left',
            anchor: 'start',
            color: '#31333F',
            titleFontStyle: 'normal',
            fontWeight: 600,
            fontSize: 16,
            orient: 'top',
            offset: 26,
        },
        header: {
            titleFontWeight: 400,
            titleFontSize: 16,
            titleColor: '#808495',
            titleFontStyle: 'normal',
            labelFontSize: 12,
            labelFontWeight: 400,
            labelColor: '#808495',
            labelFontStyle: 'normal',
        },
        axis: {
            labelFontSize: 12,
            labelFontWeight: 400,
            labelColor: '#808495',
            labelFontStyle: 'normal',
            titleFontWeight: 400,
            titleFontSize: 14,
            titleColor: '#808495',
            titleFontStyle: 'normal',
            ticks: false,
            gridColor: '#e6eaf1',
            domain: false,
            domainWidth: 1,
            domainColor: '#e6eaf1',
            labelFlush: true,
            labelFlushOffset: 1,
            labelBound: false,
            labelLimit: 100,
            titlePadding: 16,
            labelPadding: 16,
            labelSeparation: 4,
            labelOverlap: true,
        },
        legend: {
            labelFontSize: 14,
            labelFontWeight: 400,
            labelColor: '#808495',
            titleFontSize: 14,
            titleFontWeight: 400,
            titleFontStyle: 'normal',
            titleColor: '#808495',
            titlePadding: 5,
            labelPadding: 16,
            columnPadding: 8,
            rowPadding: 4,
            padding: 7,
            symbolStrokeWidth: 4,
        },
        range: {
            category: ['#0068c9', '#83c9ff', '#ff2b2b', '#ffabab', '#29b09d', '#7defa1', '#ff8700', '#ffd16a', '#6d3fc0', '#d5dae5'],
            diverging: ['#7d353b', '#bd4043', '#ff4b4b', '#ff8c8c', '#ffc7c7', '#a6dcff', '#60b4ff', '#1c83e1', '#0054a3', '#004280'],
            ramp: ['#e4f5ff', '#c7ebff', '#a6dcff', '#83c9ff', '#60b4ff', '#3d9df3', '#1c83e1', '#0068c9', '#0054a3', '#004280'],
            heatmap: ['#e4f5ff', '#c7ebff', '#a6dcff', '#83c9ff', '#60b4ff', '#3d9df3', '#1c83e1', '#0068c9', '#0054a3', '#004280'],
        },
        view: {
            columns: 1,
            strokeWidth: 0,
            stroke: 'transparent',
            continuousHeight: 350,
            continuousWidth: 400,
        },
        concat: { columns: 1 },
        facet: { columns: 1 },
        mark: { tooltip: true, color: '#0068C9' },
        bar: { binSpacing: 4, discreteBandSize: { band: 0.85 } },
        boxplot: { ticks: true },
        axisDiscrete: { grid: false },
        axisXPoint: { grid: false },
        axisTemporal: { grid: false },
        axisXBand: { grid: false },
    },
    dark: {
        font: 'sans-serif',
        background: 'transparent',
        fieldTitle: 'verbal',
        title: {
            align: 'left',
            anchor: 'start',
            color: '#fafafa',
            titleFontStyle: 'normal',
            fontWeight: 600,
            fontSize: 16,
            orient: 'top',
            offset: 26,
        },
        header: {
            titleFontWeight: 400,
            titleFontSize: 16,
            titleColor: '#e6eaf1',
            titleFontStyle: 'normal',
            labelFontSize: 12,
            labelFontWeight: 400,
            labelColor: '#e6eaf1',
            labelFontStyle: 'normal',
        },
        axis: {
            labelFontSize: 12,
            labelFontWeight: 400,
            labelColor: '#e6eaf1',
            labelFontStyle: 'normal',
            titleFontWeight: 400,
            titleFontSize: 14,
            titleColor: '#e6eaf1',
            titleFontStyle: 'normal',
            ticks: false,
            gridColor: '#31333F',
            domain: false,
            domainWidth: 1,
            domainColor: '#31333F',
            labelFlush: true,
            labelFlushOffset: 1,
            labelBound: false,
            labelLimit: 100,
            titlePadding: 16,
            labelPadding: 16,
            labelSeparation: 4,
            labelOverlap: true,
        },
        legend: {
            labelFontSize: 14,
            labelFontWeight: 400,
            labelColor: '#e6eaf1',
            titleFontSize: 14,
            titleFontWeight: 400,
            titleFontStyle: 'normal',
            titleColor: '#e6eaf1',
            titlePadding: 5,
            labelPadding: 16,
            columnPadding: 8,
            rowPadding: 4,
            padding: 7,
            symbolStrokeWidth: 4,
        },
        range: {
            category: ['#83c9ff', '#0068c9', '#ffabab', '#ff2b2b', '#7defa1', '#29b09d', '#ffd16a', '#ff8700', '#6d3fc0', '#d5dae5'],
            diverging: ['#7d353b', '#bd4043', '#ff4b4b', '#ff8c8c', '#ffc7c7', '#a6dcff', '#60b4ff', '#1c83e1', '#0054a3', '#004280'],
            ramp: ['#004280', '#0054a3', '#0068c9', '#1c83e1', '#3d9df3', '#60b4ff', '#83c9ff', '#a6dcff', '#c7ebff', '#e4f5ff'],
            heatmap: ['#004280', '#0054a3', '#0068c9', '#1c83e1', '#3d9df3', '#60b4ff', '#83c9ff', '#a6dcff', '#c7ebff', '#e4f5ff'],
        },
        view: {
            columns: 1,
            strokeWidth: 0,
            stroke: 'transparent',
            continuousHeight: 350,
            continuousWidth: 400,
        },
        boxplot: {
            ticks: {
                fill: '#e6eaf1',
            },
            rule: {
                color: '#e6eaf1',
            },
        },
        concat: { columns: 1 },
        facet: { columns: 1 },
        mark: { tooltip: true, color: '#83C9FF' },
        bar: { binSpacing: 4, discreteBandSize: { band: 0.85 } },
        axisDiscrete: { grid: false },
        axisXPoint: { grid: false },
        axisTemporal: { grid: false },
        axisXBand: { grid: false },
    },
};

export const AntVTheme: GWGlobalConfig = {
    light: {
        area: { fill: DEFAULT_COLOR },
        bar: { fill: DEFAULT_COLOR },
        circle: { fill: DEFAULT_COLOR },
        line: { stroke: DEFAULT_COLOR },
        point: { stroke: DEFAULT_COLOR },
        rect: { fill: DEFAULT_COLOR },
        tick: { fill: DEFAULT_COLOR },
        arc: { fill: DEFAULT_COLOR },
        boxplot: { ticks: true },
        background: 'transparent',
        range: {
            category: ['#5B8FF9', '#61DDAA', '#65789B', '#F6BD16', '#7262FD', '#78D3F8', '#9661BC', '#F6903D', '#008685', '#F08BB4'],
            diverging: ['#7b3294', '#c2a5cf', '#f7f7f7', '#a6dba0', '#008837'],
            heatmap: ['#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786', '#d8576b', '#ed7953', '#fb9f3a', '#fdca26', '#f0f921'],
            ramp: ['#EBCCFF', '#CCB0FF', '#AE95FF', '#907BFF', '#7262FD', '#5349E0', '#2F32C3', '#001BA7', '#00068C'],
        },
        // scale for geo only
        scale: {
            continuous: { range: ['#d4d4e8', '#3b196f'] },
        },
    },
    dark: {
        ...DARK_COMMON_DESIGN,
        area: { fill: DEFAULT_COLOR },
        bar: { fill: DEFAULT_COLOR },
        circle: { fill: DEFAULT_COLOR },
        line: { stroke: DEFAULT_COLOR },
        point: { stroke: DEFAULT_COLOR },
        rect: { fill: DEFAULT_COLOR },
        tick: { fill: DEFAULT_COLOR },
        arc: { fill: DEFAULT_COLOR },
        range: {
            category: ['#5B8FF9', '#61DDAA', '#65789B', '#F6BD16', '#7262FD', '#78D3F8', '#9661BC', '#F6903D', '#008685', '#F08BB4'],
            diverging: ['#7b3294', '#c2a5cf', '#f7f7f7', '#a6dba0', '#008837'],
            heatmap: ['#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786', '#d8576b', '#ed7953', '#fb9f3a', '#fdca26', '#f0f921'],
            ramp: ['#EBCCFF', '#CCB0FF', '#AE95FF', '#907BFF', '#7262FD', '#5349E0', '#2F32C3', '#001BA7', '#00068C'],
        },
        // scale for geo only
        scale: {
            continuous: { range: ['#d4d4e8', '#3b196f'] },
        },
    },
};

export const builtInThemes: { [themeKey: string]: { light: VegaGlobalConfig; dark: VegaGlobalConfig } } = {
    vega: VegaTheme,
    g2: AntVTheme,
    streamlit: StreamlitTheme as unknown as GWGlobalConfig,
};

export const getPrimaryColor = (defaultColor: string) => {
    return {
        light: {
            area: { fill: defaultColor },
            bar: { fill: defaultColor },
            circle: { fill: defaultColor },
            line: { stroke: defaultColor },
            point: { stroke: defaultColor },
            rect: { fill: defaultColor },
            tick: { fill: defaultColor },
            boxplot: { fill: defaultColor },
            errorbar: { stroke: defaultColor },
            errorband: { fill: defaultColor },
            arc: { fill: defaultColor },
            background: 'transparent',
        },
        dark: {
            ...DARK_COMMON_DESIGN,
            area: { fill: defaultColor },
            bar: { fill: defaultColor },
            circle: { fill: defaultColor },
            line: { stroke: defaultColor },
            point: { stroke: defaultColor },
            rect: { fill: defaultColor },
            tick: { fill: defaultColor },
            boxplot: { fill: defaultColor },
            errorbar: { stroke: defaultColor },
            errorband: { fill: defaultColor },
            arc: { fill: defaultColor },
        },
    } as unknown as GWGlobalConfig;
};

export const getColorPalette = (palette: string) => ({
    light: {
        range: {
            category: { scheme: palette },
            diverging: { scheme: palette },
            heatmap: { scheme: palette },
            ordinal: { scheme: palette },
            ramp: { scheme: palette },
        },
    },
    dark: {
        range: {
            category: { scheme: palette },
            diverging: { scheme: palette },
            heatmap: { scheme: palette },
            ordinal: { scheme: palette },
            ramp: { scheme: palette },
        },
    },
});
