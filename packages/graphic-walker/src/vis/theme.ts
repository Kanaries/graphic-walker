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
const DARK_COMMON_DESIGN = {
    background: 'transparent',
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
    },
    dark: DARK_COMMON_DESIGN,
} as const;

export const AntVTheme: GWGlobalConfig = {
    light: {
        area: { fill: DEFAULT_COLOR },
        bar: { fill: DEFAULT_COLOR },
        circle: { fill: DEFAULT_COLOR },
        line: { stroke: DEFAULT_COLOR },
        point: { stroke: DEFAULT_COLOR },
        rect: { fill: DEFAULT_COLOR },
        tick: { stroke: DEFAULT_COLOR },
        arc: { fill: DEFAULT_COLOR },
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
        tick: { stroke: DEFAULT_COLOR },
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
            tick: { stroke: defaultColor },
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
            tick: { stroke: defaultColor },
            boxplot: { fill: defaultColor },
            errorbar: { stroke: defaultColor },
            errorband: { fill: defaultColor },
            arc: { fill: defaultColor },
        },
    };
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
