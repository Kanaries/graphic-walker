import type { ReactNode, Ref } from 'react';
import type { DraggableFieldState, IChannelScales, IRendererPlugin, IRow, IThemeKey, IVisualConfigNew, IVisualLayout, VegaGlobalConfig } from '../../interfaces';
import type { GWGlobalConfig } from '../../vis/theme';
import type { IReactVegaHandler } from '../../vis/react-vega';

export interface RendererPluginProps {
    name?: string;
    data: IRow[];
    draggableFieldState: DraggableFieldState;
    visualConfig: IVisualConfigNew;
    layout: IVisualLayout;
    vizThemeConfig?: IThemeKey | GWGlobalConfig;
    locale?: string;
    onGeomClick?: (values: any, e: any) => void;
    onChartResize?: (width: number, height: number) => void;
    scales?: IChannelScales;
    onReportSpec?: (spec: string) => void;
    disableCollapse?: boolean;
    vegaConfig: VegaGlobalConfig;
    rendererRef?: Ref<IReactVegaHandler>;
    chartWidth: number;
    chartHeight: number;
}

export interface RendererPlugin extends Omit<IRendererPlugin, 'canRender' | 'render'> {
    canRender?: (props: RendererPluginProps) => boolean;
    render: (props: RendererPluginProps) => ReactNode;
}
