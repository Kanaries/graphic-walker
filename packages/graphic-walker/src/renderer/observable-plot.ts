import ObservablePlotRenderer from '../vis/observable-plot-renderer';
import { IRenderer, IRendererProps } from './interfaces';
import { toObservablePlotSpec } from '../lib/observablePlot';

/**
 * Observable Plot renderer implementation
 */
export const ObservablePlotRendererConfig: IRenderer = {
    id: 'observable-plot',
    displayName: 'Observable Plot',
    
    // Use the existing ObservablePlotRenderer component
    component: ObservablePlotRenderer as any,
    
    spec: {
        toSpec: (props: IRendererProps) => {
            return toObservablePlotSpec({
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
        },
        
        fromVegaLite: (spec: any) => {
            // Use the existing vegaLiteToPlot function
            const { __test__vegaLiteToPlot } = require('../lib/observablePlot');
            return __test__vegaLiteToPlot(spec);
        }
    },
    
    supportedFeatures: [
        'facets',
        'scales',
        'aggregations',
        'stacking',
        'tooltips'
    ]
};