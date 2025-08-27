import { MutableRefObject } from 'react';
import { IRow, IViewField, IStackMode, VegaGlobalConfig, IChannelScales, IConfigScaleSet, IDarkMode } from '../interfaces';

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
    /** @default "en-US" */
    locale?: string;
    useSvg?: boolean;
    dark?: IDarkMode;
    scales?: IChannelScales;
    scale?: IConfigScaleSet;
    onReportSpec?: (spec: string) => void;
    displayOffset?: number;
}

/**
 * Renderer specification for transforming data and fields into visualization specs
 */
export interface IRendererSpec {
    /**
     * Transform Graphic Walker's data and field configuration into a renderer-specific specification
     */
    toSpec: (props: IRendererProps) => any | any[];
    
    /**
     * Optional: Validate if a spec is compatible with this renderer
     */
    validateSpec?: (spec: any) => boolean;
    
    /**
     * Optional: Convert from Vega-Lite spec to renderer-specific spec
     * This allows renderers to leverage existing Vega-Lite generation
     */
    fromVegaLite?: (spec: any) => any;
}

/**
 * Complete renderer configuration
 */
export interface IRenderer {
    /**
     * Unique identifier for the renderer
     */
    id: string;
    
    /**
     * Display name for the renderer
     */
    displayName: string;
    
    /**
     * React component that renders the visualization
     */
    component: React.ForwardRefExoticComponent<IRendererProps & React.RefAttributes<IRendererHandler>>;
    
    /**
     * Specification transformer
     */
    spec: IRendererSpec;
    
    /**
     * Optional: List of supported geometry types
     * If not provided, all geometry types are assumed to be supported
     */
    supportedGeomTypes?: string[];
    
    /**
     * Optional: List of supported features
     * e.g., ['facets', 'interactions', 'animations']
     */
    supportedFeatures?: string[];
}

/**
 * Renderer registry for managing custom renderers
 */
export interface IRendererRegistry {
    /**
     * Register a new renderer
     */
    register: (renderer: IRenderer) => void;
    
    /**
     * Get a renderer by ID
     */
    get: (id: string) => IRenderer | undefined;
    
    /**
     * Get all registered renderers
     */
    getAll: () => IRenderer[];
    
    /**
     * Check if a renderer is registered
     */
    has: (id: string) => boolean;
    
    /**
     * Unregister a renderer
     */
    unregister: (id: string) => void;
}