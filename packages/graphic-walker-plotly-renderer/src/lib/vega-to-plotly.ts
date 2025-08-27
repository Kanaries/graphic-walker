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
 * Helper function to detect stacking configuration
 */
function detectStackConfig(encoding: any, vegaSpec: any): { isStacked: boolean; stackMode: string | null; stackAxis: 'x' | 'y' | null } {
    let isStacked = false;
    let stackMode = null;
    let stackAxis: 'x' | 'y' | null = null;
    
    // Check if any quantitative encoding has stack property
    // Handle 'none' explicitly - it means no stacking
    if (encoding.x?.stack !== null && encoding.x?.stack !== false && encoding.x?.stack !== 'none' && encoding.x?.type === 'quantitative') {
        isStacked = true;
        stackMode = encoding.x.stack === true ? 'zero' : encoding.x.stack;
        stackAxis = 'x';
    } else if (encoding.x?.stack === 'none') {
        // Explicitly disabled stacking
        return { isStacked: false, stackMode: 'none', stackAxis: null };
    }
    
    if (encoding.y?.stack !== null && encoding.y?.stack !== false && encoding.y?.stack !== 'none' && encoding.y?.type === 'quantitative') {
        isStacked = true;
        stackMode = encoding.y.stack === true ? 'zero' : encoding.y.stack;
        stackAxis = 'y';
    } else if (encoding.y?.stack === 'none') {
        // Explicitly disabled stacking
        return { isStacked: false, stackMode: 'none', stackAxis: null };
    }
    
    if (encoding.theta?.stack !== null && encoding.theta?.stack !== false && encoding.theta?.stack !== 'none' && encoding.theta?.type === 'quantitative') {
        isStacked = true;
        stackMode = encoding.theta.stack === true ? 'zero' : encoding.theta.stack;
    } else if (encoding.theta?.stack === 'none') {
        return { isStacked: false, stackMode: 'none', stackAxis: null };
    }
    
    if (encoding.radius?.stack !== null && encoding.radius?.stack !== false && encoding.radius?.stack !== 'none' && encoding.radius?.type === 'quantitative') {
        isStacked = true;
        stackMode = encoding.radius.stack === true ? 'zero' : encoding.radius.stack;
    } else if (encoding.radius?.stack === 'none') {
        return { isStacked: false, stackMode: 'none', stackAxis: null };
    }
    
    // For certain marks, enable stacking by default if color field exists
    // UNLESS explicitly disabled with 'none'
    const markType = typeof vegaSpec.mark === 'object' ? vegaSpec.mark.type : vegaSpec.mark;
    if (!isStacked && encoding.color?.field && ['bar', 'area'].includes(markType)) {
        // Check if stacking is explicitly disabled
        const hasExplicitNone = encoding.x?.stack === 'none' || encoding.y?.stack === 'none';
        if (!hasExplicitNone) {
            isStacked = true;
            stackMode = 'zero';
            // Determine stack axis based on which axis is quantitative
            if (encoding.y?.type === 'quantitative') {
                stackAxis = 'y';
            } else if (encoding.x?.type === 'quantitative') {
                stackAxis = 'x';
            }
        }
    }
    
    return { isStacked, stackMode, stackAxis };
}

/**
 * Helper function to sort data for proper stacking and line connections
 */
function sortDataForVisualization(data: any[], xField: string | null, yField: string | null, colorField: string | null, encoding: any): any[] {
    if (!data || data.length === 0) return data;
    
    const sortedData = [...data].sort((a, b) => {
        // Determine primary sort field based on temporal fields
        let primaryCompare = 0;
        
        if (xField && encoding.x?.type === 'temporal') {
            primaryCompare = new Date(a[xField]).getTime() - new Date(b[xField]).getTime();
        } else if (yField && encoding.y?.type === 'temporal') {
            primaryCompare = new Date(a[yField]).getTime() - new Date(b[yField]).getTime();
        } else if (xField && encoding.x?.type === 'ordinal') {
            // For ordinal fields, use string comparison
            primaryCompare = String(a[xField]).localeCompare(String(b[xField]));
        } else if (yField && encoding.y?.type === 'ordinal') {
            primaryCompare = String(a[yField]).localeCompare(String(b[yField]));
        }
        
        if (primaryCompare !== 0) return primaryCompare;
        
        // Secondary sort by color field for consistent grouping
        if (colorField) {
            const aColor = a[colorField] ?? '';
            const bColor = b[colorField] ?? '';
            return String(aColor).localeCompare(String(bColor));
        }
        
        return 0;
    });
    
    return sortedData;
}

/**
 * Helper function to process faceting
 */
function processFaceting(data: any[], rowField: string | null, colField: string | null): { 
    facetData: Map<string, any[]>;
    rowValues: string[];
    colValues: string[];
} {
    const facetData = new Map<string, any[]>();
    const rowValues = new Set<string>();
    const colValues = new Set<string>();
    
    if (!rowField && !colField) {
        facetData.set('main', data);
        return { facetData, rowValues: [], colValues: [] };
    }
    
    // Collect unique values for facet dimensions
    data.forEach(d => {
        if (rowField && d[rowField] !== undefined) {
            rowValues.add(String(d[rowField]));
        }
        if (colField && d[colField] !== undefined) {
            colValues.add(String(d[colField]));
        }
    });
    
    console.log('ProcessFaceting - Field names:', { rowField, colField });
    console.log('ProcessFaceting - Unique values:', { 
        rowValues: Array.from(rowValues), 
        colValues: Array.from(colValues) 
    });
    
    const sortedRowValues = Array.from(rowValues).sort();
    const sortedColValues = Array.from(colValues).sort();
    
    // Split data by facet combinations
    if (rowField && colField) {
        sortedRowValues.forEach(rowVal => {
            sortedColValues.forEach(colVal => {
                const key = `${rowVal}_${colVal}`;
                const filtered = data.filter(d => 
                    String(d[rowField]) === rowVal && String(d[colField]) === colVal
                );
                if (filtered.length > 0) {
                    facetData.set(key, filtered);
                }
            });
        });
    } else if (rowField) {
        sortedRowValues.forEach(rowVal => {
            const filtered = data.filter(d => String(d[rowField]) === rowVal);
            if (filtered.length > 0) {
                facetData.set(rowVal, filtered);
            }
        });
    } else if (colField) {
        sortedColValues.forEach(colVal => {
            const filtered = data.filter(d => String(d[colField]) === colVal);
            console.log(`Filtering for column facet "${colVal}":`, {
                totalData: data.length,
                filteredCount: filtered.length,
                sample: filtered.slice(0, 2)
            });
            if (filtered.length > 0) {
                facetData.set(colVal, filtered);
            }
        });
    }
    
    return { facetData, rowValues: sortedRowValues, colValues: sortedColValues };
}

/**
 * Transform multiple Vega-Lite specifications (for multi-field axes) to Plotly specification
 */
export function vegaLiteArrayToPlotly(vegaSpecs: any[]): PlotlySpec {
    if (!Array.isArray(vegaSpecs) || vegaSpecs.length === 0) {
        return vegaLiteToPlotly(vegaSpecs);
    }
    
    // Single spec - use regular processing
    if (vegaSpecs.length === 1) {
        return vegaLiteToPlotly(vegaSpecs[0]);
    }
    
    console.log('Plotly Renderer - Processing multiple specs:', vegaSpecs.length);
    
    // Multiple specs - create a grid of subplots
    // This happens when there are multiple measures/dimensions on the same axis
    const allTraces: any[] = [];
    const numSpecs = vegaSpecs.length;
    
    // Determine grid layout based on number of specs
    // Try to make it as square as possible
    const cols = Math.ceil(Math.sqrt(numSpecs));
    const rows = Math.ceil(numSpecs / cols);
    
    console.log(`Plotly Renderer - Creating ${rows}x${cols} grid for ${numSpecs} specs`);
    
    // Process each spec and assign to subplot
    vegaSpecs.forEach((spec, index) => {
        const plotlySpec = vegaLiteToPlotly(spec);
        const row = Math.floor(index / cols) + 1;
        const col = (index % cols) + 1;
        
        // Assign traces to specific subplot
        plotlySpec.data.forEach((trace: any) => {
            if (rows > 1 || cols > 1) {
                trace.xaxis = index === 0 ? 'x' : `x${index + 1}`;
                trace.yaxis = index === 0 ? 'y' : `y${index + 1}`;
            }
            allTraces.push(trace);
        });
    });
    
    // Create combined layout
    const firstSpec = vegaSpecs[0];
    const encoding = firstSpec.encoding || {};
    const width = firstSpec.width || 400;
    const height = firstSpec.height || 300;
    
    const layout: any = {
        width: width * cols,
        height: height * rows,
        autosize: true,
        margin: { l: 50, r: 50, t: 50, b: 50 },
        grid: {
            rows: rows,
            columns: cols,
            pattern: 'independent',
            xgap: 0.1,
            ygap: 0.1,
        },
    };
    
    // Configure axes for each subplot
    vegaSpecs.forEach((spec, index) => {
        const xAxisKey = index === 0 ? 'xaxis' : `xaxis${index + 1}`;
        const yAxisKey = index === 0 ? 'yaxis' : `yaxis${index + 1}`;
        const specEncoding = spec.encoding || {};
        
        layout[xAxisKey] = {
            title: specEncoding.x?.title || specEncoding.x?.field || '',
            type: specEncoding.x?.type === 'temporal' ? 'date' : undefined,
        };
        
        layout[yAxisKey] = {
            title: specEncoding.y?.title || specEncoding.y?.field || '',
            type: specEncoding.y?.type === 'temporal' ? 'date' : undefined,
        };
    });
    
    // Set overall title if present
    if (firstSpec.title) {
        layout.title = {
            text: typeof firstSpec.title === 'string' ? firstSpec.title : firstSpec.title.text,
        };
    }
    
    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['sendDataToCloud'],
    };
    
    return {
        data: allTraces,
        layout,
        config,
    };
}

/**
 * Transform a Vega-Lite specification to Plotly specification
 */
export function vegaLiteToPlotly(vegaSpec: any): PlotlySpec {
    // Handle array of specs (multiple fields on axes)
    if (Array.isArray(vegaSpec)) {
        return vegaLiteArrayToPlotly(vegaSpec);
    }
    // Debug logging
    console.log('Plotly Renderer - Input Vega Spec:', vegaSpec);
    console.log('Plotly Renderer - Vega Spec keys:', Object.keys(vegaSpec));
    
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
    console.log('Plotly Renderer - Full Encoding object:', JSON.stringify(encoding, null, 2));
    console.log('Plotly Renderer - Encoding.row:', encoding.row);
    console.log('Plotly Renderer - Encoding.column:', encoding.column);
    
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

    // Extract field mappings
    const xField = encoding.x?.field;
    const yField = encoding.y?.field;
    const colorField = encoding.color?.field;
    const sizeField = encoding.size?.field;
    const textField = encoding.text?.field;
    const shapeField = encoding.shape?.field;
    let rowField = encoding.row?.field;
    let colField = encoding.column?.field;
    
    // Debug: Check if facet fields exist in data
    if (data.length > 0) {
        const sampleItem = data[0];
        const dataKeys = Object.keys(sampleItem);
        console.log('Available fields in data:', dataKeys);
        
        if (rowField) {
            const actualRowField = findFieldInData(rowField, sampleItem);
            if (actualRowField && actualRowField !== rowField) {
                console.log(`Row field "${rowField}" mapped to actual field "${actualRowField}"`);
                rowField = actualRowField;
            } else if (!actualRowField) {
                console.warn(`Row field "${rowField}" not found in data!`);
            }
        }
        
        if (colField) {
            const actualColField = findFieldInData(colField, sampleItem);
            if (actualColField && actualColField !== colField) {
                console.log(`Column field "${colField}" mapped to actual field "${actualColField}"`);
                colField = actualColField;
            } else if (!actualColField) {
                console.warn(`Column field "${colField}" not found in data!`);
            }
        }
    }
    
    console.log('Plotly Renderer - Field mappings:', {
        xField,
        yField,
        colorField,
        sizeField,
        textField,
        shapeField,
        rowField,
        colField
    });

    // Detect stacking configuration
    const { isStacked, stackMode, stackAxis } = detectStackConfig(encoding, vegaSpec);
    console.log('Plotly Renderer - Stack configuration:', { isStacked, stackMode, stackAxis });
    
    // Sort data for proper visualization
    const sortedData = sortDataForVisualization(data, xField, yField, colorField, encoding);
    
    // Process faceting
    const { facetData, rowValues, colValues } = processFaceting(sortedData, rowField, colField);
    const hasFacets = rowField || colField;
    
    console.log('Plotly Renderer - Faceting:', { 
        hasFacets, 
        rowField,
        colField,
        rowValues,
        colValues,
        facetGroups: facetData.size,
        facetKeys: Array.from(facetData.keys())
    });
    
    // Debug: Log each facet's data
    facetData.forEach((data, key) => {
        console.log(`Facet "${key}" has ${data.length} rows, sample:`, data.slice(0, 2));
    });

    // Determine Plotly trace type
    const plotlyType = markToPlotlyType[markType] || 'scatter';
    console.log('Plotly Renderer - Plotly type:', plotlyType);
    
    // Create traces based on faceting and color encoding
    const allTraces: any[] = [];
    
    if (hasFacets) {
        // Create subplots for faceted data
        const numRows = Math.max(1, rowValues.length || 1);
        const numCols = Math.max(1, colValues.length || 1);
        
        // Iterate through facets in a predictable grid order
        for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
            for (let colIdx = 0; colIdx < numCols; colIdx++) {
                // Determine the facet key based on what facets we have
                let facetKey: string;
                let facetDataSlice: any[];
                
                if (rowField && colField) {
                    // Both row and column facets
                    if (rowIdx >= rowValues.length || colIdx >= colValues.length) {
                        continue; // Skip if index out of bounds
                    }
                    const rowVal = rowValues[rowIdx];
                    const colVal = colValues[colIdx];
                    facetKey = `${rowVal}_${colVal}`;
                    facetDataSlice = facetData.get(facetKey) || [];
                } else if (rowField && !colField) {
                    // Only row facets
                    if (rowIdx >= rowValues.length) {
                        continue; // Skip if index out of bounds
                    }
                    const rowVal = rowValues[rowIdx];
                    facetKey = rowVal;
                    facetDataSlice = facetData.get(facetKey) || [];
                } else if (!rowField && colField) {
                    // Only column facets
                    if (colIdx >= colValues.length) {
                        continue; // Skip if index out of bounds
                    }
                    const colVal = colValues[colIdx];
                    facetKey = colVal;
                    facetDataSlice = facetData.get(facetKey) || [];
                    console.log(`Column facet: colIdx=${colIdx}, colVal=${colVal}, dataLength=${facetDataSlice.length}`);
                } else {
                    // No facets (shouldn't happen in this branch)
                    continue;
                }
                
                // Skip if no data for this facet
                if (!facetDataSlice || facetDataSlice.length === 0) {
                    console.warn(`No data found for facet key: ${facetKey}`);
                    continue;
                }
                
                // Calculate subplot index (1-based)
                const subplotIndex = rowIdx * numCols + colIdx + 1;
                
                console.log(`Creating traces for facet "${facetKey}" at position row=${rowIdx}, col=${colIdx}, subplot=${subplotIndex}`);
                console.log(`Facet data length: ${facetDataSlice.length}`);
                console.log(`Facet data sample:`, facetDataSlice.slice(0, 2));
                
                const traces = createTracesForData(
                    facetDataSlice, 
                    markType, 
                    plotlyType, 
                    encoding, 
                    { xField, yField, colorField, sizeField, textField },
                    findFieldInData,
                    isStacked,
                    stackMode,
                    stackAxis
                );
                
                // Assign traces to specific subplot
                traces.forEach(trace => {
                    trace.xaxis = subplotIndex === 1 ? 'x' : `x${subplotIndex}`;
                    trace.yaxis = subplotIndex === 1 ? 'y' : `y${subplotIndex}`;
                    
                    // Keep original trace names for color legend
                    // Facet labels are shown as annotations, not in trace names
                    
                    allTraces.push(trace);
                });
            }
        }
    } else {
        // No faceting - create traces normally
        const traces = createTracesForData(
            sortedData,
            markType,
            plotlyType,
            encoding,
            { xField, yField, colorField, sizeField, textField },
            findFieldInData,
            isStacked,
            stackMode,
            stackAxis
        );
        allTraces.push(...traces);
    }

    return createPlotlySpec(allTraces, vegaSpec, hasFacets, rowValues, colValues);
}

/**
 * Helper function to create traces for a given data slice
 */
function createTracesForData(
    data: any[],
    markType: string,
    plotlyType: string,
    encoding: any,
    fields: { xField: string | null, yField: string | null, colorField: string | null, sizeField: string | null, textField: string | null },
    findFieldInData: Function,
    isStacked: boolean,
    stackMode: string | null,
    _stackAxis: string | null
): any[] {
    const { xField, yField, colorField, sizeField, textField } = fields;
    
    if (data.length === 0) {
        return [];
    }
    
    // Create base trace
    const createBaseTrace = (): any => ({
        type: plotlyType,
    });
    
    // Handle different mark types
    const configureTraceForMark = (trace: any, filteredData: any[]) => {
        switch (markType) {
            case 'point':
            case 'circle':
            case 'square':
                trace.mode = 'markers';
                trace.marker = {
                    size: 10,
                    symbol: markType === 'square' ? 'square' : 'circle',
                };
                if (sizeField && filteredData.length > 0) {
                    const actualSizeField = findFieldInData(sizeField, filteredData[0]);
                    if (actualSizeField) {
                        trace.marker.size = filteredData.map((d: any) => d[actualSizeField]);
                    }
                }
                break;
                
            case 'line':
                trace.mode = 'lines';
                break;
                
            case 'area':
                trace.mode = 'lines';
                trace.fill = isStacked ? 'tonexty' : 'tozeroy';
                trace.stackgroup = isStacked && colorField ? 'one' : undefined;
                break;
                
            case 'bar':
                // Bar traces are already type 'bar'
                break;
                
            case 'arc':
                trace.type = 'pie';
                trace.labels = xField ? filteredData.map((d: any) => d[xField]) : undefined;
                trace.values = yField ? filteredData.map((d: any) => d[yField]) : undefined;
                break;
                
            case 'text':
                trace.mode = 'text';
                trace.text = textField ? filteredData.map((d: any) => d[textField]) : 
                           (yField ? filteredData.map((d: any) => d[yField]) : 
                           (xField ? filteredData.map((d: any) => d[xField]) : []));
                trace.textposition = 'middle center';
                break;
                
            case 'tick':
                trace.mode = 'markers';
                trace.marker = {
                    symbol: 'line-ns',
                    size: 10,
                };
                break;
                
            case 'boxplot':
                trace.type = 'box';
                trace.y = yField ? filteredData.map((d: any) => d[yField]) : undefined;
                trace.name = xField ? filteredData[0]?.[xField] : undefined;
                break;
        }
    };
    
    // Set x and y data
    const setXYData = (trace: any, filteredData: any[]) => {
        if (markType !== 'arc' && filteredData.length > 0) {
            if (xField) {
                const actualXField = findFieldInData(xField, filteredData[0]);
                if (actualXField) {
                    trace.x = filteredData.map((d: any) => d[actualXField]);
                }
            }
            if (yField) {
                const actualYField = findFieldInData(yField, filteredData[0]);
                if (actualYField) {
                    trace.y = filteredData.map((d: any) => d[actualYField]);
                }
            }
        }
    };
    
    // Handle color encoding and create multiple traces if needed
    if (colorField && data.length > 0) {
        const actualColorField = findFieldInData(colorField, data[0]);
        if (!actualColorField) {
            console.warn(`Plotly Renderer - Could not find color field "${colorField}" in data`);
            // Create single trace without color grouping
            const trace = createBaseTrace();
            configureTraceForMark(trace, data);
            setXYData(trace, data);
            return [trace];
        }
        
        const uniqueColors = Array.from(new Set(data.map((d: any) => d[actualColorField])));
        
        // For categorical colors, split into multiple traces
        if (encoding.color?.type === 'nominal' || encoding.color?.type === 'ordinal' || !encoding.color?.type) {
            const traces = uniqueColors.map((colorValue) => {
                const filteredData = data.filter((d: any) => d[actualColorField] === colorValue);
                const trace = createBaseTrace();
                
                configureTraceForMark(trace, filteredData);
                setXYData(trace, filteredData);
                
                trace.name = String(colorValue);
                
                // For stacked area charts, configure stacking
                if (markType === 'area' && isStacked) {
                    trace.stackgroup = 'one';
                    if (stackMode === 'normalize') {
                        trace.groupnorm = 'percent';
                    } else if (stackMode === 'center') {
                        // Center stacking is not directly supported in Plotly for area charts
                        // We'll use the default stacking but note this limitation
                        trace.stackgroup = 'one';
                    }
                }
                
                // For line charts, ensure proper grouping
                if (markType === 'line') {
                    trace.legendgroup = String(colorValue);
                }
                
                return trace;
            });
            
            return traces;
        } else {
            // For continuous color scales
            const trace = createBaseTrace();
            configureTraceForMark(trace, data);
            setXYData(trace, data);
            
            if (trace.marker) {
                trace.marker.color = data.map((d: any) => d[actualColorField]);
                trace.marker.colorscale = 'Viridis';
                trace.marker.showscale = true;
            }
            
            return [trace];
        }
    } else {
        // No color field - create single trace
        const trace = createBaseTrace();
        configureTraceForMark(trace, data);
        setXYData(trace, data);
        return [trace];
    }
}

/**
 * Create complete Plotly specification with layout and config
 */
function createPlotlySpec(
    traces: any[], 
    vegaSpec: any, 
    hasFacets: boolean,
    rowValues: string[],
    colValues: string[]
): PlotlySpec {
    const encoding = vegaSpec.encoding || {};
    const width = vegaSpec.width || 500;
    const height = vegaSpec.height || 300;
    
    // Extract facet field names from encoding
    const rowField = encoding.row?.field || null;
    const colField = encoding.column?.field || null;
    
    // Detect stacking for layout configuration
    const { isStacked, stackMode } = detectStackConfig(encoding, vegaSpec);
    
    // Create layout
    const layout: any = {
        width: hasFacets ? width * Math.max(1, colValues.length || 1) : width,
        height: hasFacets ? height * Math.max(1, rowValues.length || 1) : height,
        autosize: true,
        margin: {
            l: 50,
            r: 50,
            t: 50,
            b: 50,
        },
    };

    // Configure layout for facets
    if (hasFacets) {
        const numRows = Math.max(1, rowValues.length || 1);
        const numCols = Math.max(1, colValues.length || 1);
        
        layout.grid = {
            rows: numRows,
            columns: numCols,
            pattern: 'independent',
            xgap: 0.1,
            ygap: 0.1,
        };
        
        // Create subplot specifications
        const subplots = [];
        for (let i = 0; i < numRows; i++) {
            const row = [];
            for (let j = 0; j < numCols; j++) {
                const index = i * numCols + j + 1;
                row.push(index === 1 ? 'xy' : `x${index}y${index}`);
            }
            subplots.push(row);
        }
        layout.subplots = subplots;
        
        // Configure axes for each subplot
        for (let i = 1; i <= numRows * numCols; i++) {
            const xAxisKey = i === 1 ? 'xaxis' : `xaxis${i}`;
            const yAxisKey = i === 1 ? 'yaxis' : `yaxis${i}`;
            
            layout[xAxisKey] = {
                title: i <= numCols ? (encoding.x?.title || encoding.x?.field) : '',
                type: encoding.x?.type === 'temporal' ? 'date' : undefined,
            };
            
            layout[yAxisKey] = {
                title: i % numCols === 1 ? (encoding.y?.title || encoding.y?.field) : '',
                type: encoding.y?.type === 'temporal' ? 'date' : undefined,
            };
            
            // Add facet labels as subplot titles
            if (rowValues.length > 0 || colValues.length > 0) {
                layout.annotations = layout.annotations || [];
                
                const rowIndex = Math.floor((i - 1) / numCols);
                const colIndex = (i - 1) % numCols;
                
                // Create facet title for this subplot
                let facetTitle = '';
                if (rowField && colField) {
                    facetTitle = `${rowValues[rowIndex]} | ${colValues[colIndex]}`;
                } else if (rowField) {
                    facetTitle = rowValues[rowIndex];
                } else if (colField) {
                    facetTitle = colValues[colIndex];
                }
                
                // Add facet title as annotation above each subplot
                if (facetTitle) {
                    // Calculate position for this subplot's title
                    const xPos = (colIndex + 0.5) / numCols;
                    const yPos = 1 - (rowIndex) / numRows;
                    
                    layout.annotations.push({
                        text: `<b>${facetTitle}</b>`,
                        showarrow: false,
                        xref: 'paper',
                        yref: 'paper',
                        x: xPos,
                        y: yPos,
                        xanchor: 'center',
                        yanchor: 'bottom',
                        font: {
                            size: 12,
                            color: '#666'
                        }
                    });
                }
                
                // Also add dimension names as headers (once per row/column)
                if (rowField && colIndex === 0 && rowIndex === 0) {
                    // Add row dimension name on the left
                    layout.annotations.push({
                        text: `<b>${encoding.row?.title || rowField}</b>`,
                        showarrow: false,
                        xref: 'paper',
                        yref: 'paper',
                        x: -0.05,
                        y: 0.5,
                        xanchor: 'center',
                        yanchor: 'middle',
                        textangle: -90,
                        font: {
                            size: 14,
                            color: '#333'
                        }
                    });
                }
                
                if (colField && rowIndex === 0 && colIndex === 0) {
                    // Add column dimension name on top
                    layout.annotations.push({
                        text: `<b>${encoding.column?.title || colField}</b>`,
                        showarrow: false,
                        xref: 'paper',
                        yref: 'paper',
                        x: 0.5,
                        y: 1.05,
                        xanchor: 'center',
                        yanchor: 'bottom',
                        font: {
                            size: 14,
                            color: '#333'
                        }
                    });
                }
            }
        }
    } else {
        // Non-faceted layout
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
    }

    // Configure stacking in layout for bar charts
    const markType = typeof vegaSpec.mark === 'object' ? vegaSpec.mark.type : vegaSpec.mark;
    if (markType === 'bar' && isStacked && stackMode !== 'none') {
        if (stackMode === 'normalize') {
            layout.barmode = 'stack';
            layout.barnorm = 'percent';
        } else if (stackMode === 'center') {
            // Center stacking in Plotly - use 'relative' mode with custom offset
            // Note: This is an approximation as Plotly doesn't have native center stacking
            layout.barmode = 'stack';
            // We would need to manually calculate offsets for true center stacking
            // For now, we use regular stacking as a fallback
            console.warn('Center stacking is approximated in Plotly - using regular stacking');
        } else if (stackMode === 'zero') {
            layout.barmode = 'stack';
        }
    } else if (markType === 'bar' && !isStacked && encoding.color?.field) {
        // When not stacked but has color field, use grouped bars
        layout.barmode = 'group';
    }

    // Set title
    if (vegaSpec.title) {
        layout.title = {
            text: typeof vegaSpec.title === 'string' ? vegaSpec.title : vegaSpec.title.text,
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