/**
 * Simplified Vega-Lite spec generation for Plotly renderer
 * In a real implementation, this would import from the main graphic-walker package
 */

import type { IViewField, IRow, IStackMode } from './interfaces';

interface VegaSpecOptions {
    rows: readonly IViewField[];
    columns: readonly IViewField[];
    color?: IViewField;
    opacity?: IViewField;
    size?: IViewField;
    shape?: IViewField;
    theta?: IViewField;
    radius?: IViewField;
    text?: IViewField;
    details?: readonly IViewField[];
    interactiveScale: boolean;
    dataSource: readonly IRow[];
    layoutMode: string;
    width: number;
    height: number;
    defaultAggregated: boolean;
    geomType: string;
    stack: IStackMode;
    scales?: any;
    mediaTheme: 'dark' | 'light';
    vegaConfig: any;
    displayOffset?: number;
}

/**
 * Generate Vega-Lite specification from Graphic Walker configuration
 * This is a simplified version - in production, import from main package
 */
export function toVegaSpec(options: VegaSpecOptions): any[] {
    const {
        rows,
        columns,
        color,
        opacity,
        size,
        shape,
        theta,
        radius,
        text,
        details = [],
        dataSource,
        width,
        height,
        geomType,
        stack,
        defaultAggregated,
    } = options;

    // Extract dimensions and measures
    const rowDims = rows.filter(f => f.analyticType === 'dimension');
    const colDims = columns.filter(f => f.analyticType === 'dimension');
    const rowMeas = rows.filter(f => f.analyticType === 'measure');
    const colMeas = columns.filter(f => f.analyticType === 'measure');

    // Determine facet fields (additional dimensions beyond the first)
    const rowFacetField = rowDims.length > 1 ? rowDims[rowDims.length - 1] : null;
    const colFacetField = colDims.length > 1 ? colDims[colDims.length - 1] : null;

    // Determine x and y fields (first dimension or measure)
    const xField = colDims[0] || colMeas[0];
    const yField = rowDims[0] || rowMeas[0];

    // Map geom types to Vega-Lite marks
    const geomToMark: Record<string, string> = {
        'point': 'point',
        'circle': 'circle',
        'tick': 'tick',
        'rect': 'rect',
        'line': 'line',
        'area': 'area',
        'bar': 'bar',
        'boxplot': 'boxplot',
        'arc': 'arc',
        'text': 'text',
    };

    const mark = geomToMark[geomType] || 'point';

    // Build encoding
    const encoding: any = {};

    if (xField) {
        encoding.x = {
            field: xField.fid,
            type: xField.semanticType,
            title: xField.name || xField.fid,
        };
        
        // Handle aggregation for measures
        if (xField.analyticType === 'measure' && defaultAggregated && xField.aggName) {
            encoding.x.aggregate = xField.aggName;
        }
    }

    if (yField) {
        encoding.y = {
            field: yField.fid,
            type: yField.semanticType,
            title: yField.name || yField.fid,
        };
        
        // Handle aggregation for measures
        if (yField.analyticType === 'measure' && defaultAggregated && yField.aggName) {
            encoding.y.aggregate = yField.aggName;
        }
    }

    // Add color encoding
    if (color) {
        encoding.color = {
            field: color.fid,
            type: color.semanticType,
            title: color.name || color.fid,
        };
    }

    // Add size encoding
    if (size) {
        encoding.size = {
            field: size.fid,
            type: size.semanticType,
            title: size.name || size.fid,
        };
    }

    // Add shape encoding
    if (shape) {
        encoding.shape = {
            field: shape.fid,
            type: shape.semanticType,
            title: shape.name || shape.fid,
        };
    }

    // Add opacity encoding
    if (opacity) {
        encoding.opacity = {
            field: opacity.fid,
            type: opacity.semanticType,
            title: opacity.name || opacity.fid,
        };
    }

    // Add text encoding
    if (text) {
        encoding.text = {
            field: text.fid,
            type: text.semanticType,
            title: text.name || text.fid,
        };
    }

    // Handle stacking
    if (stack !== 'none' && (mark === 'bar' || mark === 'area')) {
        const stackField = yField?.analyticType === 'measure' ? 'y' : 'x';
        if (encoding[stackField]) {
            encoding[stackField].stack = stack === 'normalize' ? 'normalize' : 
                                      stack === 'center' ? 'center' : 
                                      true;
        }
    }

    // Add theta for pie charts
    if (theta && mark === 'arc') {
        encoding.theta = {
            field: theta.fid,
            type: theta.semanticType,
            title: theta.name || theta.fid,
        };
        
        if (theta.analyticType === 'measure' && defaultAggregated && theta.aggName) {
            encoding.theta.aggregate = theta.aggName;
        }
    }

    // Add radius for pie charts
    if (radius && mark === 'arc') {
        encoding.radius = {
            field: radius.fid,
            type: radius.semanticType,
            title: radius.name || radius.fid,
        };
    }

    // Add detail fields for grouping
    if (details && details.length > 0) {
        encoding.detail = details.map(d => ({
            field: d.fid,
            type: d.semanticType,
        }));
    }

    // Add faceting encodings
    if (rowFacetField) {
        encoding.row = {
            field: rowFacetField.fid,
            type: rowFacetField.semanticType,
            title: rowFacetField.name || rowFacetField.fid,
        };
    }

    if (colFacetField) {
        encoding.column = {
            field: colFacetField.fid,
            type: colFacetField.semanticType,
            title: colFacetField.name || colFacetField.fid,
        };
    }

    // Build the spec
    const spec = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width,
        height,
        mark: {
            type: mark,
            tooltip: true,
        },
        encoding,
        data: {
            values: dataSource,
        },
    };

    // Handle multiple measures on same axis (creates multiple specs)
    // This is different from faceting - it creates a grid of different charts
    const rowRepeatFields = rowMeas.length > 1 ? rowMeas : [];
    const colRepeatFields = colMeas.length > 1 ? colMeas : [];

    if (rowRepeatFields.length > 1 || colRepeatFields.length > 1) {
        // For multiple measures, create multiple specs
        const specs = [];
        
        // If we have multiple measures, create a spec for each combination
        const rowCount = Math.max(1, rowRepeatFields.length);
        const colCount = Math.max(1, colRepeatFields.length);
        
        for (let r = 0; r < rowCount; r++) {
            for (let c = 0; c < colCount; c++) {
                const newSpec = JSON.parse(JSON.stringify(spec)); // Deep clone
                
                // Update x and y fields for this spec
                if (colRepeatFields.length > 0) {
                    const colField = colRepeatFields[c];
                    newSpec.encoding.x = {
                        field: colField.fid,
                        type: colField.semanticType,
                        title: colField.name || colField.fid,
                    };
                    if (colField.analyticType === 'measure' && defaultAggregated && colField.aggName) {
                        newSpec.encoding.x.aggregate = colField.aggName;
                    }
                }
                
                if (rowRepeatFields.length > 0) {
                    const rowField = rowRepeatFields[r];
                    newSpec.encoding.y = {
                        field: rowField.fid,
                        type: rowField.semanticType,
                        title: rowField.name || rowField.fid,
                    };
                    if (rowField.analyticType === 'measure' && defaultAggregated && rowField.aggName) {
                        newSpec.encoding.y.aggregate = rowField.aggName;
                    }
                }
                
                specs.push(newSpec);
            }
        }
        
        return specs;
    }

    return [spec];
}