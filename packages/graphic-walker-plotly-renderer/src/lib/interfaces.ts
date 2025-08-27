/**
 * Re-export interfaces from Graphic Walker
 * In a real implementation, these would come from the main graphic-walker package
 */

export interface IViewField {
    fid: string;
    name?: string;
    semanticType: 'quantitative' | 'nominal' | 'ordinal' | 'temporal';
    analyticType: 'dimension' | 'measure';
    aggName?: string;
    computed?: boolean;
    expression?: string;
    hideInChart?: boolean;
}

export interface IRow {
    [key: string]: any;
}

export type IStackMode = 'none' | 'stack' | 'normalize' | 'center';

export interface IChannelScales {
    color?: any;
    opacity?: any;
    size?: any;
}

export interface IConfigScaleSet {
    [key: string]: any;
}

export type IDarkMode = 'light' | 'dark' | any;

export interface VegaGlobalConfig {
    background?: string;
    [key: string]: any;
}

/**
 * Common renderer handler interface for exporting visualizations
 */
export interface IRendererHandler {
    getSVGData: () => Promise<string[]>;
    getCanvasData: () => Promise<string[]>;
    downloadSVG: (filename?: string) => Promise<string[]>;
    downloadPNG: (filename?: string) => Promise<string[]>;
}

/**
 * Base props that all renderers must implement
 */
export interface IRendererProps {
    name?: string;
    rows: readonly IViewField[];
    columns: readonly IViewField[];
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
    details?: readonly IViewField[];
    showActions: boolean;
    layoutMode: string;
    width: number;
    height: number;
    onGeomClick?: (values: any, e: any) => void;
    vegaConfig: VegaGlobalConfig;
    /** @default "en-US" */
    locale?: string;
    useSvg?: boolean;
    dark?: IDarkMode;
    scales?: IChannelScales;
    scale?: IConfigScaleSet;
    onReportSpec?: (spec: string) => void;
    displayOffset?: number;
}