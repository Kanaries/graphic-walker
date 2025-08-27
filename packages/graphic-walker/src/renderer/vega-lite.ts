import { forwardRef } from 'react';
import ReactVega, { IReactVegaHandler } from '../vis/react-vega';
import { IRenderer, IRendererProps, IRendererHandler } from './interfaces';
import { toVegaSpec } from '../lib/vega';

/**
 * Vega-Lite renderer implementation
 */
export const VegaLiteRenderer: IRenderer = {
    id: 'vega-lite',
    displayName: 'Vega-Lite',
    
    // Use the existing ReactVega component with type casting
    component: ReactVega as any,
    
    spec: {
        toSpec: (props: IRendererProps) => {
            return toVegaSpec({
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
                mediaTheme: props.dark === 'dark' ? 'dark' : 'light',
                vegaConfig: props.vegaConfig,
                displayOffset: props.displayOffset,
            });
        }
    },
    
    supportedFeatures: [
        'facets',
        'interactions',
        'scales',
        'aggregations',
        'stacking',
        'brushing',
        'tooltips'
    ]
};