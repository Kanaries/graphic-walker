import { useSyncExternalStore, type ComponentType, type Ref } from 'react';
import type { IChart, IComputationFunction, IRenderStatus, IViewField } from '../interfaces';

/**
 * What the editor hands to the native worksheet renderer: the chart as stored, every
 * field of the dataset including computed ones, and the function that runs queries.
 * The renderer plans its own queries, so it gets no prepared view data.
 */
export interface NativeRendererProps {
    chart: IChart;
    fields: IViewField[];
    computation: IComputationFunction;
    /**
     * The chart colors the editor's other renderers would use for this chart: its theme preset
     * with the chart's own primary color and palette applied, for the current light or dark mode.
     */
    colors: NativeRendererColors;
    /** The editor's interface language, such as 'en-US' or 'zh-CN'. */
    locale: string;
    /**
     * Report that this chart cannot be drawn after all, for a reason `canDraw` could not see
     * in the chart alone, such as a query that fails or values of a kind the renderer does
     * not handle. The editor then draws the chart with its own renderer.
     */
    onUnsupported: (reason: string) => void;
    /** Where the renderer puts its export functions, for the toolbar's image and CSV buttons. */
    handle?: Ref<NativeRendererHandle>;
    /** Where the chart stands: querying, painting, done, or failed. Drives the loading layer and the host's render status. */
    onStatusChange?: (status: IRenderStatus) => void;
    /**
     * A mark was clicked. `mark` holds the value of every dimension that identifies it, by field id,
     * as stored in the data. The editor opens its menu at the event's position.
     */
    onMarkClick?: (mark: Record<string, unknown>, event: MouseEvent) => void;
}

/** Each function rejects or throws while the chart is still loading. */
export interface NativeRendererHandle {
    /** The whole chart as SVG text. */
    exportSVG(): Promise<string>;
    /** The whole chart as a PNG data URL. */
    exportPNG(): Promise<string>;
    /** The records behind the marks as comma-separated text with a header line. */
    exportCSV(): string;
    /** Size of the whole chart in CSS px. */
    size(): { width: number; height: number };
}

export interface NativeRendererColors {
    dark: boolean;
    /** Color of marks without a color field. */
    primary: string;
    /** Colors for the members of a dimension on color. */
    category: string[];
    /** Stops for a measure on color. */
    ramp: string[];
    /** Stops for a measure on color whose range crosses zero, when the theme has them. */
    diverging?: string[];
    /** Stops for heat map cells, when the theme has them. */
    heatmap?: string[];
    /** The chart's own background, when the user set one. */
    background?: string;
}

export interface NativeRenderer {
    component: ComponentType<NativeRendererProps>;
    /**
     * Whether the renderer can draw this chart. A chart it cannot draw, such as a text
     * table or a pie, goes to the renderers that already handle it instead of showing an error.
     */
    canDraw(chart: IChart): boolean;
}

// The native renderer is a preview that lives outside this package's sources. Whoever
// hosts the editor registers it; until then `layout.renderer: 'native'` is not offered
// and charts that ask for it fall back to the default renderer.
let registered: NativeRenderer | undefined;
const listeners = new Set<() => void>();

export function registerNativeRenderer(renderer: NativeRenderer | undefined) {
    registered = renderer;
    listeners.forEach((listener) => listener());
}
const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};
const current = () => registered;
export const useNativeRenderer = () => useSyncExternalStore(subscribe, current, current);
