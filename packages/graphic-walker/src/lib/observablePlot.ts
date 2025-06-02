import * as Plot from '@observablehq/plot';
import { IChannelScales, IRow, IStackMode, IViewField, VegaGlobalConfig } from '../interfaces';
import { NULL_FIELD } from '../vis/spec/field';
import { getSingleView, SingleViewProps } from '@/vis/spec/view';
import { toVegaSpec } from './vega';
import { t } from 'i18next';

function vegaLiteToPlot(spec: any): any {
    /**
     * We read the major parts from the single-view Vega-Lite spec, e.g.:
     *  - spec.data?.values => data array
     *  - spec.mark => "bar" | "point" | "area" | "line" | ...
     *  - spec.encoding?.x?.field / .type => X channel
     *  - spec.encoding?.y?.field / .type => Y channel
     *  - spec.encoding?.color?.field => color channel
     *  - spec.encoding?.size?.field => size channel
     *  - spec.encoding?.tooltip => "title" in Plot
     *  - spec.transform => e.g. aggregate, stack, bin, etc. (only partially supported)
     */

    // 1) Extract data
    const data = spec?.data?.values || [];

    // 2) Identify mark type
    let markType = spec.mark;
    // Vega-Lite can have "mark" as an object: e.g. {type: "bar", tooltip: true}
    // so let's read the actual string if it's an object
    if (typeof markType === 'object' && markType.type) {
        markType = markType.type;
    }
    console.log({ encoding: spec.encoding, markType });
    // 3) Gather encoding fields
    const enc = spec.encoding || {};
    const xField = enc.x?.field || null;
    const yField = enc.y?.field || null;
    const xFacetField = enc.column?.field || null;
    const yFacetField = enc.row?.field || null;
    const colorField = enc.color?.field || null;
    const sizeField = enc.size?.field || null;
    const tooltipEnc = enc.tooltip;

    console.log({ xField, yField, xFacetField, yFacetField, colorField, sizeField, tooltipEnc });
    // etc. shape, opacity, text, etc. if present

    // Helper function to create stack configuration
    const createStackConfig = (stackMode: string | null, baseConfig: any) => {
        if (!stacked || !colorField) {
            return baseConfig;
        }
        
        const stackOptions: any = {};
        if (stackMode === "normalize") {
            stackOptions.offset = "normalize";
        } else if (stackMode === "center") {
            stackOptions.offset = "center";
        }
        
        console.log('Stack options for mark:', { stackMode, stackOptions });
        
        return stackOptions;
    };

    // Helper function to apply stacking to any mark
    const applyStacking = (markFunction: any, data: any[], baseConfig: any, stackAxis: 'X' | 'Y') => {
        if (!stacked || !colorField) {
            return markFunction(data, baseConfig);
        }
        
        // Sort data for consistent stacking (especially important for temporal data)
        const sortedData = [...data].sort((a, b) => {
            const xCompare = xField ? new Date(a[xField]).getTime() - new Date(b[xField]).getTime() : 0;
            if (xCompare !== 0) return xCompare;
            return colorField && a[colorField] < b[colorField] ? -1 : 1;
        });
        
        const stackOptions = createStackConfig(stackMode, baseConfig);
        const stackFunction = stackAxis === 'X' ? Plot.stackX : Plot.stackY;
        
        // Ensure z channel is set for grouping
        const configWithZ = {
            ...baseConfig,
            z: colorField || undefined,
        };
        
        return markFunction(sortedData, stackFunction(stackOptions, configWithZ));
    };

    // 4) Check for stacking in encoding channels (not just transforms)
    let stacked = false;
    let stackMode = null; // Can be "normalize", "center", etc.
    
    // Check if any quantitative encoding has stack property that's not null/false
    if (enc.x?.stack !== null && enc.x?.stack !== false && enc.x?.type === 'quantitative') {
        stacked = true;
        stackMode = enc.x.stack;
    }
    if (enc.y?.stack !== null && enc.y?.stack !== false && enc.y?.type === 'quantitative') {
        stacked = true;
        stackMode = enc.y.stack;
    }
    if (enc.theta?.stack !== null && enc.theta?.stack !== false && enc.theta?.type === 'quantitative') {
        stacked = true;
        stackMode = enc.theta.stack;
    }
    if (enc.radius?.stack !== null && enc.radius?.stack !== false && enc.radius?.type === 'quantitative') {
        stacked = true;
        stackMode = enc.radius.stack;
    }
    
    // Also check transforms for legacy support
    if (Array.isArray(spec.transform)) {
        for (const t of spec.transform) {
            if (t.stack) {
                // E.g. "stack": "area"
                stacked = true;
            }
            // if t.aggregate => we might build a group transform
            // if t.bin => we might build a bin transform
            // etc...
        }
    }

    // 5) Build the Plot mark
    //    We'll guess a single Mark. If you had multiple encodings in Vega-Lite (like "row", "column", etc.),
    //    you might do separate plots or facets. For now, let's keep it simple.

    let mark: Plot.Mark;
    switch (markType) {
        case 'bar':
            // Determine which axis is quantitative to decide stacking direction
            const xIsQuantitative = enc.x?.type === 'quantitative';
            const yIsQuantitative = enc.y?.type === 'quantitative';
            
            const baseBarConfig = {
                x: xField || undefined,
                y: yField || undefined,
                fill: colorField || undefined,
                fx: xFacetField || undefined,
                fy: yFacetField || undefined,
            };
            
            if (xIsQuantitative && !yIsQuantitative) {
                // X is quantitative, Y is nominal/ordinal -> horizontal bars
                mark = applyStacking(Plot.barX, data, baseBarConfig, 'X');
            } else {
                // Y is quantitative (default case) -> vertical bars
                mark = applyStacking(Plot.barY, data, baseBarConfig, 'Y');
            }
            break;

        case 'point':
            const basePointConfig = {
                x: xField || undefined,
                y: yField || undefined,
                fill: colorField || undefined,
                r: sizeField || undefined,
                fx: xFacetField || undefined,
                fy: yFacetField || undefined,
            };
            
            // Points can be stacked in some cases (like dot plots)
            if (stacked && colorField && enc.y?.type === 'quantitative') {
                mark = applyStacking(Plot.dot, data, basePointConfig, 'Y');
            } else {
                mark = Plot.dot(data, basePointConfig);
            }
            break;

        case 'tick':
            const baseTickConfig = {
                x: xField || undefined,
                y: yField || undefined,
                stroke: colorField || undefined,
                fx: xFacetField || undefined,
                fy: yFacetField || undefined,
            };
            
            // Ticks can be stacked for certain visualizations
            if (stacked && colorField && enc.y?.type === 'quantitative') {
                mark = applyStacking(Plot.tickY, data, baseTickConfig, 'Y');
            } else {
                mark = Plot.tickY(data, baseTickConfig);
            }
            break;

        case 'line':
            const baseLineConfig = {
                x: xField || undefined,
                y: yField || undefined,
                stroke: colorField || undefined,
                fx: xFacetField || undefined,
                fy: yFacetField || undefined,
            };
            
            // Lines can be stacked for cumulative line charts
            if (stacked && colorField && enc.y?.type === 'quantitative') {
                // For lines, we need to add z channel for grouping even when not stacked
                const lineConfigWithZ = {
                    ...baseLineConfig,
                    z: colorField || undefined,
                };
                mark = applyStacking(Plot.line, data, lineConfigWithZ, 'Y');
            } else if (colorField) {
                // Multiple series lines need z channel for grouping
                const lineConfigWithZ = {
                    ...baseLineConfig,
                    z: colorField || undefined,
                };
                mark = Plot.line(data, lineConfigWithZ);
            } else {
                mark = Plot.line(data, baseLineConfig);
            }
            break;

        case 'area':
            // In Vega-Lite, "area" often implies stacked area if "stack" is used
            // Determine which axis is quantitative to decide stacking direction
            const areaXIsQuantitative = enc.x?.type === 'quantitative';
            const areaYIsQuantitative = enc.y?.type === 'quantitative';
            
            // For area charts with color encoding, default to stacked unless explicitly disabled
            const shouldStack = stacked || (colorField && stacked !== false);
            
            console.log('Area chart debug:', {
                stacked,
                stackMode,
                colorField,
                shouldStack,
                areaXIsQuantitative,
                areaYIsQuantitative,
                xField,
                yField,
                dataLength: data.length,
                sampleData: data.slice(0, 3)
            });
            
            const baseAreaConfig = {
                x: xField || undefined,
                y: yField || undefined,
                fill: colorField || undefined,
                fx: xFacetField || undefined,
                fy: yFacetField || undefined,
            };
            
            if (shouldStack && colorField) {
                console.log('Creating stacked area chart');
                if (areaXIsQuantitative && !areaYIsQuantitative) {
                    // X is quantitative, Y is nominal/ordinal -> horizontal area
                    mark = applyStacking(Plot.areaX, data, baseAreaConfig, 'X');
                } else {
                    // Y is quantitative (default case) -> vertical area
                    mark = applyStacking(Plot.areaY, data, baseAreaConfig, 'Y');
                }
            } else if (colorField) {
                console.log('Creating grouped area chart');
                // Multiple series but not stacked - need to group by color field
                const groupedAreaConfig = {
                    ...baseAreaConfig,
                    z: colorField || undefined, // Group by color field
                };
                
                if (areaXIsQuantitative && !areaYIsQuantitative) {
                    mark = Plot.areaX(data, groupedAreaConfig);
                } else {
                    mark = Plot.areaY(data, groupedAreaConfig);
                }
            } else {
                console.log('Creating single series area chart');
                // Single series area chart
                if (areaXIsQuantitative && !areaYIsQuantitative) {
                    mark = Plot.areaX(data, baseAreaConfig);
                } else {
                    mark = Plot.areaY(data, baseAreaConfig);
                }
            }
            break;

        default:
            // fallback to a "dot" if unknown
            mark = Plot.dot(data, {
                x: xField || undefined,
                y: yField || undefined,
                fill: colorField || undefined,
            });
            break;
    }

    // 6) Title / tooltip
    //    If Vega-Lite has "encoding.tooltip", we can map that to Plot's "title" channel
    //    If tooltip is an array of fields, you might join them. Alternatively, Plot
    //    also has "hint"/"tip" patterns, but we'll do the simplest approach.
    let titleFn;
    if (tooltipEnc) {
        if (Array.isArray(tooltipEnc)) {
            // e.g. tooltip: [{"field": "colA"}, {"field": "colB"}]
            titleFn = (d: any) => tooltipEnc.map((tt: any) => `${tt.field}: ${d[tt.field]}`).join(', ');
        } else if (tooltipEnc.field) {
            // e.g. tooltip: {"field": "colA"}
            titleFn = (d: any) => `${tooltipEnc.field}: ${d[tooltipEnc.field]}`;
        }
        // if mark is an object, you could set mark.tooltip = ...
    }

    // If we have a "title" function, apply it to the Mark
    if (titleFn) {
        // "title" is typically a function in Plot
        (mark as any).title = titleFn;
    }

    // Helper function to determine if temporal field is being used categorically
    const isTemporalUsedCategorically = (axis: 'x' | 'y') => {
        const axisEnc = enc[axis];
        const otherAxisEnc = enc[axis === 'x' ? 'y' : 'x'];
        
        // For bar charts, if one axis is temporal and the other is quantitative,
        // the temporal axis is likely being used categorically
        if (markType === 'bar' && axisEnc?.type === 'temporal' && otherAxisEnc?.type === 'quantitative') {
            return true;
        }
        
        // For tick marks, temporal fields are often used categorically
        if (markType === 'tick' && axisEnc?.type === 'temporal') {
            return true;
        }
        
        return false;
    };

    // 7) Build top-level any
    const plotOptions: any = {
        marks: [mark],
        // Possibly define top-level x, y, color scales
        x: {
            label: enc.x?.title || undefined,
            // For temporal fields: use 'utc' for continuous scales, 'band' for categorical scales
            type: enc.x?.type === 'temporal' 
                ? (isTemporalUsedCategorically('x') ? 'band' : 'utc')
                : undefined,
            // If your spec had e.g. "type": "temporal", you'd do Plot.scale({type: "utc"})
        },
        y: {
            label: enc.y?.title || undefined,
            // Apply the same logic for y-axis temporal fields
            type: enc.y?.type === 'temporal' 
                ? (isTemporalUsedCategorically('y') ? 'band' : 'utc')
                : undefined,
            // If stacked, you can do y: {stack: "zero"} as an alternative approach
        },
        color: {
            label: enc.color?.title || undefined,
        },
        // fx: {
        //     label: enc.column?.title || undefined,
        // },
        // fy: {
        //     label: enc.row?.title || undefined,
        // },
    };

    return plotOptions;
}

// ----------------------------------------------------------------------------------
// The main function that parallels `toVegaSpec(...)`:
// It returns an array of any, one per sub-view if row/col "repeat" is in effect.
export function toObservablePlotSpec({
    rows: rowsRaw,
    columns: columnsRaw,
    color,
    opacity,
    size,
    shape,
    theta,
    radius,
    text,
    details = [],
    interactiveScale,
    dataSource,
    layoutMode,
    width,
    height,
    defaultAggregated,
    geomType,
    stack,
    scales,
    mediaTheme,
    vegaConfig,
    displayOffset,
}: {
    rows: readonly IViewField[];
    columns: readonly IViewField[];
    color?: IViewField;
    opacity?: IViewField;
    size?: IViewField;
    shape?: IViewField;
    theta?: IViewField;
    radius?: IViewField;
    text?: IViewField;
    details?: Readonly<IViewField[]>;
    interactiveScale: boolean;
    dataSource: readonly IRow[];
    layoutMode: string;
    width: number;
    height: number;
    defaultAggregated: boolean;
    stack: IStackMode;
    geomType: string;
    scales?: IChannelScales;
    mediaTheme: 'dark' | 'light';
    vegaConfig: VegaGlobalConfig;
    displayOffset?: number;
}): any[] {
    const vlSpecs: any[] = toVegaSpec({
        rows: rowsRaw,
        columns: columnsRaw,
        color,
        opacity,
        size,
        shape,
        theta,
        radius,
        text,
        details,
        interactiveScale,
        dataSource,
        layoutMode,
        width,
        height,
        defaultAggregated,
        geomType,
        stack,
        scales,
        mediaTheme,
        vegaConfig,
        displayOffset,
    });

    console.log({ vlSpecs });

    const plotSpecs: any[] = vlSpecs.map((vlSpec) => vegaLiteToPlot(vlSpec));

    console.log({ plotSpecs });
    return plotSpecs;
}
