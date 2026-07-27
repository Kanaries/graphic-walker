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
    const shapeField = enc.shape?.field || null;
    const opacityField = enc.opacity?.field || null;
    const opacityValue = enc.opacity?.value ?? null;
    const tooltipEnc = enc.tooltip;

    console.log({ xField, yField, xFacetField, yFacetField, colorField, sizeField, shapeField, opacityField, opacityValue, tooltipEnc });
    // etc. shape, opacity, text, etc. if present

    // Helper function to determine mark direction based on axis types
    const getMarkDirection = (markType: string, enc: any, preferredAxis?: 'X' | 'Y') => {
        const xIsQuantitative = enc.x?.type === 'quantitative';
        const yIsQuantitative = enc.y?.type === 'quantitative';
        const xIsTemporal = enc.x?.type === 'temporal';
        const yIsTemporal = enc.y?.type === 'temporal';
        
        // For marks that have directional variants, determine the appropriate direction
        const directionalMarks = {
            bar: { X: Plot.barX, Y: Plot.barY },
            area: { X: Plot.areaX, Y: Plot.areaY },
            line: { X: Plot.lineX, Y: Plot.lineY },
            tick: { X: Plot.tickX, Y: Plot.tickY },
            rect: { X: Plot.rectX, Y: Plot.rectY },
            rule: { X: Plot.ruleX, Y: Plot.ruleY },
            boxplot: { X: Plot.boxX, Y: Plot.boxY },
        };
        
        if (directionalMarks[markType]) {
            if (preferredAxis) {
                return { markFunction: directionalMarks[markType][preferredAxis], stackAxis: preferredAxis };
            }
            // If X is quantitative and Y is not quantitative (temporal, ordinal, nominal), use X-direction mark
            if (xIsQuantitative && !yIsQuantitative) {
                console.log(`Using X-direction mark for ${markType}: X is quantitative (${enc.x?.type}), Y is ${enc.y?.type}`);
                return { markFunction: directionalMarks[markType].X, stackAxis: 'X' as const };
            }
            // If Y is quantitative and X is not quantitative, use Y-direction mark
            if (yIsQuantitative && !xIsQuantitative) {
                console.log(`Using Y-direction mark for ${markType}: Y is quantitative (${enc.y?.type}), X is ${enc.x?.type}`);
                return { markFunction: directionalMarks[markType].Y, stackAxis: 'Y' as const };
            }
            // If both are quantitative, default to Y-direction (most common case)
            if (xIsQuantitative && yIsQuantitative) {
                console.log(`Both axes quantitative for ${markType}, defaulting to Y-direction`);
                return { markFunction: directionalMarks[markType].Y, stackAxis: 'Y' as const };
            }
            // If neither is quantitative, default to Y-direction
            console.log(`Neither axis quantitative for ${markType}, defaulting to Y-direction`);
            return { markFunction: directionalMarks[markType].Y, stackAxis: 'Y' as const };
        }
        
        // For non-directional marks, return the base mark
        const nonDirectionalMarks = {
            point: Plot.dot,
            circle: Plot.dot,
            dot: Plot.dot,
            text: Plot.text,
        };
        
        return { 
            markFunction: nonDirectionalMarks[markType] || Plot.dot, 
            stackAxis: preferredAxis || ('Y' as const),
        };
    };

    // Helper function to create base configuration for any mark type
    const createBaseConfig = (markType: string, enc: any, fields: any) => {
        const { xField, yField, colorField, sizeField, shapeField, opacityField, opacityValue, xFacetField, yFacetField } = fields;
        
        // Base configuration that works for most marks
        const baseConfig: any = {
            x: xField || undefined,
            y: yField || undefined,
            fx: xFacetField || undefined,
            fy: yFacetField || undefined,
        };

        if (opacityField) {
            baseConfig.opacity = opacityField;
        } else if (opacityValue !== null && opacityValue !== undefined) {
            baseConfig.opacity = opacityValue;
        }
        
        // Add mark-specific channels
        switch (markType) {
            case 'bar':
            case 'area':
            case 'rect':
            case 'boxplot':
                baseConfig.fill = colorField || undefined;
                break;
            case 'line':
            case 'tick':
            case 'rule':
                baseConfig.stroke = colorField || undefined;
                break;
            case 'point':
                baseConfig.stroke = colorField || undefined;
                baseConfig.fill = 'none';
                baseConfig.r = sizeField || undefined;
                baseConfig.symbol = shapeField || undefined;
                break;
            case 'circle':
            case 'dot':
                baseConfig.fill = colorField || undefined;
                baseConfig.stroke = undefined;
                baseConfig.r = sizeField || undefined;
                baseConfig.symbol = shapeField || undefined;
                break;
            case 'text':
                baseConfig.text = yField || xField || undefined; // Use the quantitative field for text
                baseConfig.fill = colorField || undefined;
                break;
        }
        
        return baseConfig;
    };

    // Helper function to create stack configuration
    const createStackConfig = (stackMode: string | null) => {
        const stackOptions: any = {};
        if (stackMode === "normalize") {
            stackOptions.offset = "normalize";
        } else if (stackMode === "center") {
            stackOptions.offset = "center";
        }
        
        console.log('Stack options for mark:', { stackMode, stackOptions });
        
        return stackOptions;
    };

    // Helper function to apply stacking to a supported mark
    const applyStacking = (markType: string, markFunction: any, data: any[], baseConfig: any, stackAxis: 'X' | 'Y', stackMode: string | null) => {
        // Sort data for consistent stacking based on which axis we're stacking along
        const sortedData = [...data].sort((a, b) => {
            // For X-direction stacking (stackAxis === 'X'), sort by Y field first (usually temporal)
            // For Y-direction stacking (stackAxis === 'Y'), sort by X field first (usually temporal)
            let primaryCompare = 0;
            let primaryField = stackAxis === 'X' ? yField : xField;
            
            if (primaryField) {
                // Check if the primary field is temporal
                const primaryFieldType = stackAxis === 'X' ? enc.y?.type : enc.x?.type;
                if (primaryFieldType === 'temporal') {
                    primaryCompare = new Date(a[primaryField]).getTime() - new Date(b[primaryField]).getTime();
                } else {
                    // For non-temporal fields, do string/numeric comparison
                    if (a[primaryField] < b[primaryField]) primaryCompare = -1;
                    else if (a[primaryField] > b[primaryField]) primaryCompare = 1;
                    else primaryCompare = 0;
                }
            }
            
            if (primaryCompare !== 0) return primaryCompare;
            
            // Secondary sort by color field for consistent stacking order
            if (!colorField) return 0;
            if (a[colorField] < b[colorField]) return -1;
            if (a[colorField] > b[colorField]) return 1;
            return 0;
        });
        
        const stackOptions = createStackConfig(stackMode);
        const rangedMark = markType === 'bar' || markType === 'area';
        const stackFunction = stackAxis === 'X' ? (rangedMark ? Plot.stackX : Plot.stackX2) : rangedMark ? Plot.stackY : Plot.stackY2;
        
        // Ensure z channel is set for grouping
        const configWithZ = {
            ...baseConfig,
            z: colorField || undefined,
        };
        
        console.log(`Applying ${stackAxis}-direction stacking:`, {
            stackFunction: stackFunction.name,
            stackOptions,
            dataLength: sortedData.length,
            primaryField: stackAxis === 'X' ? yField : xField,
            colorField
        });
        
        return markFunction(sortedData, stackFunction(stackOptions, configWithZ));
    };

    // 4) Resolve Vega-Lite's mark-aware stack semantics.
    const resolveStack = (markType: string, enc: any, defaultAxis: 'X' | 'Y') => {
        const explicitlyStackableMarks = new Set(['bar', 'area', 'point', 'circle', 'dot', 'line', 'text', 'tick']);
        const defaultStackMarks = new Set(['bar', 'area']);
        const channels = [
            { axis: 'X' as const, encoding: enc.x },
            { axis: 'Y' as const, encoding: enc.y },
        ].filter(({ encoding }) => encoding?.type === 'quantitative' && !encoding.bin);
        const hasExplicitStack = channels.some(({ encoding }) => encoding.stack !== undefined);
        const explicitChannel = channels.find(({ encoding }) => Boolean(encoding.stack));

        if (hasExplicitStack) {
            const mode = explicitChannel?.encoding.stack;
            const enabled = mode === true || mode === 'zero' || mode === 'normalize' || mode === 'center';
            // Graphic Walker expresses stack series through color. Without one, Plot would
            // normalize each pre-aggregated datum to 100% (or center it around zero).
            const hasRequiredGroup = (mode !== 'normalize' && mode !== 'center') || Boolean(enc.color?.field);
            if (enabled && hasRequiredGroup && explicitChannel && explicitlyStackableMarks.has(markType)) {
                return {
                    stacked: true,
                    axis: explicitChannel.axis,
                    mode: mode === 'normalize' || mode === 'center' ? mode : null,
                };
            }
            return { stacked: false, axis: defaultAxis, mode: null };
        }

        if (defaultStackMarks.has(markType) && channels.length > 0) {
            return {
                stacked: true,
                axis: channels.length === 1 ? channels[0].axis : ('Y' as const),
                mode: null,
            };
        }

        return { stacked: false, axis: defaultAxis, mode: null };
    };

    const suppressImplicitStack = (markType: string, enc: any, baseConfig: any, stackAxis: 'X' | 'Y') => {
        if (!['bar', 'area', 'rect'].includes(markType)) return baseConfig;

        const axis = stackAxis === 'X' ? 'x' : 'y';
        if (enc[axis]?.type !== 'quantitative') return baseConfig;

        const value = baseConfig[axis];
        const config = { ...baseConfig };
        delete config[axis];
        if (stackAxis === 'X') {
            config.x1 = 0;
            config.x2 = value;
        } else {
            config.y1 = 0;
            config.y2 = value;
        }
        return config;
    };

    // Universal mark creation function
    const createMark = (markType: string, data: any[], enc: any, fields: any) => {
        const { colorField } = fields;
        
        // Resolve stacking before choosing the directional mark so explicit X stacks use X marks.
        const defaultDirection = getMarkDirection(markType, enc);
        const stack = resolveStack(markType, enc, defaultDirection.stackAxis);
        const { markFunction, stackAxis } = getMarkDirection(markType, enc, stack.stacked ? stack.axis : undefined);
        
        // Create base configuration
        const baseConfig = createBaseConfig(markType, enc, fields);
        const unstackedConfig = stack.stacked ? baseConfig : suppressImplicitStack(markType, enc, baseConfig, stackAxis);
        
        console.log(`Creating ${markType} mark:`, {
            markFunction: markFunction.name,
            stackAxis,
            stacked: stack.stacked,
            stackMode: stack.mode,
            colorField,
            hasColorField: !!colorField,
            isStackableMarkType: ['bar', 'area'].includes(markType),
            xType: enc.x?.type,
            yType: enc.y?.type
        });
        
        if (stack.stacked) {
            // Apply stacking
            return applyStacking(markType, markFunction, data, baseConfig, stackAxis, stack.mode);
        } else if (colorField && ['line', 'area'].includes(markType)) {
            // For multi-series line/area charts without stacking, add z channel for grouping
            // and ensure proper data sorting for line charts
            let sortedData = data;
            
            if (markType === 'line') {
                // For line charts, we need special handling based on axis orientation
                const xIsQuantitative = enc.x?.type === 'quantitative';
                const yIsTemporal = enc.y?.type === 'temporal';
                const xIsTemporal = enc.x?.type === 'temporal';
                const yIsQuantitative = enc.y?.type === 'quantitative';
                
                // Sort by the temporal field to ensure proper line connection
                sortedData = [...data].sort((a, b) => {
                    // Determine which field is temporal and sort by it
                    let temporalField = null;
                    if (xIsTemporal) {
                        temporalField = xField;
                    } else if (yIsTemporal) {
                        temporalField = yField;
                    }
                    
                    if (temporalField) {
                        const timeCompare = new Date(a[temporalField]).getTime() - new Date(b[temporalField]).getTime();
                        if (timeCompare !== 0) return timeCompare;
                    }
                    
                    // Secondary sort by color field for consistent grouping
                    return colorField && a[colorField] < b[colorField] ? -1 : 1;
                });
                
                console.log(`Sorted line chart data:`, {
                    temporalField: xIsTemporal ? xField : yField,
                    xIsQuantitative,
                    yIsTemporal,
                    originalLength: data.length,
                    sortedLength: sortedData.length,
                    sampleData: sortedData.slice(0, 3)
                });
                
                // For the case where X is quantitative and Y is temporal,
                // we need to ensure the line connects properly
                if (xIsQuantitative && yIsTemporal) {
                    console.log('Special case: X quantitative, Y temporal - using curve: "linear" for better connection');
                    const configWithZ = {
                        ...unstackedConfig,
                        z: colorField || undefined,
                        curve: "linear" // Ensure linear interpolation
                    };
                    return markFunction(sortedData, configWithZ);
                }
            }
            
            const configWithZ = {
                ...unstackedConfig,
                z: colorField || undefined,
            };
            return markFunction(sortedData, configWithZ);
        } else {
            // Regular mark without stacking
            return markFunction(data, unstackedConfig);
        }
    };

    // 5) Build the Plot mark using the universal function
    const fields = { xField, yField, colorField, sizeField, shapeField, opacityField, opacityValue, xFacetField, yFacetField };
    let mark: Plot.Mark = createMark(markType, data, enc, fields);

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
            legend: colorField ? true : undefined,
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

// named export for unit testing only
export const __test__vegaLiteToPlot = vegaLiteToPlot;
