import PlotlyRenderer from './plotly-renderer';
import { vegaLiteToPlotly } from './vega-to-plotly';
import { toVegaSpec } from './vega-spec';
import type { IRendererHandler, IRendererProps } from './interfaces';

/**
 * Plotly renderer configuration for Graphic Walker
 */
export const PlotlyRendererConfig = {
    id: 'plotly',
    displayName: 'Plotly.js',
    component: PlotlyRenderer,
    spec: {
        toSpec: (props: IRendererProps) => {
            // Generate Vega-Lite spec
            const vegaLiteSpecs = toVegaSpec({
                rows: props.rows,
                columns: props.columns,
                color: props.color,
                opacity: props.opacity,
                size: props.size,
                shape: props.shape,
                theta: props.theta,
                radius: props.radius,
                text: props.text,
                details: props.details || [],
                interactiveScale: props.interactiveScale,
                dataSource: props.dataSource,
                layoutMode: props.layoutMode,
                width: props.width,
                height: props.height,
                defaultAggregated: props.defaultAggregate || false,
                geomType: props.geomType,
                stack: props.stack,
                scales: props.scales,
                mediaTheme: (typeof props.dark === 'string' && props.dark === 'dark') ? 'dark' : 'light',
                vegaConfig: props.vegaConfig,
                displayOffset: props.displayOffset,
            });

            // Transform to Plotly
            return vegaLiteSpecs.map(spec => vegaLiteToPlotly(spec));
        },
        
        fromVegaLite: vegaLiteToPlotly,
    },
    
    supportedGeomTypes: [
        'point',
        'circle',
        'line',
        'area',
        'bar',
        'rect',
        'arc',
        'text',
        'boxplot',
    ],
    
    supportedFeatures: [
        'basic-charts',
        'color-encoding',
        'size-encoding',
        'stacking',
        'tooltips',
        'interactions',
        'export',
    ],
};

// Export the renderer component and utilities
export { PlotlyRenderer };
export { vegaLiteToPlotly };
export { toVegaSpec };
export type { IRendererHandler, IRendererProps };

// Default export for easy registration
export default PlotlyRendererConfig;