import { DraggableFieldState, ICoordMode, IStackMode, IVisualConfig } from "./interfaces";

export const GEOM_TYPES: Record<ICoordMode, Readonly<string[]>> = {
    generic: [
        'auto',
        'bar',
        'line',
        'area',
        'trail',
        'point',
        'circle',
        'tick',
        'rect',
        'arc',
        'text',
        'boxplot',
        'table',
    ],
    geographic: [
        'poi',
        'choropleth',
    ],
} as const;

export const COORD_TYPES: Readonly<ICoordMode[]> = [
    'generic',
    'geographic',
];

export const STACK_MODE: Readonly<IStackMode[]> = [
    'none',
    'stack',
    'normalize',
    'center'
]

export const CHART_LAYOUT_TYPE: Readonly<string[]> = [
    'auto',
    'fixed',
] as const;

export const COLORS = {
    // tableau style
    // dimension: 'rgb(73, 150, 178)',
    // measure: 'rgb(0, 177, 128)',
    // dimension: 'rgb(86, 170, 208)',
    // measure: 'rgb(232, 149, 72)'
    dimension: 'rgba(0, 0, 0, 0.9)',
    measure: 'rgba(10, 0, 0, 0.6)',
    black: '#141414',
    white: '#fafafa'
}

export const MAX_HISTORY_SIZE = 20;

export const CHANNEL_LIMIT = {
    rows: Infinity,
    columns: Infinity,
    color: 1,
    opacity: 1,
    size: 1,
    shape: 1,
    theta: 1,
    radius: 1,
    details: Infinity,
    text: 1,
}

export const MetaFieldKeys: Array<keyof DraggableFieldState> = [
    'dimensions',
    'measures',
]

export const PositionChannelConfigList: Array<keyof IVisualConfig['resolve']> = [
    'x',
    'y',
]

export const NonPositionChannelConfigList: Array<keyof IVisualConfig['resolve']> = [
    'color',
    'opacity',
    'shape',
    'size'
]