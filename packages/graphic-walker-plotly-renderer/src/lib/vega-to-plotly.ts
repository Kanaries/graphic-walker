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
    // Debug logging
    console.log('Plotly Renderer - Input Vega Spec:', vegaSpec);
    
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
    
    console.log('Plotly Renderer - Data length:', data.length);
    console.log('Plotly Renderer - Sample data:', data.slice(0, 3));
    console.log('Plotly Renderer - Encoding:', encoding);
    
    // Log available fields in the data and try to match encoding fields
    if (data.length > 0) {
        const availableFields = Object.keys(data[0]);
        console.log('Plotly Renderer - Available fields in data:', availableFields);
        
        // Check if encoding fields exist in data
        const xField = encoding.x?.field;
        const yField = encoding.y?.field;
        
        if (xField && !availableFields.includes(xField)) {
            console.warn(`Plotly Renderer - X field "${xField}" not found in data. Available:`, availableFields);
        }
        if (yField && !availableFields.includes(yField)) {
            console.warn(`Plotly Renderer - Y field "${yField}" not found in data. Available:`, availableFields);
        }
    }
    
    // Handle empty data
    if (data.length === 0) {
        console.warn('Plotly Renderer - No data available');
        return {
            data: [],
            layout: {
                title: 'No data available',
                xaxis: { title: encoding.x?.title || encoding.x?.field || 'X' },
                yaxis: { title: encoding.y?.title || encoding.y?.field || 'Y' },
            },
            config: {},
        };
    }
    
    // Handle mark as object
    if (typeof markType === 'object' && markType.type) {
        markType = markType.type;
    }
    
    console.log('Plotly Renderer - Mark type:', markType);

    // Extract field mappings
    const xField = encoding.x?.field;
    const yField = encoding.y?.field;
    const colorField = encoding.color?.field;
    const sizeField = encoding.size?.field;
    const textField = encoding.text?.field;
    const shapeField = encoding.shape?.field;
    
    console.log('Plotly Renderer - Field mappings:', {
        xField,
        yField,
        colorField,
        sizeField,
        textField,
        shapeField
    });
    
    // Helper function to find the actual field name in data (handles aggregated field names)
    const findFieldInData = (fieldName: string, dataItem: any): string | null => {
        if (!fieldName || !dataItem) return null;
        
        const keys = Object.keys(dataItem);
        
        // 1. Exact match
        if (keys.includes(fieldName)) {
            return fieldName;
        }
        
        // 2. Look for aggregated versions (field_sum, field_mean, field_count, etc.)
        const aggregateSuffixes = ['_sum', '_mean', '_avg', '_min', '_max', '_count', '_median'];
        for (const suffix of aggregateSuffixes) {
            const aggregatedName = fieldName + suffix;
            if (keys.includes(aggregatedName)) {
                return aggregatedName;
        }
        }
        
        // 3. Look for field that starts with the field name
        const startsWith = keys.find(k => k.startsWith(fieldName + '_'));
        if (startsWith) {
            return startsWith;
        }
        
        // 4. Last resort - look for field that contains the field name
        const contains = keys.find(k => k.includes(fieldName));
        if (contains) {
            return contains;
        }
        
        return null;
    };

    // Determine Plotly trace type
    const plotlyType = markToPlotlyType[markType] || 'scatter';
    console.log('Plotly Renderer - Plotly type:', plotlyType);
    
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
                size: 10,
                symbol: markType === 'square' ? 'square' : 'circle',
            };
            // Handle size field if present
            if (sizeField && data.length > 0) {
                const actualSizeField = findFieldInData(sizeField, data[0]);
                if (actualSizeField) {
                    trace.marker.size = data.map((d: any) => d[actualSizeField]);
                }
            }
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
    if (markType !== 'arc' && data.length > 0) {
        if (xField) {
            const actualXField = findFieldInData(xField, data[0]);
            if (actualXField) {
                trace.x = data.map((d: any) => d[actualXField]);
                console.log(`Plotly Renderer - X field: "${xField}" mapped to "${actualXField}", data:`, trace.x.slice(0, 5));
            } else {
                console.warn(`Plotly Renderer - Could not find X field "${xField}" in data`);
                trace.x = data.map(() => null);
            }
        }
        if (yField) {
            const actualYField = findFieldInData(yField, data[0]);
            if (actualYField) {
                trace.y = data.map((d: any) => d[actualYField]);
                console.log(`Plotly Renderer - Y field: "${yField}" mapped to "${actualYField}", data:`, trace.y.slice(0, 5));
            } else {
                console.warn(`Plotly Renderer - Could not find Y field "${yField}" in data`);
                trace.y = data.map(() => null);
            }
        }
    }

    // Handle color encoding
    if (colorField && data.length > 0) {
        const actualColorField = findFieldInData(colorField, data[0]);
        if (!actualColorField) {
            console.warn(`Plotly Renderer - Could not find color field "${colorField}" in data`);
        } else {
            const uniqueColors = Array.from(new Set(data.map((d: any) => d[actualColorField])));
        
            // If categorical, split into multiple traces
            if (encoding.color?.type === 'nominal' || encoding.color?.type === 'ordinal') {
                const traces = uniqueColors.map(colorValue => {
                    const filteredData = data.filter((d: any) => d[actualColorField] === colorValue);
                    const newTrace = { ...trace };
                    
                    if (xField) {
                        const actualXField = findFieldInData(xField, filteredData[0]);
                        if (actualXField) {
                            newTrace.x = filteredData.map((d: any) => d[actualXField]);
                        }
                    }
                    if (yField) {
                        const actualYField = findFieldInData(yField, filteredData[0]);
                        if (actualYField) {
                            newTrace.y = filteredData.map((d: any) => d[actualYField]);
                        }
                    }
                
                newTrace.name = String(colorValue);
                
                    // Preserve marker settings
                    if (trace.marker) {
                        newTrace.marker = { ...trace.marker };
                        if (sizeField) {
                            const actualSizeField = findFieldInData(sizeField, filteredData[0]);
                            if (actualSizeField) {
                                newTrace.marker.size = filteredData.map((d: any) => d[actualSizeField]);
                            }
                        }
                    }
                    
                    return newTrace;
                });
                
                return createPlotlySpec(traces, vegaSpec);
            } else {
                // For continuous color scales
                if (trace.marker) {
                    trace.marker.color = data.map((d: any) => d[actualColorField]);
                    trace.marker.colorscale = 'Viridis';
                    trace.marker.showscale = true;
                }
            }
        }
    }

    // Handle stacking
    if (encoding.y?.stack || encoding.x?.stack) {
        const stackDirection = encoding.y?.stack ? 'v' : 'h';
        
        // For stacked charts, we need to split by color
        if (colorField && data.length > 0) {
            const actualColorField = findFieldInData(colorField, data[0]);
            if (actualColorField) {
                const uniqueColors = Array.from(new Set(data.map((d: any) => d[actualColorField])));
                const traces = uniqueColors.map(colorValue => {
                    const filteredData = data.filter((d: any) => d[actualColorField] === colorValue);
                    const newTrace = { ...trace };
                    
                    if (xField) {
                        const actualXField = findFieldInData(xField, filteredData[0]);
                        if (actualXField) {
                            newTrace.x = filteredData.map((d: any) => d[actualXField]);
                        }
                    }
                    if (yField) {
                        const actualYField = findFieldInData(yField, filteredData[0]);
                        if (actualYField) {
                            newTrace.y = filteredData.map((d: any) => d[actualYField]);
                        }
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