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

    // 4) Check for stacking in encoding channels (not just transforms)
    //    In Vega-Lite, stacking is indicated by the 'stack' property on quantitative encodings
    let stacked = false;
    
    // Check if any quantitative encoding has stack property that's not null/false
    if (enc.x?.stack !== null && enc.x?.stack !== false && enc.x?.type === 'quantitative') {
        stacked = true;
    }
    if (enc.y?.stack !== null && enc.y?.stack !== false && enc.y?.type === 'quantitative') {
        stacked = true;
    }
    if (enc.theta?.stack !== null && enc.theta?.stack !== false && enc.theta?.type === 'quantitative') {
        stacked = true;
    }
    if (enc.radius?.stack !== null && enc.radius?.stack !== false && enc.radius?.type === 'quantitative') {
        stacked = true;
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
            
            if (stacked && colorField) {
                if (xIsQuantitative && !yIsQuantitative) {
                    // X is quantitative, Y is nominal/ordinal -> horizontal bars with X-axis stacking
                    mark = Plot.barX(
                        data,
                        Plot.stackX({
                            x: xField || undefined,
                            y: yField || undefined,
                            fill: colorField || undefined,
                            fx: xFacetField || undefined,
                            fy: yFacetField || undefined,
                        })
                    );
                } else {
                    // Y is quantitative (default case) -> vertical bars with Y-axis stacking
                    mark = Plot.barY(
                        data,
                        Plot.stackY({
                            x: xField || undefined,
                            y: yField || undefined,
                            fill: colorField || undefined,
                            fx: xFacetField || undefined,
                            fy: yFacetField || undefined,
                        })
                    );
                }
            } else {
                if (xIsQuantitative && !yIsQuantitative) {
                    // X is quantitative, Y is nominal/ordinal -> horizontal bars
                    mark = Plot.barX(data, {
                        x: xField || undefined,
                        y: yField || undefined,
                        fill: colorField || undefined,
                        fx: xFacetField || undefined,
                        fy: yFacetField || undefined,
                    });
                } else {
                    // Y is quantitative (default case) -> vertical bars
                    mark = Plot.barY(data, {
                        x: xField || undefined,
                        y: yField || undefined,
                        fill: colorField || undefined,
                        fx: xFacetField || undefined,
                        fy: yFacetField || undefined,
                    });
                }
            }
            break;

        case 'point':
            mark = Plot.dot(data, {
                x: xField || undefined,
                y: yField || undefined,
                fill: colorField || undefined,
                r: sizeField || undefined,
                fx: xFacetField || undefined,
                fy: yFacetField || undefined,
            });
            break;
        case 'tick':
            mark = Plot.tickY(data, {
                x: xField || undefined,
                y: yField || undefined,
                stroke: colorField || undefined,
                fx: xFacetField || undefined,
                fy: yFacetField || undefined,
            });
            break;

        case 'line':
            mark = Plot.line(data, {
                x: xField || undefined,
                y: yField || undefined,
                stroke: colorField || undefined,
                fx: xFacetField || undefined,
                fy: yFacetField || undefined,
            });
            break;

        case 'area':
            // In Vega-Lite, "area" often implies stacked area if "stack" is used
            // Determine which axis is quantitative to decide stacking direction
            const areaXIsQuantitative = enc.x?.type === 'quantitative';
            const areaYIsQuantitative = enc.y?.type === 'quantitative';
            
            if (stacked) {
                if (areaXIsQuantitative && !areaYIsQuantitative) {
                    // X is quantitative, Y is nominal/ordinal -> horizontal area with X-axis stacking
                    mark = Plot.areaX(
                        data,
                        Plot.stackX({
                            x: xField || undefined,
                            y: yField || undefined,
                            fill: colorField || undefined,
                            fx: xFacetField || undefined,
                            fy: yFacetField || undefined,
                        })
                    );
                } else {
                    // Y is quantitative (default case) -> vertical area with Y-axis stacking
                    mark = Plot.areaY(
                        data,
                        Plot.stackY({
                            x: xField || undefined,
                            y: yField || undefined,
                            fill: colorField || undefined,
                            fx: xFacetField || undefined,
                            fy: yFacetField || undefined,
                        })
                    );
                }
            } else {
                if (areaXIsQuantitative && !areaYIsQuantitative) {
                    // X is quantitative, Y is nominal/ordinal -> horizontal area
                    mark = Plot.areaX(data, {
                        x: xField || undefined,
                        y: yField || undefined,
                        fill: colorField || undefined,
                        fx: xFacetField || undefined,
                        fy: yFacetField || undefined,
                    });
                } else {
                    // Y is quantitative (default case) -> vertical area
                    mark = Plot.areaY(data, {
                        x: xField || undefined,
                        y: yField || undefined,
                        fill: colorField || undefined,
                        fx: xFacetField || undefined,
                        fy: yFacetField || undefined,
                    });
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
