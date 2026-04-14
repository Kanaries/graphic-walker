import { buildDiscreteColorLegendGraphic, buildDiscreteOpacityLegendGraphic, buildDiscreteShapeLegendGraphic, buildDiscreteSizeLegendGraphic, buildOpacityLegendGraphic, buildSizeLegendGraphic, createXAxisOptions, createYAxisOptions, formatValueLabel, getDiscreteLegendBlockHeight, getQuantitativeLegendBlockHeight, gridCell } from "./legends";
import { createSeriesByGeom } from "./series";
import { appendVariableWidthBarSeries } from "./variableWidthBarOption";
import type { EChartsSeries, FacetCell, SeriesVisualEncoding } from "./types";
import {
    axisTypeForField,
    createTooltip,
    isScatterLikeGeom,
    isSyntheticMeasureFacetField,
    niceCeil,
    parsePercent,
    resolveVegaAlignedRanges,
    scaleRange,
    symbolForOrderedShape,
    VEGA_LITE_DEFAULT_PRIMARY_COLOR,
} from "./utils";

const RECT_X_INDEX_FIELD = "__gw_rect_x_index__";
const RECT_Y_INDEX_FIELD = "__gw_rect_y_index__";

function aboveGridTop(grid: Record<string, any>, offsetPercent = 2.8) {
    return `${Math.max(0.8, parsePercent(grid.top) - offsetPercent)}%`;
}

function rowsForFacetCell(
    rows: Array<Record<string, any>>,
    cell: FacetCell,
    rowFacetBinding: { key?: string },
    colFacetBinding: { key?: string },
) {
    return rows.filter((row) => {
        if (rowFacetBinding.key && row[rowFacetBinding.key] !== cell.rowValue) return false;
        if (colFacetBinding.key && row[colFacetBinding.key] !== cell.colValue) return false;
        return true;
    });
}

function computeStackExtent(params: {
    rows: Array<Record<string, any>>;
    stackKey?: string;
    valueKey?: string;
}) {
    const { rows, stackKey, valueKey } = params;
    if (!stackKey || !valueKey) {
        return undefined;
    }

    const totals = new Map<string, { positive: number; negative: number }>();
    for (const row of rows) {
        const stackValue = row[stackKey];
        const value = Number(row[valueKey]);
        if (!Number.isFinite(value)) {
            continue;
        }
        const key = String(stackValue);
        const entry = totals.get(key) ?? { positive: 0, negative: 0 };
        if (value >= 0) {
            entry.positive += value;
        } else {
            entry.negative += value;
        }
        totals.set(key, entry);
    }

    if (totals.size === 0) {
        return undefined;
    }

    const max = Math.max(...Array.from(totals.values(), (entry) => entry.positive));
    const min = Math.min(...Array.from(totals.values(), (entry) => entry.negative));
    return { min, max };
}

function numericExtent(rows: Array<Record<string, any>>, key?: string) {
    if (!key) {
        return undefined;
    }
    const values = rows.map((row) => Number(row[key])).filter((value) => Number.isFinite(value));
    if (values.length === 0) {
        return undefined;
    }
    return {
        min: Math.min(...values),
        max: Math.max(...values),
    };
}

function splitNumberForRange(max?: number, min = 0) {
    if (!Number.isFinite(max)) {
        return undefined;
    }
    const span = Math.abs((max ?? 0) - min);
    if (span <= 100) return 3;
    if (span <= 200) return 4;
    if (span <= 24_000) return 10;
    if (span <= 1_000) return 8;
    return 6;
}

function sortRowsForSeries(params: {
    rows: Array<Record<string, any>>;
    geomType: string;
    xField: { key?: string; field?: any };
    yField: { key?: string; field?: any };
    xOrder: Map<string, number>;
    yOrder: Map<string, number>;
}) {
    const { rows, geomType, xField, yField, xOrder, yOrder } = params;
    if (geomType !== "line" && geomType !== "area") {
        return rows;
    }
    const xAxisType = axisTypeForField(xField.field);
    const yAxisType = axisTypeForField(yField.field);
    if (xAxisType === "category" && xField.key) {
        return [...rows].sort((left, right) => (xOrder.get(String(left[xField.key])) ?? Number.MAX_SAFE_INTEGER) - (xOrder.get(String(right[xField.key])) ?? Number.MAX_SAFE_INTEGER));
    }
    if (yAxisType === "category" && yField.key) {
        return [...rows].sort((left, right) => (yOrder.get(String(left[yField.key])) ?? Number.MAX_SAFE_INTEGER) - (yOrder.get(String(right[yField.key])) ?? Number.MAX_SAFE_INTEGER));
    }
    return rows;
}

export function buildCartesianOption(state: ReturnType<typeof import("./optionContext").createOptionContext>) {
    const { props, vegaConfig, xField, yField, colorField, opacityField, sizeField, shapeField, textField, geomType, categoryPalette, defaultColor, tooltipFields, rowFacetBinding, colFacetBinding, rowFacetValues, colFacetValues, useDiscreteColor, useDiscreteOpacity, useDiscreteSize, useDiscreteShape, colorValues, opacityValues, sizeValues, shapeValues, xValues, yValues, sortedSource, scatterOpacityLegendGraphic, scatterSizeLegendGraphic, quantitativeBarSizeLegendGraphic, continuousColorLegend, useCustomDiscreteLegends, showNativeLegend, nativeLegendTitle, useNativeLegendForDiscreteBarSize, numberFormat, legendRightReserve, gridTopReserve, gridBottomReserve, facetLeftReserve, sizeExtent, sizeMin, sizeMax, xMin, xMax, yMin, yMax, opacityExtent, opacityMin, opacityMax, useZeroBaselineScatter } = state;
    const datasets: Array<Record<string, any>> = [];
    const series: EChartsSeries[] = [];
    const facetCells: FacetCell[] = [];

    for (let rowIndex = 0; rowIndex < rowFacetValues.length; rowIndex += 1) {
        for (let colIndex = 0; colIndex < colFacetValues.length; colIndex += 1) {
            facetCells.push({ rowIndex, colIndex, rowValue: rowFacetValues[rowIndex], colValue: colFacetValues[colIndex] });
        }
    }

    const xAxes: Array<Record<string, any>> = [];
    const yAxes: Array<Record<string, any>> = [];
    const grids: Array<Record<string, any>> = [];
    const facetLabels: Array<Record<string, any>> = [];
    const xIndexMap = new Map(xValues.map((value, index) => [String(value), index]));
    const yIndexMap = new Map(yValues.map((value, index) => [String(value), index]));

    facetCells.forEach((cell, cellIndex) => {
        const isXMeasureFacetOnColumns = isSyntheticMeasureFacetField(colFacetBinding.field) && colFacetBinding.key === "__facet_x_measure__";
        const isYMeasureFacetOnRows = isSyntheticMeasureFacetField(rowFacetBinding.field) && rowFacetBinding.key === "__facet_y_measure__";
        const cellXAxisTitle = isXMeasureFacetOnColumns ? String(cell.colValue) : xField.title;
        const cellYAxisTitle = isYMeasureFacetOnRows ? String(cell.rowValue) : yField.title;
        const isFacetedHorizontalBar = geomType === "bar" && axisTypeForField(xField.field) === "value" && axisTypeForField(yField.field) === "category";
        const facetedValueAxisSplitNumber = facetCells.length >= 8 ? 3 : facetCells.length >= 4 ? 4 : 5;
        const cellRows = rowsForFacetCell(sortedSource, cell, rowFacetBinding, colFacetBinding);
        const shouldUseStackExtent = (geomType === "bar" || geomType === "area") && props.layout.stack !== "none";
        const cellStackedYExtent = shouldUseStackExtent && axisTypeForField(xField.field) === "category" && axisTypeForField(yField.field) === "value"
            ? computeStackExtent({ rows: cellRows, stackKey: xField.key, valueKey: yField.key })
            : undefined;
        const cellStackedXExtent = shouldUseStackExtent && axisTypeForField(xField.field) === "value" && axisTypeForField(yField.field) === "category"
            ? computeStackExtent({ rows: cellRows, stackKey: yField.key, valueKey: xField.key })
            : undefined;
        const localXExtent = axisTypeForField(xField.field) === "value" ? numericExtent(cellRows, xField.key) : undefined;
        const localYExtent = axisTypeForField(yField.field) === "value" ? numericExtent(cellRows, yField.key) : undefined;
        const independentXMin = props.layout.resolve?.x && localXExtent?.min !== undefined
            ? ((isFacetedHorizontalBar || ((geomType === "point" || geomType === "circle") && (isXMeasureFacetOnColumns || useZeroBaselineScatter))) ? 0 : localXExtent.min)
            : undefined;
        const independentYMin = props.layout.resolve?.y && localYExtent?.min !== undefined
            ? ((geomType === "bar" || geomType === "area" || ((geomType === "point" || geomType === "circle") && (isYMeasureFacetOnRows || isXMeasureFacetOnColumns || useZeroBaselineScatter))) ? 0 : localYExtent.min)
            : undefined;
        const resolvedXMax = props.layout.resolve?.x
            ? (localXExtent?.max !== undefined ? niceCeil(localXExtent.max) : undefined)
            : cellStackedXExtent?.max !== undefined
              ? Math.max(xMax ?? 0, niceCeil(cellStackedXExtent.max))
              : xMax;
        const resolvedYMax = props.layout.resolve?.y
            ? (localYExtent?.max !== undefined ? niceCeil(localYExtent.max) : undefined)
            : cellStackedYExtent?.max !== undefined
              ? Math.max(yMax ?? 0, niceCeil(cellStackedYExtent.max))
              : yMax;
        const valueXAxisLabel = { ...createXAxisOptions(xField, undefined, cellIndex).axisLabel, formatter: (value: number) => formatValueLabel(value, numberFormat) };
        const valueYAxisLabel = { ...createYAxisOptions(yField, undefined, cellIndex).axisLabel, formatter: (value: number) => formatValueLabel(value, numberFormat) };

        grids.push(gridCell(cell.rowIndex, cell.colIndex, rowFacetValues.length, colFacetValues.length, legendRightReserve, gridTopReserve, gridBottomReserve, facetLeftReserve));
        xAxes.push({
            ...createXAxisOptions(xField, axisTypeForField(xField.field) === "category" ? xValues : undefined, cellIndex),
            name: cell.rowIndex === rowFacetValues.length - 1 ? cellXAxisTitle : undefined,
            nameGap: geomType === "rect" ? 72 : axisTypeForField(xField.field) === "category" ? 62 : 34,
            nameTextStyle: geomType === "rect" ? { padding: [28, 0, 0, 0] } : axisTypeForField(xField.field) === "category" ? { padding: [30, 0, 0, 0] } : undefined,
            min: axisTypeForField(xField.field) === "value"
                ? (isFacetedHorizontalBar || ((geomType === "point" || geomType === "circle") && (isXMeasureFacetOnColumns || useZeroBaselineScatter)))
                    ? (cellStackedXExtent?.min !== undefined ? Math.min(0, cellStackedXExtent.min) : 0)
                    : props.layout.resolve?.x
                      ? independentXMin
                      : (cellStackedXExtent?.min !== undefined ? Math.min(xMin ?? 0, cellStackedXExtent.min) : xMin)
                : undefined,
            max: axisTypeForField(xField.field) === "value" ? resolvedXMax : undefined,
            splitNumber: axisTypeForField(xField.field) === "value"
                ? props.layout.resolve?.x
                    ? splitNumberForRange(resolvedXMax, independentXMin ?? 0)
                    : facetCells.length > 1
                      ? facetedValueAxisSplitNumber
                      : splitNumberForRange(resolvedXMax, xMin ?? 0)
                : undefined,
            splitArea: geomType === "rect" ? { show: true } : undefined,
            axisLabel: axisTypeForField(xField.field) === "value" ? valueXAxisLabel : createXAxisOptions(xField, axisTypeForField(xField.field) === "category" ? xValues : undefined, cellIndex).axisLabel,
        });
        yAxes.push({
            ...createYAxisOptions(yField, axisTypeForField(yField.field) === "category" ? yValues : undefined, cellIndex),
            name: cell.colIndex === 0 ? cellYAxisTitle : undefined,
            inverse: ((axisTypeForField(yField.field) === "category" && axisTypeForField(xField.field) === "value") || (((geomType === "point" || geomType === "circle" || geomType === "rect") && axisTypeForField(yField.field) === "category") || isFacetedHorizontalBar)) ? true : undefined,
            min: axisTypeForField(yField.field) === "value"
                ? (geomType === "bar" || geomType === "area" || ((geomType === "point" || geomType === "circle") && (isYMeasureFacetOnRows || isXMeasureFacetOnColumns || useZeroBaselineScatter)))
                    ? (cellStackedYExtent?.min !== undefined ? Math.min(0, cellStackedYExtent.min) : 0)
                    : props.layout.resolve?.y
                      ? independentYMin
                      : (cellStackedYExtent?.min !== undefined ? Math.min(yMin ?? 0, cellStackedYExtent.min) : yMin)
                : undefined,
            max: axisTypeForField(yField.field) === "value" ? (geomType === "line" && resolvedYMax !== undefined && !props.layout.resolve?.y ? niceCeil(resolvedYMax * 1.05) : resolvedYMax) : undefined,
            splitNumber: axisTypeForField(yField.field) === "value"
                ? props.layout.resolve?.y
                    ? splitNumberForRange(resolvedYMax, independentYMin ?? 0)
                    : facetCells.length > 1
                      ? facetedValueAxisSplitNumber
                      : splitNumberForRange(resolvedYMax, yMin ?? 0)
                : undefined,
            splitArea: geomType === "rect" ? { show: true } : undefined,
            axisLabel: axisTypeForField(yField.field) === "value" ? valueYAxisLabel : createYAxisOptions(yField, axisTypeForField(yField.field) === "category" ? yValues : undefined, cellIndex).axisLabel,
        });

        appendSingleFacetLabel({ facetLabels, grids, cellIndex, rowFacetBinding, colFacetBinding, cell, rowFacetValues, geomType });
        if (appendVariableWidthBarSeries({ state, datasets, series, cell, cellIndex, xAxis: xAxes[cellIndex], yAxis: yAxes[cellIndex] })) {
            return;
        }
        buildSeriesForCell({
            state,
            datasets,
            series,
            cell,
            cellIndex,
            xIndexMap,
            yIndexMap,
        });
    });

    appendFacetHeaderLabels({ facetLabels, grids, rowFacetBinding, colFacetBinding, rowFacetValues, colFacetValues });

    const visualMap = buildVisualMap(state, series);
    const graphics = buildGraphics(state, facetLabels);

    return {
        animation: false,
        backgroundColor: props.vegaConfig.background,
        color: colorField.key ? categoryPalette : [defaultColor],
        tooltip: createTooltip(tooltipFields, geomType),
        legend: showNativeLegend ? { show: true, orient: "vertical", top: nativeLegendTitle ? 34 : 12, right: 12, type: "scroll", icon: useNativeLegendForDiscreteBarSize || geomType === "bar" || geomType === "boxplot" ? "rect" : geomType === "line" || geomType === "area" ? "roundRect" : undefined } : { show: false },
        dataset: datasets,
        visualMap: visualMap.length > 0 ? visualMap : undefined,
        graphic: graphics.length > 0 ? graphics : undefined,
        grid: grids,
        xAxis: xAxes,
        yAxis: yAxes,
        series,
    };
}

function appendSingleFacetLabel(params: { facetLabels: Array<Record<string, any>>; grids: Array<Record<string, any>>; cellIndex: number; rowFacetBinding: any; colFacetBinding: any; cell: FacetCell; rowFacetValues: any[]; geomType: string; }) {
    const { facetLabels, grids, cellIndex, rowFacetBinding, colFacetBinding, cell } = params;
    const isXMeasureFacetOnColumns = isSyntheticMeasureFacetField(colFacetBinding.field) && colFacetBinding.key === "__facet_x_measure__";
    const isYMeasureFacetOnRows = isSyntheticMeasureFacetField(rowFacetBinding.field) && rowFacetBinding.key === "__facet_y_measure__";
    const grid = grids[cellIndex];
    const facetTitleParts = [];
    if (rowFacetBinding.key && colFacetBinding.key) facetTitleParts.push(`${rowFacetBinding.title}: ${cell.rowValue}`);
    if (rowFacetBinding.key && colFacetBinding.key) facetTitleParts.push(`${colFacetBinding.title}: ${cell.colValue}`);
    const shouldHideSingleFacetTitle = (isXMeasureFacetOnColumns && !rowFacetBinding.key) || (isYMeasureFacetOnRows && !colFacetBinding.key);
    if (facetTitleParts.length > 0 && !(rowFacetBinding.key && colFacetBinding.key) && !shouldHideSingleFacetTitle) {
        const gridCenter = parsePercent(grid.left) + parsePercent(grid.width) / 2;
        facetLabels.push({
            type: "text",
            left: `${gridCenter}%`,
            top: grid.top,
            style: { x: 0, y: -10, text: facetTitleParts.join(" | "), fill: "#444", font: "12px sans-serif", textAlign: "center" },
            silent: true,
        });
    }
}

function buildSeriesForCell(params: { state: ReturnType<typeof import("./optionContext").createOptionContext>; datasets: Array<Record<string, any>>; series: EChartsSeries[]; cell: FacetCell; cellIndex: number; xIndexMap: Map<string, number>; yIndexMap: Map<string, number>; }) {
    const { state, datasets, series, cell, cellIndex, xIndexMap, yIndexMap } = params;
    const { props, sortedSource, rowFacetBinding, colFacetBinding, useDiscreteColor, useDiscreteOpacity, useDiscreteSize, useDiscreteShape, colorField, opacityField, sizeField, shapeField, colorValues, opacityValues, sizeValues, shapeValues, geomType, categoryPalette, defaultColor, xField, yField, textField, detailFields, opacityMin, opacityMax, sizeMin, sizeMax } = state;
    const isStackableGeom = geomType === "bar" || geomType === "area";
    const splitBarOpacity = geomType === "bar" && Boolean(opacityField.key);
    const splitBarSize = false;
    const cellRows = sortedSource.filter((row) => {
        if (rowFacetBinding.key && row[rowFacetBinding.key] !== cell.rowValue) return false;
        if (colFacetBinding.key && row[colFacetBinding.key] !== cell.colValue) return false;
        return true;
    });
    const detailSeriesValues = detailFields.length > 0
        ? Array.from(
              new Map(
                  cellRows.map((row) => {
                      const values = detailFields.map((field) => row[field.key]);
                      return [JSON.stringify(values), values];
                  }),
              ).values(),
          )
        : [[] as any[]];
    const opacitySeriesValues = (useDiscreteOpacity || splitBarOpacity)
        ? Array.from(new Set(cellRows.map((row) => row[opacityField.key as string]).filter((value) => value !== null && value !== undefined)))
        : [null];
    const orderedOpacitySeriesValues = geomType === "bar" ? [...opacitySeriesValues].reverse() : opacitySeriesValues;
    const sizeSeriesValues = (useDiscreteSize || splitBarSize)
        ? Array.from(new Set(cellRows.map((row) => row[sizeField.key as string]).filter((value) => value !== null && value !== undefined)))
        : [null];
    const stackSeriesCount =
        (useDiscreteColor ? Math.max(1, colorValues.filter((value) => value !== null).length) : 1) *
        (useDiscreteShape ? Math.max(1, shapeValues.filter((value) => value !== null).length) : 1) *
        Math.max(1, opacitySeriesValues.length) *
        Math.max(1, sizeSeriesValues.length) *
        Math.max(1, detailSeriesValues.length);

    colorValues.forEach((colorValue) => {
        shapeValues.forEach((shapeValue) => {
            orderedOpacitySeriesValues.forEach((opacityValue) => {
                sizeSeriesValues.forEach((sizeValue) => {
                    detailSeriesValues.forEach((detailValues) => {
                        const filters: Array<{ field: string; value: any }> = [];
                        if (useDiscreteColor && colorField.key && colorValue !== null) filters.push({ field: colorField.key, value: colorValue });
                        if (useDiscreteShape && shapeField.key && shapeValue !== null) filters.push({ field: shapeField.key, value: shapeValue });
                        if ((useDiscreteOpacity || splitBarOpacity) && opacityField.key && opacityValue !== null) filters.push({ field: opacityField.key, value: opacityValue });
                        if ((useDiscreteSize || splitBarSize) && sizeField.key && sizeValue !== null) filters.push({ field: sizeField.key, value: sizeValue });
                        detailFields.forEach((field, index) => {
                            filters.push({ field: field.key, value: detailValues[index] });
                        });

                        const matchingRows = filters.length > 0 ? cellRows.filter((row) => filters.every((filter) => row[filter.field] === filter.value)) : cellRows;
                        const filteredRows = sortRowsForSeries({
                            rows: matchingRows,
                            geomType,
                            xField,
                            yField,
                            xOrder: xIndexMap,
                            yOrder: yIndexMap,
                        });
                        if (filteredRows.length === 0) {
                            return;
                        }
                        const resolvedMeasureForRect = colorField.key || sizeField.key || opacityField.key || yField.key;
                        const seriesNameParts = [];
                        if (useDiscreteColor && colorValue !== null) seriesNameParts.push(`${colorValue}`);
                        if (useDiscreteShape && shapeValue !== null) seriesNameParts.push(`${shapeValue}`);
                        if ((useDiscreteOpacity || splitBarOpacity) && opacityValue !== null) seriesNameParts.push(`${opacityValue}`);
                        if ((useDiscreteSize || splitBarSize) && sizeValue !== null) seriesNameParts.push(`${sizeValue}`);
                        if (detailFields.length > 0) {
                            detailFields.forEach((field, index) => {
                                seriesNameParts.push(`${field.title}: ${detailValues[index]}`);
                            });
                        }
                        const shouldStack = isStackableGeom && props.layout.stack !== "none" && stackSeriesCount > 1;
                        const stack = shouldStack ? `${cellIndex}:stack` : undefined;
                        const seriesColor = useDiscreteColor && colorValue !== null ? categoryPalette[Math.max(0, colorValues.findIndex((item) => item === colorValue)) % Math.max(1, categoryPalette.length)] : defaultColor;
                        const xAxisType = axisTypeForField(xField.field);
                        const yAxisType = axisTypeForField(yField.field);
                        const needsDerivedDataset = geomType === "rect";
                        const needsCellDataset = Boolean(rowFacetBinding.key || colFacetBinding.key);
                        const needsSeriesOrdering = (geomType === "line" || geomType === "area") && (xAxisType === "category" || yAxisType === "category");
                        const shouldUseSharedDataset = !needsDerivedDataset && !needsCellDataset && !needsSeriesOrdering && filters.length === 0;
                        const datasetIndex = shouldUseSharedDataset ? ensureSharedDataset(datasets, sortedSource) : datasets.length;
                        const discreteOpacityIndex = opacityValues.findIndex((item) => item === opacityValue);
                        const discreteSizeIndex = sizeValues.findIndex((item) => item === sizeValue);
                        const seriesVisual: SeriesVisualEncoding = {
                            opacity: useDiscreteOpacity && opacityValue !== null ? scaleRange(discreteOpacityIndex, 0, Math.max(1, opacityValues.length - 1), 0.25, 1) : splitBarOpacity && opacityValue !== null ? scaleRange(Number(opacityValue), opacityMin, opacityMax, 0.2, 1) : undefined,
                            symbolSize: useDiscreteSize && sizeValue !== null ? scaleRange(discreteSizeIndex, 0, Math.max(1, sizeValues.length - 1), geomType === "point" ? 6 : 5, geomType === "point" ? 20 : 18) : undefined,
                        };

                        if (!shouldUseSharedDataset) {
                            datasets.push({
                                source: geomType === "rect"
                                    ? filteredRows.map((row) => ({
                                          ...row,
                                          [RECT_X_INDEX_FIELD]: xIndexMap.get(String(row[xField.key as string])) ?? 0,
                                          [RECT_Y_INDEX_FIELD]: yIndexMap.get(String(row[yField.key as string])) ?? 0,
                                      }))
                                    : filteredRows.map((row) => ({ ...row })),
                            });
                        }

                        if (geomType === "bar" && !useDiscreteColor && !useDiscreteShape && !useDiscreteOpacity && !useDiscreteSize && !splitBarOpacity && !splitBarSize && detailFields.length === 0 && xAxisType === "value" && yAxisType === "value" && xField.key && yField.key) {
                            series.push({
                                name: "default",
                                type: "custom",
                                datasetIndex,
                                xAxisIndex: cellIndex,
                                yAxisIndex: cellIndex,
                                encode: { x: xField.key, y: yField.key },
                                renderItem(_params: any, api: any) {
                                    const x = Number(api.value(xField.key));
                                    const y = Number(api.value(yField.key));
                                    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
                                    const bottom = api.coord([x, 0]);
                                    const top = api.coord([x, y]);
                                    return { type: "rect", shape: { x: top[0] - 2, y: Math.min(top[1], bottom[1]), width: 4, height: Math.max(1, Math.abs(bottom[1] - top[1])) }, style: { fill: seriesColor ?? VEGA_LITE_DEFAULT_PRIMARY_COLOR } };
                                },
                            });
                            return;
                        }

                        const useHollowDiscretePoint = geomType === "point" && useDiscreteColor && !sizeField.key && !opacityField.key;
                        const useHollowSizedPoint = geomType === "point" && Boolean(sizeField.key);
                        const preferFilledPointSymbol = geomType === "point" && !useDiscreteShape && !useHollowDiscretePoint && !useHollowSizedPoint && Boolean(opacityField.key);
                        const nextSeries: Record<string, any> = createSeriesByGeom({
                            geomType,
                            xField: geomType === "rect" ? RECT_X_INDEX_FIELD : xField.key,
                            yField: geomType === "rect" ? RECT_Y_INDEX_FIELD : yField.key,
                            valueField: resolvedMeasureForRect,
                            textField: textField.key,
                            datasetIndex,
                            name: seriesNameParts.length > 0 ? seriesNameParts.join(" / ") : "default",
                            xAxisIndex: cellIndex,
                            yAxisIndex: cellIndex,
                            symbol: useDiscreteShape && shapeValue !== null ? symbolForOrderedShape(shapeValue, shapeValues) : useHollowDiscretePoint || useHollowSizedPoint ? "circle" : preferFilledPointSymbol ? "circle" : undefined,
                            stack,
                        });
                        if ((geomType === "point" || geomType === "circle") && seriesColor) {
                            nextSeries.symbolSize = sizeField.key && !useDiscreteSize
                                ? ((datum: Record<string, any>) => scaleRange(Number(datum?.[sizeField.key as string]), sizeMin, sizeMax, geomType === "point" ? 6 : 5, geomType === "point" ? 20 : 18))
                                : seriesVisual.symbolSize ?? 8;
                            nextSeries.itemStyle = {
                                ...(nextSeries.itemStyle ?? {}),
                                ...(useHollowDiscretePoint || useHollowSizedPoint ? { color: "rgba(255,255,255,0)", borderColor: seriesColor, borderWidth: 1.4 } : opacityField.key && geomType === "point" ? { color: "rgba(255,255,255,0)", borderColor: seriesColor, borderWidth: 1.4 } : { color: seriesColor }),
                                opacity: seriesVisual.opacity ?? (opacityField.key && !useDiscreteOpacity ? undefined : 0.9),
                            };
                            nextSeries.emphasis = { disabled: true };
                        } else {
                            if (seriesVisual.opacity !== undefined) {
                                nextSeries.itemStyle = {
                                    ...(nextSeries.itemStyle ?? {}),
                                    opacity: seriesVisual.opacity,
                                };
                            }
                        }
                        series.push(nextSeries);
                    });
                });
            });
        });
    });
}

function ensureSharedDataset(
    datasets: Array<Record<string, any>>,
    sortedSource: Array<Record<string, any>>,
) {
    const existingIndex = datasets.findIndex((dataset) => dataset?.source === sortedSource);
    if (existingIndex >= 0) {
        return existingIndex;
    }
    return datasets.push({ source: sortedSource }) - 1;
}

function appendFacetHeaderLabels(params: { facetLabels: Array<Record<string, any>>; grids: Array<Record<string, any>>; rowFacetBinding: any; colFacetBinding: any; rowFacetValues: any[]; colFacetValues: any[]; }) {
    const { facetLabels, grids, rowFacetBinding, colFacetBinding, rowFacetValues, colFacetValues } = params;
    if (rowFacetBinding.key && !colFacetBinding.key && !isSyntheticMeasureFacetField(rowFacetBinding.field)) {
        facetLabels.push({ type: "text", left: "1.2%", top: "50%", rotation: -Math.PI / 2, style: { text: `${rowFacetBinding.title}`, fill: "#333", font: "600 13px sans-serif", textAlign: "center" }, silent: true });
        rowFacetValues.forEach((value, index) => {
            const cellIndex = index * colFacetValues.length;
            const grid = grids[cellIndex];
            const gridMiddle = parsePercent(grid.top) + parsePercent(grid.height) / 2;
            facetLabels.push({ type: "text", left: `${Math.max(0, parsePercent(grid.left) - 4)}%`, top: `${gridMiddle}%`, style: { text: String(value), fill: "#333", font: "12px sans-serif", textAlign: "right", textVerticalAlign: "middle" }, silent: true });
        });
    }
    if (!rowFacetBinding.key && colFacetBinding.key && !isSyntheticMeasureFacetField(colFacetBinding.field)) {
        facetLabels.push({ type: "text", left: "50%", top: "0.8%", style: { text: `${colFacetBinding.title}`, fill: "#333", font: "600 13px sans-serif", textAlign: "center" }, silent: true });
        colFacetValues.forEach((value, index) => {
            const grid = grids[index];
            const gridCenter = parsePercent(grid.left) + parsePercent(grid.width) / 2;
            facetLabels.push({ type: "text", left: `${gridCenter}%`, top: aboveGridTop(grid), style: { x: 0, y: 0, text: String(value), fill: "#333", font: "12px sans-serif", textAlign: "center", textVerticalAlign: "bottom" }, silent: true });
        });
    }
    if (rowFacetBinding.key && colFacetBinding.key) {
        const showColumnFacetHeaders = !isSyntheticMeasureFacetField(colFacetBinding.field);
        const showRowFacetHeaders = !isSyntheticMeasureFacetField(rowFacetBinding.field);
        if (showColumnFacetHeaders) {
            facetLabels.push({ type: "text", left: "50%", top: "0.8%", style: { text: rowFacetBinding.title ? `${colFacetBinding.title}` : "", fill: "#333", font: "600 13px sans-serif", textAlign: "center" }, silent: true });
            colFacetValues.forEach((value, index) => {
                const grid = grids[index];
                const gridCenter = parsePercent(grid.left) + parsePercent(grid.width) / 2;
                facetLabels.push({ type: "text", left: `${gridCenter}%`, top: aboveGridTop(grid), style: { x: 0, y: 0, text: String(value), fill: "#333", font: "12px sans-serif", textAlign: "center", textVerticalAlign: "bottom" }, silent: true });
            });
        }
        if (showRowFacetHeaders) {
            facetLabels.push({ type: "text", left: "1.2%", top: "50%", rotation: -Math.PI / 2, style: { text: `${rowFacetBinding.title}`, fill: "#333", font: "600 13px sans-serif", textAlign: "center" }, silent: true });
            rowFacetValues.forEach((value, index) => {
                const cellIndex = index * colFacetValues.length;
                const grid = grids[cellIndex];
                const gridMiddle = parsePercent(grid.top) + parsePercent(grid.height) / 2;
                facetLabels.push({ type: "text", left: `${Math.max(0, parsePercent(grid.left) - 4)}%`, top: `${gridMiddle}%`, style: { x: 0, y: 0, text: String(value), fill: "#333", font: "12px sans-serif", textAlign: "right", textVerticalAlign: "middle" }, silent: true });
            });
        }
    }
}

function buildVisualMap(state: ReturnType<typeof import("./optionContext").createOptionContext>, series: EChartsSeries[]) {
    const { vegaConfig, geomType, colorField, useDiscreteColor, sortedSource, opacityField, sizeField, xField, yField } = state;
    const visualMap: Array<Record<string, any>> = [];
    const seriesIndexes = series.map((_, index) => index);
    if (colorField.key && !useDiscreteColor) {
        const numericValues = sortedSource.map((row) => Number(row[colorField.key as string])).filter((value) => Number.isFinite(value));
        const continuousScale = vegaConfig.scale?.continuous;
        const resolvedRanges = resolveVegaAlignedRanges(vegaConfig);
        const continuousColorRange = geomType === "rect"
            ? vegaConfig.range?.heatmap || vegaConfig.range?.ramp || continuousScale?.range || resolvedRanges.heatmap || resolvedRanges.ramp || resolvedRanges.category
            : continuousScale?.range || vegaConfig.range?.ramp || vegaConfig.range?.heatmap || resolvedRanges.ramp || resolvedRanges.heatmap || resolvedRanges.category;
        visualMap.push({
            type: "continuous",
            dimension: colorField.key,
            seriesIndex: seriesIndexes,
            min: numericValues.length ? Math.min(...numericValues) : undefined,
            max: numericValues.length ? Math.max(...numericValues) : undefined,
            inRange: { color: continuousColorRange },
            calculable: true,
            orient: "vertical",
            right: 16,
            top: 44,
            bottom: 44,
            splitNumber: 5,
            itemWidth: 18,
            itemHeight: geomType === "rect" ? 180 : 150,
            textGap: 8,
            precision: 0,
            formatter: (value: number) => Math.round(value).toLocaleString(),
        });
    }
    if (opacityField.key && !state.useDiscreteOpacity && (geomType === "point" || geomType === "circle")) {
        visualMap.push({ type: "continuous", dimension: opacityField.key, seriesIndex: seriesIndexes, inRange: { opacity: [0.18, 1] }, calculable: false, show: false });
    } else if (opacityField.key && !state.useDiscreteOpacity && !isScatterLikeGeom(geomType)) {
        visualMap.push({ type: "continuous", dimension: opacityField.key, seriesIndex: seriesIndexes, inRange: { opacity: [0.2, 1] }, calculable: false, show: false });
    }
    if (sizeField.key && !state.useDiscreteSize && (geomType === "point" || geomType === "circle")) {
        visualMap.push({ type: "continuous", dimension: sizeField.key, seriesIndex: seriesIndexes, inRange: { symbolSize: [geomType === "point" ? 6 : 5, geomType === "point" ? 20 : 18] }, calculable: false, show: false });
    } else if (sizeField.key && !state.useDiscreteSize && isScatterLikeGeom(geomType) && !(xField.key && yField.key)) {
        visualMap.push({ type: "continuous", dimension: sizeField.key, seriesIndex: seriesIndexes, inRange: { symbolSize: [6, 28] }, calculable: false, show: false });
    }
    return visualMap;
}

function buildGraphics(state: ReturnType<typeof import("./optionContext").createOptionContext>, facetLabels: Array<Record<string, any>>) {
    const { props, geomType, colorField, shapeField, colorValues, opacityValues, sizeValues, shapeValues, categoryPalette, useCustomDiscreteLegends, continuousColorLegend, showNativeLegend, nativeLegendTitle, sizeField, sizeExtent, sizeMin, sizeMax, scatterSizeLegendGraphic, quantitativeBarSizeLegendGraphic, opacityField, opacityExtent, opacityMin, opacityMax, scatterOpacityLegendGraphic, useDiscreteOpacity, useDiscreteSize } = state;
    const discreteColorCount = colorValues.filter((value) => value !== null).length;
    const discreteOpacityCount = opacityValues.filter((value) => value !== null).length;
    const discreteSizeCount = sizeValues.filter((value) => value !== null).length;
    const discreteShapeCount = shapeValues.filter((value) => value !== null).length;
    const colorLegendHeight = useCustomDiscreteLegends && discreteColorCount > 0 ? getDiscreteLegendBlockHeight(discreteColorCount, Boolean(colorField.title)) : 0;
    const shapeLegendHeight = useCustomDiscreteLegends && discreteShapeCount > 0 ? getDiscreteLegendBlockHeight(discreteShapeCount, Boolean(shapeField.title)) : 0;
    const opacityLegendHeight = useCustomDiscreteLegends && useDiscreteOpacity && discreteOpacityCount > 0 ? getDiscreteLegendBlockHeight(discreteOpacityCount, Boolean(opacityField.title)) : 0;
    const discreteSizeLegendHeight = useCustomDiscreteLegends && useDiscreteSize && discreteSizeCount > 0 ? getDiscreteLegendBlockHeight(discreteSizeCount, Boolean(sizeField.title)) : 0;
    let discreteLegendRows = 0;
    for (const height of [colorLegendHeight, shapeLegendHeight, opacityLegendHeight, discreteSizeLegendHeight]) {
        if (height > 0) {
            discreteLegendRows += height + (discreteLegendRows > 0 ? 8 : 0);
        }
    }
    let nextLegendStartY = 36;
    const colorLegendStartY = nextLegendStartY;
    if (colorLegendHeight > 0) nextLegendStartY += colorLegendHeight + 8;
    const shapeLegendStartY = nextLegendStartY;
    if (shapeLegendHeight > 0) nextLegendStartY += shapeLegendHeight + 8;
    const opacityLegendStartY = nextLegendStartY;
    if (opacityLegendHeight > 0) nextLegendStartY += opacityLegendHeight + 8;
    const sizeLegendStartY = nextLegendStartY;
    if (discreteSizeLegendHeight > 0) nextLegendStartY += discreteSizeLegendHeight + 8;
    const quantitativeLegendStartY = 36 + discreteLegendRows + (discreteLegendRows > 0 ? 12 : 0);
    const sizeLegendHeight = (scatterSizeLegendGraphic || quantitativeBarSizeLegendGraphic) && sizeExtent.length > 0 ? getQuantitativeLegendBlockHeight(5, Boolean(sizeField.title), 30) : 0;

    return [
        ...facetLabels,
        ...(showNativeLegend && nativeLegendTitle
            ? [{
                  type: "text",
                  right: 72,
                  top: 16,
                  style: { text: nativeLegendTitle, fill: "#222", font: "600 12px sans-serif" },
                  silent: true,
              }]
            : []),
        ...(continuousColorLegend && colorField.title ? [{ type: "text", right: 72, top: 16, style: { text: colorField.title, fill: "#222", font: "600 12px sans-serif" }, silent: true }] : []),
        ...(useCustomDiscreteLegends && discreteColorCount > 0 ? buildDiscreteColorLegendGraphic({ title: colorField.title, values: colorValues.filter((value) => value !== null), palette: categoryPalette, chartWidth: props.chartWidth, startY: colorLegendStartY, hollow: geomType === "point" }) : []),
        ...(useCustomDiscreteLegends && discreteShapeCount > 0 ? buildDiscreteShapeLegendGraphic({ title: shapeField.title, values: shapeValues.filter((value) => value !== null), chartWidth: props.chartWidth, startY: shapeLegendStartY, hollow: geomType === "point" }) : []),
        ...(useCustomDiscreteLegends && useDiscreteOpacity && discreteOpacityCount > 0 ? buildDiscreteOpacityLegendGraphic({ title: opacityField.title, values: opacityValues.filter((value) => value !== null), chartWidth: props.chartWidth, startY: opacityLegendStartY, filled: geomType === "circle", marker: geomType === "bar" ? "rect" : "circle" }) : []),
        ...(useCustomDiscreteLegends && useDiscreteSize && discreteSizeCount > 0 ? buildDiscreteSizeLegendGraphic({ title: sizeField.title, values: sizeValues.filter((value) => value !== null), chartWidth: props.chartWidth, startY: sizeLegendStartY, outMin: geomType === "point" ? 6 : 5, outMax: geomType === "point" ? 20 : 18, filled: geomType === "circle" }) : []),
        ...((scatterSizeLegendGraphic || quantitativeBarSizeLegendGraphic) && sizeExtent.length > 0 ? buildSizeLegendGraphic({ title: sizeField.title, min: sizeMin, max: sizeMax, chartWidth: props.chartWidth, chartHeight: props.chartHeight, outMin: quantitativeBarSizeLegendGraphic ? 4 : geomType === "point" ? 6 : 5, outMax: quantitativeBarSizeLegendGraphic ? 18 : geomType === "point" ? 20 : 18, startY: quantitativeLegendStartY, filled: geomType === "circle" || quantitativeBarSizeLegendGraphic, marker: quantitativeBarSizeLegendGraphic ? "rect" : "circle" }) : []),
        ...(scatterOpacityLegendGraphic && opacityExtent.length > 0 ? buildOpacityLegendGraphic({ title: opacityField.title, min: opacityMin, max: opacityMax, chartWidth: props.chartWidth, chartHeight: props.chartHeight, startY: quantitativeLegendStartY + sizeLegendHeight, filled: geomType === "circle" }) : []),
    ];
}
