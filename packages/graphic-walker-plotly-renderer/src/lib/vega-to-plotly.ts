/**
 * Transform Vega-Lite specification to Plotly specification
 */

export interface PlotlySpec {
    data: any[];
    layout: any;
    config: any;
}

/**
 * Map Vega-Lite mark types to Plotly trace types
 */
const markToPlotlyType: Record<string, string> = {
    'point': 'scatter',
    'circle': 'scatter',
    'square': 'scatter',
    'line': 'scatter',
    'area': 'scatter',
    'bar': 'bar',
    'rect': 'bar',
    'arc': 'pie',
    'text': 'scatter',
    'tick': 'scatter',
    'rule': 'scatter',
    'boxplot': 'box',
};

/**
 * Map Vega-Lite shape values to Plotly marker symbols
 */
const shapeToPlotlySymbol: Record<string, string> = {
    'circle': 'circle',
    'square': 'square',
    'cross': 'cross',
    'diamond': 'diamond',
    'triangle-up': 'triangle-up',
    'triangle-down': 'triangle-down',
    'triangle-left': 'triangle-left',
    'triangle-right': 'triangle-right',
    'pentagon': 'pentagon',
    'hexagon': 'hexagon',
    'star': 'star',
};

/**
 * Transform a Vega-Lite specification to Plotly specification
 */
export function vegaLiteToPlotly(vegaSpec: any): PlotlySpec {
    if (!vegaSpec) {
        return {
            data: [],
            layout: {},
            config: {},
        };
    }

    const data = vegaSpec.data?.values || [];
    const encoding = vegaSpec.encoding || {};
    let markType = vegaSpec.mark;
    
    // Handle mark as object
    if (typeof markType === 'object' && markType.type) {
        markType = markType.type;
    }

    // Extract field mappings
    const xField = encoding.x?.field;
    const yField = encoding.y?.field;
    const colorField = encoding.color?.field;
    const sizeField = encoding.size?.field;
    const textField = encoding.text?.field;
    const shapeField = encoding.shape?.field;
    
    // Determine Plotly trace type
    const plotlyType = markToPlotlyType[markType] || 'scatter';
    
    // Create base trace
    const trace: any = {
        type: plotlyType,
    };

    // Handle different mark types
    switch (markType) {
        case 'point':
        case 'circle':
        case 'square':
            trace.mode = 'markers';
            trace.marker = {
                size: sizeField ? data.map((d: any) => d[sizeField]) : 10,
                symbol: markType === 'square' ? 'square' : 'circle',
            };
            break;
            
        case 'line':
            trace.mode = 'lines';
            // Sort data by x for proper line connection
            if (xField) {
                const sortedData = [...data].sort((a, b) => {
                    if (encoding.x?.type === 'temporal') {
                        return new Date(a[xField]).getTime() - new Date(b[xField]).getTime();
                    }
                    return a[xField] - b[xField];
                });
                data.splice(0, data.length, ...sortedData);
            }
            break;
            
        case 'area':
            trace.mode = 'lines';
            trace.fill = 'tozeroy';
            // Sort data by x for proper area connection
            if (xField) {
                const sortedData = [...data].sort((a, b) => {
                    if (encoding.x?.type === 'temporal') {
                        return new Date(a[xField]).getTime() - new Date(b[xField]).getTime();
                    }
                    return a[xField] - b[xField];
                });
                data.splice(0, data.length, ...sortedData);
            }
            break;
            
        case 'bar':
            // Handle horizontal vs vertical bars
            if (encoding.x?.type === 'quantitative' && encoding.y?.type !== 'quantitative') {
                trace.orientation = 'h';
            }
            break;
            
        case 'arc':
            trace.type = 'pie';
            trace.labels = xField ? data.map((d: any) => d[xField]) : undefined;
            trace.values = yField ? data.map((d: any) => d[yField]) : undefined;
            break;
            
        case 'text':
            trace.mode = 'text';
            trace.text = textField ? data.map((d: any) => d[textField]) : data.map((d: any) => d[yField] || d[xField]);
            trace.textposition = 'middle center';
            break;
            
        case 'boxplot':
            trace.type = 'box';
            trace.y = yField ? data.map((d: any) => d[yField]) : undefined;
            trace.name = xField ? data[0]?.[xField] : undefined;
            break;
    }

    // Set x and y data (except for pie charts)
    if (markType !== 'arc') {
        if (xField) {
            trace.x = data.map((d: any) => d[xField]);
        }
        if (yField) {
            trace.y = data.map((d: any) => d[yField]);
        }
    }

    // Handle color encoding
    if (colorField) {
        const uniqueColors = Array.from(new Set(data.map((d: any) => d[colorField])));
        
        // If categorical, split into multiple traces
        if (encoding.color?.type === 'nominal' || encoding.color?.type === 'ordinal') {
            const traces = uniqueColors.map(colorValue => {
                const filteredData = data.filter((d: any) => d[colorField] === colorValue);
                const newTrace = { ...trace };
                
                if (xField) {
                    newTrace.x = filteredData.map((d: any) => d[xField]);
                }
                if (yField) {
                    newTrace.y = filteredData.map((d: any) => d[yField]);
                }
                
                newTrace.name = String(colorValue);
                
                // Preserve marker settings
                if (trace.marker) {
                    newTrace.marker = { ...trace.marker };
                    if (sizeField) {
                        newTrace.marker.size = filteredData.map((d: any) => d[sizeField]);
                    }
                }
                
                return newTrace;
            });
            
            return createPlotlySpec(traces, vegaSpec);
        } else {
            // For continuous color scales
            if (trace.marker) {
                trace.marker.color = data.map((d: any) => d[colorField]);
                trace.marker.colorscale = 'Viridis';
                trace.marker.showscale = true;
            }
        }
    }

    // Handle stacking
    if (encoding.y?.stack || encoding.x?.stack) {
        const stackDirection = encoding.y?.stack ? 'v' : 'h';
        
        // For stacked charts, we need to split by color
        if (colorField) {
            const uniqueColors = Array.from(new Set(data.map((d: any) => d[colorField])));
            const traces = uniqueColors.map(colorValue => {
                const filteredData = data.filter((d: any) => d[colorField] === colorValue);
                const newTrace = { ...trace };
                
                if (xField) {
                    newTrace.x = filteredData.map((d: any) => d[xField]);
                }
                if (yField) {
                    newTrace.y = filteredData.map((d: any) => d[yField]);
                }
                
                newTrace.name = String(colorValue);
                
                return newTrace;
            });
            
            const spec = createPlotlySpec(traces, vegaSpec);
            
            // Enable stacking in layout
            if (stackDirection === 'v') {
                spec.layout.barmode = encoding.y?.stack === 'normalize' ? 'relative' : 'stack';
            } else {
                spec.layout.barmode = encoding.x?.stack === 'normalize' ? 'relative' : 'stack';
            }
            
            return spec;
        }
    }

    return createPlotlySpec([trace], vegaSpec);
}

/**
 * Create complete Plotly specification with layout and config
 */
function createPlotlySpec(traces: any[], vegaSpec: any): PlotlySpec {
    const encoding = vegaSpec.encoding || {};
    const width = vegaSpec.width || 500;
    const height = vegaSpec.height || 300;
    
    // Create layout
    const layout: any = {
        width,
        height,
        autosize: true,
        margin: {
            l: 50,
            r: 50,
            t: 50,
            b: 50,
        },
    };

    // Set axis titles
    if (encoding.x?.title) {
        layout.xaxis = { title: encoding.x.title };
    } else if (encoding.x?.field) {
        layout.xaxis = { title: encoding.x.field };
    }
    
    if (encoding.y?.title) {
        layout.yaxis = { title: encoding.y.title };
    } else if (encoding.y?.field) {
        layout.yaxis = { title: encoding.y.field };
    }

    // Handle axis types
    if (encoding.x?.type === 'temporal') {
        layout.xaxis = layout.xaxis || {};
        layout.xaxis.type = 'date';
    }
    if (encoding.y?.type === 'temporal') {
        layout.yaxis = layout.yaxis || {};
        layout.yaxis.type = 'date';
    }

    // Handle log scales
    if (encoding.x?.scale?.type === 'log') {
        layout.xaxis = layout.xaxis || {};
        layout.xaxis.type = 'log';
    }
    if (encoding.y?.scale?.type === 'log') {
        layout.yaxis = layout.yaxis || {};
        layout.yaxis.type = 'log';
    }

    // Set title
    if (vegaSpec.title) {
        layout.title = {
            text: typeof vegaSpec.title === 'string' ? vegaSpec.title : vegaSpec.title.text,
        };
    }

    // Handle faceting
    if (encoding.row || encoding.column) {
        // For faceted plots, we'd need to create subplots
        // This is a simplified implementation
        layout.grid = {
            rows: encoding.row ? 2 : 1,
            columns: encoding.column ? 2 : 1,
            pattern: 'independent',
        };
    }

    // Create config
    const config: any = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['sendDataToCloud'],
    };

    return {
        data: traces,
        layout,
        config,
    };
}