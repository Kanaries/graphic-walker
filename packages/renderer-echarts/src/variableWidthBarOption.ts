import type { EChartsSeries, FacetCell } from "./types";

import {
    BAR_CATEGORY_FIELD,
    BAR_VALUE_FIELD,
    BAR_STACK_END_FIELD,
    BAR_STACK_START_FIELD,
    BAR_WIDTH_RATIO_FIELD,
    layoutVariableWidthBarGroups,
} from "./barStackLayout";
import { axisTypeForField, niceCeil, scaleRange } from "./utils";

type OptionState = ReturnType<typeof import("./optionContext").createOptionContext>;

export function appendVariableWidthBarSeries(params: {
    state: OptionState;
    datasets: Array<Record<string, any>>;
    series: EChartsSeries[];
    cell: FacetCell;
    cellIndex: number;
    xAxis: Record<string, any>;
    yAxis: Record<string, any>;
}) {
    const { state, datasets, series, cell, cellIndex, xAxis, yAxis } = params;
    const {
        props,
        sortedSource,
        rowFacetBinding,
        colFacetBinding,
        xField,
        yField,
        colorField,
        opacityField,
        sizeField,
        shapeField,
        detailFields,
        useDiscreteColor,
        useDiscreteOpacity,
        useDiscreteSize,
        useDiscreteShape,
        colorValues,
        opacityValues,
        sizeValues,
        shapeValues,
        categoryPalette,
        defaultColor,
        xValues,
        opacityMin,
        opacityMax,
        sizeMin,
        sizeMax,
    } = state;

    const isVerticalBar = axisTypeForField(xField.field) === "category" && axisTypeForField(yField.field) === "value";
    const isHorizontalBar = axisTypeForField(xField.field) === "value" && axisTypeForField(yField.field) === "category";

    if (
        state.geomType !== "bar" ||
        !sizeField.key ||
        (!isVerticalBar && !isHorizontalBar) ||
        !xField.key ||
        !yField.key
    ) {
        return false;
    }

    const splitBarOpacity = Boolean(opacityField.key);
    const overlayDiscreteSizeBars = useDiscreteSize && !useDiscreteColor && !useDiscreteOpacity && !splitBarOpacity && !useDiscreteShape && detailFields.length === 0;
    const cellRows = sortedSource.filter((row) => {
        if (rowFacetBinding.key && row[rowFacetBinding.key] !== cell.rowValue) return false;
        if (colFacetBinding.key && row[colFacetBinding.key] !== cell.colValue) return false;
        return true;
    });
    const detailSeriesValues = detailFields.length > 0
        ? Array.from(new Map(cellRows.map((row) => [JSON.stringify(detailFields.map((field) => row[field.key])), detailFields.map((field) => row[field.key])])).values())
        : [[] as any[]];
    const opacitySeriesValues = (useDiscreteOpacity || splitBarOpacity)
        ? Array.from(new Set(cellRows.map((row) => row[opacityField.key as string]).filter((value) => value !== null && value !== undefined)))
        : [null];
    const sizeSeriesValues = useDiscreteSize
        ? Array.from(new Set(cellRows.map((row) => row[sizeField.key as string]).filter((value) => value !== null && value !== undefined)))
        : [null];

    const groups: Array<{ name: string; rows: Array<Record<string, any>>; fill?: string; opacity?: number; order: number }> = [];
    let order = 0;
    colorValues.forEach((colorValue) => {
        shapeValues.forEach((shapeValue) => {
            opacitySeriesValues.forEach((opacityValue) => {
                sizeSeriesValues.forEach((sizeValue) => {
                    detailSeriesValues.forEach((detailValues) => {
                        const filteredRows = cellRows.filter((row) => {
                            if (useDiscreteColor && colorField.key && colorValue !== null && row[colorField.key] !== colorValue) return false;
                            if (useDiscreteShape && shapeField.key && shapeValue !== null && row[shapeField.key] !== shapeValue) return false;
                            if ((useDiscreteOpacity || splitBarOpacity) && opacityField.key && opacityValue !== null && row[opacityField.key] !== opacityValue) return false;
                            if (useDiscreteSize && sizeField.key && sizeValue !== null && row[sizeField.key] !== sizeValue) return false;
                            for (let index = 0; index < detailFields.length; index += 1) {
                                if (row[detailFields[index].key] !== detailValues[index]) return false;
                            }
                            return true;
                        });
                        if (filteredRows.length === 0) return;
                        const nameParts: string[] = [];
                        if (useDiscreteColor && colorValue !== null) nameParts.push(`${colorValue}`);
                        if (useDiscreteShape && shapeValue !== null) nameParts.push(`${shapeValue}`);
                        if ((useDiscreteOpacity || splitBarOpacity) && opacityValue !== null) nameParts.push(`${opacityValue}`);
                        if (useDiscreteSize && sizeValue !== null) nameParts.push(`${sizeValue}`);
                        detailFields.forEach((field, index) => {
                            nameParts.push(`${field.title}: ${detailValues[index]}`);
                        });
                        const discreteOpacityIndex = opacityValues.findIndex((item) => item === opacityValue);
                        const fill = useDiscreteColor && colorValue !== null
                            ? categoryPalette[Math.max(0, colorValues.findIndex((item) => item === colorValue)) % Math.max(1, categoryPalette.length)]
                            : defaultColor;
                        const opacity = useDiscreteOpacity && opacityValue !== null
                            ? scaleRange(discreteOpacityIndex, 0, Math.max(1, opacityValues.length - 1), 0.25, 1)
                            : splitBarOpacity && opacityValue !== null
                              ? scaleRange(Number(opacityValue), opacityMin, opacityMax, 0.2, 1)
                              : undefined;
                        groups.push({
                            name: nameParts.length > 0 ? nameParts.join(" / ") : "default",
                            rows: filteredRows,
                            fill,
                            opacity,
                            order: order++,
                        });
                    });
                });
            });
        });
    });

    const layout = layoutVariableWidthBarGroups({
        groups,
        xKey: isVerticalBar ? xField.key : yField.key,
        yKey: isVerticalBar ? yField.key : xField.key,
        sizeKey: sizeField.key,
        useDiscreteSize,
        sizeValues: sizeValues.filter((value) => value !== null),
        sizeMin,
        sizeMax,
        stackMode: (props.layout.stack ?? "stack") as "none" | "stack" | "normalize" | "center" | "zero",
        xValues: isVerticalBar ? xValues : state.yValues,
    });
    const visibleDiscreteSizeOrder = overlayDiscreteSizeBars ? Math.max(...groups.map((group) => group.order)) : -1;

    const valueAxis = isVerticalBar ? yAxis : xAxis;
    valueAxis.min = layout.yAxisMin;
    valueAxis.max = layout.yAxisMax > 0 ? niceCeil(layout.yAxisMax * (overlayDiscreteSizeBars ? 1.05 : 1)) : undefined;
    valueAxis.splitNumber = layout.usePercentageAxis ? 10 : valueAxis.splitNumber;
    valueAxis.axisLabel = layout.usePercentageAxis ? { formatter: (value: number) => `${Math.round(value * 100)}%` } : valueAxis.axisLabel;

    layout.datasets.forEach(({ group, source }) => {
        const datasetIndex = datasets.push({ source }) - 1;
        series.push({
            name: group.name,
            type: "custom",
            datasetIndex,
            xAxisIndex: cellIndex,
            yAxisIndex: cellIndex,
            encode: {
                x: isVerticalBar ? BAR_CATEGORY_FIELD : BAR_STACK_END_FIELD,
                y: isVerticalBar ? BAR_STACK_END_FIELD : BAR_CATEGORY_FIELD,
            },
            renderItem(_params: any, api: any) {
                if (overlayDiscreteSizeBars && group.order !== visibleDiscreteSizeOrder) {
                    return null;
                }
                const category = api.value(BAR_CATEGORY_FIELD);
                const rawValue = Number(api.value(BAR_VALUE_FIELD));
                const start = Number(api.value(BAR_STACK_START_FIELD));
                const end = Number(api.value(BAR_STACK_END_FIELD));
                const ratio = Number(api.value(BAR_WIDTH_RATIO_FIELD));
                if (!Number.isFinite(end) || (!overlayDiscreteSizeBars && !Number.isFinite(start))) return null;
                const rectStart = overlayDiscreteSizeBars ? 0 : start;
                const rectEnd = overlayDiscreteSizeBars ? rawValue : end;
                if (!Number.isFinite(rectEnd)) return null;
                const endPoint = isVerticalBar ? api.coord([category, rectEnd]) : api.coord([rectEnd, category]);
                const startPoint = isVerticalBar ? api.coord([category, rectStart]) : api.coord([rectStart, category]);
                const bandWidth = Math.abs(isVerticalBar ? (api.size([1, 0])[0] ?? 28) : (api.size([0, 1])[1] ?? 28));
                const widthRatio = overlayDiscreteSizeBars ? Math.min(0.18, Number.isFinite(ratio) ? ratio : 0.18) : Number.isFinite(ratio) ? ratio : 0.9;
                const width = Math.max(2, bandWidth * widthRatio);
                const x = isVerticalBar ? endPoint[0] - width / 2 : Math.min(endPoint[0], startPoint[0]);
                const y = isVerticalBar ? Math.min(endPoint[1], startPoint[1]) : endPoint[1] - width / 2;
                const widthOrHeight = Math.max(1, isVerticalBar ? Math.abs(startPoint[1] - endPoint[1]) : Math.abs(startPoint[0] - endPoint[0]));
                const lineTop = isVerticalBar ? api.coord([category, end]) : api.coord([end, category]);
                const lineBottom = isVerticalBar ? api.coord([category, rectEnd]) : api.coord([rectEnd, category]);
                const strokeWidth = Math.max(1, Math.min(2, width * 0.12));
                return {
                    type: overlayDiscreteSizeBars && end > rectEnd ? "group" : "rect",
                    ...(overlayDiscreteSizeBars && end > rectEnd
                        ? {
                              children: [
                                  {
                                      type: "rect",
                                      shape: isVerticalBar ? { x, y, width, height: widthOrHeight } : { x, y, width: widthOrHeight, height: width },
                                      style: api.style({
                                          fill: group.fill ?? api.visual("color") ?? defaultColor,
                                          opacity: group.opacity ?? api.visual("opacity") ?? 0.92,
                                      }),
                                  },
                                  {
                                      type: "line",
                                      shape: {
                                          x1: isVerticalBar ? endPoint[0] : lineBottom[0],
                                          y1: isVerticalBar ? lineBottom[1] : endPoint[1],
                                          x2: lineTop[0],
                                          y2: lineTop[1],
                                      },
                                      style: {
                                          stroke: group.fill ?? api.visual("color") ?? defaultColor,
                                          lineWidth: strokeWidth,
                                          opacity: group.opacity ?? api.visual("opacity") ?? 0.92,
                                      },
                                  },
                              ],
                          }
                        : {
                              shape: isVerticalBar ? { x, y, width, height: widthOrHeight } : { x, y, width: widthOrHeight, height: width },
                              style: api.style({
                                  fill: group.fill ?? api.visual("color") ?? defaultColor,
                                  opacity: group.opacity ?? api.visual("opacity") ?? 0.92,
                              }),
                          }),
                };
            },
        });
    });

    return true;
}
