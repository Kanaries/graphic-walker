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
    text: {
        color: '#d1d5db',
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

const DANQING_COLOR = '#38699b';
const DANQING_COLOR_DARK = '#7fa8ce';
const DANQING_TITLE_FONT = '"Source Han Serif SC", "Songti SC", "Noto Serif SC", Georgia, serif';

/**
 * DanQing — inspired by traditional Chinese mineral pigment painting:
 * azurite blue as the primary, alternating warm and cool hues (vermilion, gamboge,
 * malachite, rouge) so adjacent categories stay distinguishable. The sequential ramp
 * runs moon-white to indigo-black, while the heatmap deliberately switches to a warm
 * paper-to-vermilion scale. Dotted grid lines and hollow points give an ink-outline feel.
 */
export const DanQingTheme: GWGlobalConfig = {
    light: {
        background: 'transparent',
        area: { fill: DANQING_COLOR },
        bar: { fill: DANQING_COLOR, binSpacing: 2 },
        circle: { fill: DANQING_COLOR },
        line: { stroke: DANQING_COLOR, strokeWidth: 2 },
        point: { stroke: DANQING_COLOR, strokeWidth: 1.5 },
        rect: { fill: DANQING_COLOR },
        tick: { fill: DANQING_COLOR },
        arc: { fill: DANQING_COLOR },
        boxplot: { ticks: true },
        title: { font: DANQING_TITLE_FONT, fontWeight: 600 },
        axis: {
            gridColor: '#e3ddcf',
            gridDash: [1, 3],
            domainColor: '#b3ac9c',
            tickColor: '#b3ac9c',
            labelColor: '#6e6a61',
            titleColor: '#4a453b',
        },
        legend: { labelColor: '#6e6a61', titleColor: '#4a453b' },
        header: { labelColor: '#6e6a61', titleColor: '#4a453b' },
        view: { stroke: '#e3ddcf' },
        range: {
            category: ['#38699b', '#d45e3c', '#d9a73e', '#4e8d74', '#7d5fa6', '#c05a78', '#64a6b8', '#9c6b3f', '#8e96cc', '#97a254'],
            diverging: ['#93321c', '#b04c2d', '#cb6a45', '#e19067', '#efbb9c', '#f2ede3', '#bcd0d4', '#8fb3bd', '#62909f', '#3c6c82', '#1f4a63'],
            heatmap: ['#faf6ed', '#f0e3c8', '#e5c99e', '#daa871', '#cc8250', '#b85c3b', '#9a3d2c', '#742a22', '#4c1d18'],
            ramp: ['#f4f8f8', '#deebea', '#c2d9da', '#9fc2c8', '#78a6b2', '#568a9c', '#3c6e86', '#28536d', '#183b52', '#0c2638'],
        },
        // scale for geo only
        scale: {
            continuous: { range: ['#deebea', '#28536d'] },
        },
    },
    dark: {
        background: 'transparent',
        area: { fill: DANQING_COLOR_DARK },
        bar: { fill: DANQING_COLOR_DARK, binSpacing: 2 },
        circle: { fill: DANQING_COLOR_DARK },
        line: { stroke: DANQING_COLOR_DARK, strokeWidth: 2 },
        point: { stroke: DANQING_COLOR_DARK, strokeWidth: 1.5 },
        rect: { fill: DANQING_COLOR_DARK },
        tick: { fill: DANQING_COLOR_DARK },
        arc: { fill: DANQING_COLOR_DARK },
        boxplot: {
            ticks: { fill: '#c9c2b4' },
            rule: { color: '#c9c2b4' },
        },
        title: { font: DANQING_TITLE_FONT, fontWeight: 600, color: '#ece5d8' },
        axis: {
            gridColor: '#3a362e',
            gridDash: [1, 3],
            domainColor: '#c9c2b4',
            tickColor: '#c9c2b4',
            labelColor: '#c9c2b4',
            titleColor: '#c9c2b4',
        },
        legend: { labelColor: '#c9c2b4', titleColor: '#c9c2b4' },
        header: { labelColor: '#c9c2b4', titleColor: '#c9c2b4' },
        text: { color: '#c9c2b4' },
        view: { stroke: '#3a362e' },
        range: {
            category: ['#7fa8ce', '#e68a66', '#e5c168', '#7cb89e', '#a98fcc', '#d98ba1', '#8fc6d4', '#c09468', '#aeb5de', '#b8c177'],
            diverging: ['#93321c', '#b04c2d', '#cb6a45', '#e19067', '#efbb9c', '#f2ede3', '#bcd0d4', '#8fb3bd', '#62909f', '#3c6c82', '#1f4a63'],
            heatmap: ['#4c1d18', '#742a22', '#9a3d2c', '#b85c3b', '#cc8250', '#daa871', '#e5c99e', '#f0e3c8', '#faf6ed'],
            ramp: ['#0c2638', '#183b52', '#28536d', '#3c6e86', '#568a9c', '#78a6b2', '#9fc2c8', '#c2d9da', '#deebea', '#f4f8f8'],
        },
        // scale for geo only
        scale: {
            continuous: { range: ['#183b52', '#c2d9da'] },
        },
    },
};

const SODAPOP_COLOR = '#f4636e';
const SODAPOP_COLOR_DARK = '#ff8a8f';

/**
 * Soda Pop — candy-bright hues at uniform lightness: watermelon, mint, lemon,
 * grape, soda blue. The sequential ramp runs cream to grape, and the heatmap is a
 * lemon-watermelon-grape sunset scale. Rounded bars, thicker lines and filled points
 * keep every mark soft and playful. Dark mode brightens each hue into neon candy.
 * Note: point config must not set a stroke here — the color encoding only overrides
 * fill on filled points, so a config-level stroke would stick on every scatter point.
 */
export const SodaPopTheme: GWGlobalConfig = {
    light: {
        background: 'transparent',
        area: { fill: SODAPOP_COLOR },
        bar: { fill: SODAPOP_COLOR, binSpacing: 5, cornerRadiusEnd: 4 },
        circle: { fill: SODAPOP_COLOR },
        line: { stroke: SODAPOP_COLOR, strokeWidth: 2.5 },
        point: { filled: true, fill: SODAPOP_COLOR, size: 45 },
        rect: { fill: SODAPOP_COLOR },
        tick: { fill: SODAPOP_COLOR },
        arc: { fill: SODAPOP_COLOR },
        boxplot: { ticks: true },
        axis: {
            gridColor: '#eef0f4',
            domainColor: '#d8dce4',
            tickColor: '#d8dce4',
            labelColor: '#5a6172',
            titleColor: '#5a6172',
        },
        legend: { labelColor: '#5a6172', titleColor: '#5a6172' },
        header: { labelColor: '#5a6172', titleColor: '#5a6172' },
        view: { stroke: '#eef0f4' },
        range: {
            category: ['#f4636e', '#35c4b5', '#ffc145', '#7b61ff', '#3d9bf5', '#71c24f', '#ff9052', '#ef6ec0', '#2c9c6e', '#8d96a8'],
            diverging: ['#b3253a', '#d24e56', '#ea7a78', '#f8a79e', '#fdd3c8', '#f3f1ee', '#c9e0fb', '#9ac4f5', '#6ba5ec', '#3d83db', '#1d5fbf'],
            heatmap: ['#fff3c9', '#ffde8a', '#ffc145', '#ff9052', '#f4636e', '#d6407e', '#a82f8b', '#712a86', '#43206b'],
            ramp: ['#f6f4ff', '#e5deff', '#cfc2ff', '#b5a3ff', '#9a82fb', '#7f63ee', '#654ad5', '#4c35b2', '#352387', '#20155c'],
        },
        // scale for geo only
        scale: {
            continuous: { range: ['#e5deff', '#4c35b2'] },
        },
    },
    dark: {
        background: 'transparent',
        area: { fill: SODAPOP_COLOR_DARK },
        bar: { fill: SODAPOP_COLOR_DARK, binSpacing: 5, cornerRadiusEnd: 4 },
        circle: { fill: SODAPOP_COLOR_DARK },
        line: { stroke: SODAPOP_COLOR_DARK, strokeWidth: 2.5 },
        point: { filled: true, fill: SODAPOP_COLOR_DARK, size: 45 },
        rect: { fill: SODAPOP_COLOR_DARK },
        tick: { fill: SODAPOP_COLOR_DARK },
        arc: { fill: SODAPOP_COLOR_DARK },
        boxplot: {
            ticks: { fill: '#b9becc' },
            rule: { color: '#b9becc' },
        },
        title: { color: '#eceef5' },
        axis: {
            gridColor: '#2b2d3a',
            domainColor: '#b9becc',
            tickColor: '#b9becc',
            labelColor: '#b9becc',
            titleColor: '#b9becc',
        },
        legend: { labelColor: '#b9becc', titleColor: '#b9becc' },
        header: { labelColor: '#b9becc', titleColor: '#b9becc' },
        text: { color: '#b9becc' },
        view: { stroke: '#2b2d3a' },
        range: {
            category: ['#ff8a8f', '#5bd9c9', '#ffd06e', '#9c88ff', '#6fb6ff', '#93d46f', '#ffab7a', '#f794d4', '#57bf92', '#a3acbe'],
            diverging: ['#b3253a', '#d24e56', '#ea7a78', '#f8a79e', '#fdd3c8', '#f3f1ee', '#c9e0fb', '#9ac4f5', '#6ba5ec', '#3d83db', '#1d5fbf'],
            heatmap: ['#43206b', '#712a86', '#a82f8b', '#d6407e', '#f4636e', '#ff9052', '#ffc145', '#ffde8a', '#fff3c9'],
            ramp: ['#20155c', '#352387', '#4c35b2', '#654ad5', '#7f63ee', '#9a82fb', '#b5a3ff', '#cfc2ff', '#e5deff', '#f6f4ff'],
        },
        // scale for geo only
        scale: {
            continuous: { range: ['#352387', '#cfc2ff'] },
        },
    },
};

export const builtInThemes: { [themeKey: string]: { light: VegaGlobalConfig; dark: VegaGlobalConfig } } = {
    vega: VegaTheme,
    g2: AntVTheme,
    streamlit: StreamlitTheme as unknown as GWGlobalConfig,
    danqing: DanQingTheme,
    sodapop: SodaPopTheme,
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
