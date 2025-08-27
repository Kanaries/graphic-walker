import { ComponentType } from 'react';
import {
    IViewField,
    IRow,
    IStackMode,
    VegaGlobalConfig,
    IChannelScales,
    IConfigScaleSet,
} from '../interfaces';

export interface RendererProps {
    name?: string;
    rows: Readonly<IViewField[]>;
    columns: Readonly<IViewField[]>;
    dataSource: readonly IRow[];
    defaultAggregate?: boolean;
    stack: IStackMode;
    interactiveScale: boolean;
    geomType: string;
    color?: IViewField;
    opacity?: IViewField;
    size?: IViewField;
    shape?: IViewField;
    theta?: IViewField;
    radius?: IViewField;
    text?: IViewField;
    details?: Readonly<IViewField[]>;
    showActions: boolean;
    layoutMode: string;
    width: number;
    height: number;
    onGeomClick?: (values: any, e: any) => void;
    vegaConfig: VegaGlobalConfig;
    locale?: string;
    useSvg?: boolean;
    scales?: IChannelScales;
    scale?: IConfigScaleSet;
    onReportSpec?: (spec: string) => void;
    displayOffset?: number;
}

const registry: Record<string, ComponentType<RendererProps>> = {};

export function registerRenderer(name: string, renderer: ComponentType<RendererProps>) {
    registry[name] = renderer;
}

export function getRenderer(name: string) {
    return registry[name];
}

export function getRendererList() {
    return Object.keys(registry);
}

export function registerDefaultRenderers() {
    try {
        const ReactVega = require('../vis/react-vega').default;
        registerRenderer('vega-lite', ReactVega as ComponentType<RendererProps>);
    } catch {
        // ignore in non-browser environments
    }
    try {
        const ObservablePlotRenderer = require('@/vis/observable-plot-renderer').default;
        registerRenderer('observable-plot', ObservablePlotRenderer as ComponentType<RendererProps>);
    } catch {
        // ignore in non-browser environments
    }
}
