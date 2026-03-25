import { buildDiscreteColorLegendGraphic, buildDiscreteShapeLegendGraphic, buildOpacityLegendGraphic, buildSizeLegendGraphic, createXAxisOptions, createYAxisOptions, getDiscreteLegendBlockHeight, getQuantitativeLegendBlockHeight, gridCell } from "./legends";
import { createSeriesByGeom } from "./series";
import type { EChartsSeries, FacetCell } from "./types";
import { axisTypeForField, createDatasetTransforms, createTooltip, isScatterLikeGeom, isSyntheticMeasureFacetField, niceCeil, parsePercent, scaleRange, symbolForOrderedShape } from "./utils";

function aboveGridTop(grid: Record<string, any>, offsetPercent = 2.8) {
    return `${Math.max(0.8, parsePercent(grid.top) - offsetPercent)}%`;
}

export function buildCartesianOption(state: ReturnType<typeof import("./optionContext").createOptionContext>) {
    const { props, vegaConfig, xField, yField, colorField, opacityField, sizeField, shapeField, textField, geomType, categoryPalette, defaultColor, tooltipFields, rowFacetBinding, colFacetBinding, rowFacetValues, colFacetValues, useDiscreteColor, useDiscreteShape, colorValues, shapeValues, xValues, yValues, sortedSource, scatterOpacityLegendGraphic, scatterSizeLegendGraphic, continuousColorLegend, useCustomDiscreteLegends, showNativeLegend, nativeLegendTitle, legendRightReserve, gridTopReserve, gridBottomReserve, facetLeftReserve, sizeExtent, sizeMin, sizeMax, xMin, xMax, yMin, yMax, opacityExtent, opacityMin, opacityMax, useZeroBaselineScatter } = state;
    const datasets: Array<Record<string, any>> = [{ source: sortedSource }];
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

        grids.push(gridCell(cell.rowIndex, cell.colIndex, rowFacetValues.length, colFacetValues.length, legendRightReserve, gridTopReserve, gridBottomReserve, facetLeftReserve));
        xAxes.push({
            ...createXAxisOptions(xField, axisTypeForField(xField.field) === "category" ? xValues : undefined, cellIndex),
            name: cell.rowIndex === rowFacetValues.length - 1 ? cellXAxisTitle : undefined,
            nameGap: geomType === "rect" ? 72 : axisTypeForField(xField.field) === "category" ? 62 : 34,
            nameTextStyle: geomType === "rect" ? { padding: [28, 0, 0, 0] } : axisTypeForField(xField.field) === "category" ? { padding: [30, 0, 0, 0] } : undefined,
            min: axisTypeForField(xField.field) === "value"
                ? (isFacetedHorizontalBar || ((geomType === "point" || geomType === "circle") && (isXMeasureFacetOnColumns || useZeroBaselineScatter))) ? 0 : !props.layout.resolve?.x ? xMin : undefined
                : undefined,
            max: !props.layout.resolve?.x && axisTypeForField(xField.field) === "value" ? xMax : undefined,
            splitNumber: axisTypeForField(xField.field) === "value" && facetCells.length > 1 ? facetedValueAxisSplitNumber : undefined,
            splitArea: geomType === "rect" ? { show: true } : undefined,
        });
        yAxes.push({
            ...createYAxisOptions(yField, axisTypeForField(yField.field) === "category" ? yValues : undefined, cellIndex),
            name: cell.colIndex === 0 ? cellYAxisTitle : undefined,
            inverse: (((geomType === "point" || geomType === "circle" || geomType === "rect") && axisTypeForField(yField.field) === "category") || isFacetedHorizontalBar) ? true : undefined,
            min: axisTypeForField(yField.field) === "value"
                ? (geomType === "bar" || geomType === "area" || ((geomType === "point" || geomType === "circle") && (Boolean(opacityField.key) || isYMeasureFacetOnRows || isXMeasureFacetOnColumns || useZeroBaselineScatter))) ? 0 : !props.layout.resolve?.y ? yMin : undefined
                : undefined,
            max: !props.layout.resolve?.y && axisTypeForField(yField.field) === "value" ? (geomType === "line" && yMax !== undefined ? niceCeil(yMax * 1.05) : yMax) : undefined,
            splitNumber: axisTypeForField(yField.field) === "value" && facetCells.length > 1 ? facetedValueAxisSplitNumber : undefined,
            splitArea: geomType === "rect" ? { show: true } : undefined,
        });

        appendSingleFacetLabel({ facetLabels, grids, cellIndex, rowFacetBinding, colFacetBinding, cell, rowFacetValues, geomType });
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
        tooltip: createTooltip(tooltipFields),
        legend: showNativeLegend ? { show: true, orient: "vertical", top: nativeLegendTitle ? 34 : 12, right: 12, type: "scroll" } : { show: false },
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
    const { props, sortedSource, rowFacetBinding, colFacetBinding, useDiscreteColor, useDiscreteShape, colorField, shapeField, colorValues, shapeValues, geomType, categoryPalette, defaultColor, xField, yField, sizeField, opacityField, textField, xValues, yValues, sizeMin, sizeMax, opacityMin, opacityMax } = state;

    colorValues.forEach((colorValue) => {
        shapeValues.forEach((shapeValue) => {
            const filters: Array<{ field: string; value: any }> = [];
            if (rowFacetBinding.key) filters.push({ field: rowFacetBinding.key, value: cell.rowValue });
            if (colFacetBinding.key) filters.push({ field: colFacetBinding.key, value: cell.colValue });
            if (useDiscreteColor && colorField.key && colorValue !== null) filters.push({ field: colorField.key, value: colorValue });
            if (useDiscreteShape && shapeField.key && shapeValue !== null) filters.push({ field: shapeField.key, value: shapeValue });

            const datasetIndex = filters.length > 0 ? datasets.length : 0;
            const filteredRows = filters.length > 0 ? sortedSource.filter((row) => filters.every((filter) => row[filter.field] === filter.value)) : sortedSource;
            if (filters.length > 0) {
                datasets.push({ fromDatasetIndex: 0, transform: createDatasetTransforms(filters) });
            }

            const resolvedMeasureForRect = colorField.key || sizeField.key || opacityField.key || yField.key;
            const seriesNameParts = [];
            if (useDiscreteColor && colorValue !== null) seriesNameParts.push(`${colorValue}`);
            if (useDiscreteShape && shapeValue !== null) seriesNameParts.push(`${shapeValue}`);
            const stack = useDiscreteColor && colorField.key && (geomType === "bar" || geomType === "area") && props.layout.stack !== "none" ? `${cellIndex}:${colorField.key}` : undefined;
            const seriesColor = useDiscreteColor && colorValue !== null ? categoryPalette[Math.max(0, colorValues.findIndex((item) => item === colorValue)) % Math.max(1, categoryPalette.length)] : defaultColor;
            const xAxisType = axisTypeForField(xField.field);
            const yAxisType = axisTypeForField(yField.field);
            const continuousScatterColor = Boolean(colorField.key && !useDiscreteColor && isScatterLikeGeom(geomType) && geomType !== "rect");

            const scatterData = isScatterLikeGeom(geomType) && geomType !== "rect" && xField.key && yField.key ? filteredRows.map((row) => {
                const datum: Record<string, any> = {
                    value: [
                        row[xField.key as string],
                        row[yField.key as string],
                        continuousScatterColor ? Number(row[colorField.key as string]) : undefined,
                        sizeField.key ? Number(row[sizeField.key as string]) : undefined,
                        opacityField.key ? Number(row[opacityField.key as string]) : undefined,
                    ],
                };
                if ((geomType === "point" || geomType === "circle") && sizeField.key) {
                    datum.symbolSize = geomType === "point" ? scaleRange(Number(row[sizeField.key as string]), sizeMin, sizeMax, 6, 20) : scaleRange(Number(row[sizeField.key as string]), sizeMin, sizeMax, 5, 18);
                }
                if ((geomType === "point" || geomType === "circle") && opacityField.key) {
                    datum.itemStyle = { opacity: scaleRange(Number(row[opacityField.key as string]), opacityMin, opacityMax, 0.18, 1) };
                }
                return datum;
            }) : undefined;

            const barCategoryData = geomType === "bar" && !useDiscreteColor && !useDiscreteShape && xAxisType === "category" && yAxisType === "value" && xField.key && yField.key ? xValues.map((value) => {
                const row = filteredRows.find((item) => item[xField.key as string] === value);
                return row ? Number(row[yField.key as string]) : "-";
            }) : undefined;
            const barHorizontalData = geomType === "bar" && !useDiscreteColor && !useDiscreteShape && xAxisType === "value" && yAxisType === "category" && xField.key && yField.key ? yValues.map((value) => {
                const row = filteredRows.find((item) => item[yField.key as string] === value);
                return row ? Number(row[xField.key as string]) : "-";
            }) : undefined;
            const lineLikeData = (geomType === "line" || geomType === "area") && xField.key && yField.key ? filteredRows.map((row) => [row[xField.key as string], Number(row[yField.key as string])]) : undefined;
            const explicitCartesianData = !scatterData && !barCategoryData && !barHorizontalData && !lineLikeData && geomType !== "rect" && xField.key && yField.key ? filteredRows.map((row) => ({ ...row })) : undefined;

            if (geomType === "bar" && !useDiscreteColor && !useDiscreteShape && xAxisType === "value" && yAxisType === "value" && xField.key && yField.key) {
                series.push({
                    name: "default",
                    type: "custom",
                    xAxisIndex: cellIndex,
                    yAxisIndex: cellIndex,
                    data: filteredRows.map((row) => [Number(row[xField.key as string]), Number(row[yField.key as string])]),
                    renderItem(_params: any, api: any) {
                        const x = Number(api.value(0));
                        const y = Number(api.value(1));
                        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
                        const bottom = api.coord([x, 0]);
                        const top = api.coord([x, y]);
                        return { type: "rect", shape: { x: top[0] - 2, y: Math.min(top[1], bottom[1]), width: 4, height: Math.max(1, Math.abs(bottom[1] - top[1])) }, style: { fill: seriesColor ?? "#5B8FF9" } };
                    },
                });
                return;
            }

            const useHollowDiscretePoint = geomType === "point" && useDiscreteColor && !sizeField.key && !opacityField.key;
            const useHollowSizedPoint = geomType === "point" && Boolean(sizeField.key);
            const preferFilledPointSymbol = geomType === "point" && !useDiscreteShape && !useHollowDiscretePoint && !useHollowSizedPoint && Boolean(opacityField.key);
            const nextSeries: Record<string, any> = createSeriesByGeom({
                geomType,
                xField: xField.key,
                yField: yField.key,
                valueField: resolvedMeasureForRect,
                textField: textField.key,
                datasetIndex,
                name: seriesNameParts.length > 0 ? seriesNameParts.join(" / ") : "default",
                xAxisIndex: cellIndex,
                yAxisIndex: cellIndex,
                symbol: useDiscreteShape && shapeValue !== null ? symbolForOrderedShape(shapeValue, shapeValues) : useHollowDiscretePoint || useHollowSizedPoint ? "circle" : preferFilledPointSymbol ? "circle" : undefined,
                stack,
                data: scatterData ? scatterData : barCategoryData ? barCategoryData : barHorizontalData ? barHorizontalData : lineLikeData ? lineLikeData : explicitCartesianData ? explicitCartesianData : geomType === "rect" ? filteredRows.map((row) => [xIndexMap.get(String(row[xField.key as string])) ?? 0, yIndexMap.get(String(row[yField.key as string])) ?? 0, row[resolvedMeasureForRect as string]]) : undefined,
            });
            if ((geomType === "point" || geomType === "circle") && seriesColor) {
                if (scatterData) delete nextSeries.encode;
                nextSeries.symbolSize = sizeField.key ? undefined : 8;
                nextSeries.itemStyle = {
                    ...(nextSeries.itemStyle ?? {}),
                    ...(useHollowDiscretePoint || useHollowSizedPoint ? { color: "rgba(255,255,255,0)", borderColor: seriesColor, borderWidth: 1.4 } : opacityField.key && geomType === "point" ? { color: "rgba(255,255,255,0)", borderColor: seriesColor, borderWidth: 1.4 } : { color: seriesColor }),
                    opacity: opacityField.key ? undefined : 0.9,
                };
                nextSeries.emphasis = { disabled: true };
            }
            if (barCategoryData || barHorizontalData || lineLikeData) delete nextSeries.encode;
            series.push(nextSeries);
        });
    });
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
        const continuousColorRange = geomType === "rect" ? vegaConfig.range?.heatmap || vegaConfig.range?.ramp || continuousScale?.range || vegaConfig.range?.category : continuousScale?.range || vegaConfig.range?.ramp || vegaConfig.range?.heatmap || vegaConfig.range?.category;
        visualMap.push({
            type: "continuous",
            dimension: geomType === "rect" ? 2 : isScatterLikeGeom(geomType) ? 2 : colorField.key,
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
    if (opacityField.key && !isScatterLikeGeom(geomType)) {
        visualMap.push({ type: "continuous", dimension: opacityField.key, seriesIndex: seriesIndexes, inRange: { opacity: [0.2, 1] }, calculable: false, show: false });
    }
    if (sizeField.key && isScatterLikeGeom(geomType) && !(xField.key && yField.key)) {
        visualMap.push({ type: "continuous", dimension: sizeField.key, seriesIndex: seriesIndexes, inRange: { symbolSize: [6, 28] }, calculable: false, show: false });
    }
    return visualMap;
}

function buildGraphics(state: ReturnType<typeof import("./optionContext").createOptionContext>, facetLabels: Array<Record<string, any>>) {
    const { props, geomType, colorField, shapeField, colorValues, shapeValues, categoryPalette, useCustomDiscreteLegends, continuousColorLegend, showNativeLegend, nativeLegendTitle, sizeField, sizeExtent, sizeMin, sizeMax, scatterSizeLegendGraphic, opacityField, opacityExtent, opacityMin, opacityMax, scatterOpacityLegendGraphic } = state;
    const discreteColorCount = colorValues.filter((value) => value !== null).length;
    const discreteShapeCount = shapeValues.filter((value) => value !== null).length;
    const colorLegendHeight = useCustomDiscreteLegends ? getDiscreteLegendBlockHeight(discreteColorCount, Boolean(colorField.title)) : 0;
    const shapeLegendHeight = useCustomDiscreteLegends && discreteShapeCount > 0 ? getDiscreteLegendBlockHeight(discreteShapeCount, Boolean(shapeField.title)) : 0;
    const discreteLegendRows = useCustomDiscreteLegends ? colorLegendHeight + shapeLegendHeight + (colorLegendHeight > 0 && shapeLegendHeight > 0 ? 8 : 0) : 0;
    const shapeLegendStartY = 36 + colorLegendHeight + (colorLegendHeight > 0 ? 8 : 0);
    const quantitativeLegendStartY = 36 + discreteLegendRows + (discreteLegendRows > 0 ? 12 : 0);
    const sizeLegendHeight = scatterSizeLegendGraphic && sizeExtent.length > 0 ? getQuantitativeLegendBlockHeight(5, Boolean(sizeField.title), 30) : 0;

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
        ...(useCustomDiscreteLegends ? buildDiscreteColorLegendGraphic({ title: colorField.title, values: colorValues.filter((value) => value !== null), palette: categoryPalette, chartWidth: props.chartWidth, startY: 36, hollow: geomType === "point" }) : []),
        ...(useCustomDiscreteLegends && shapeValues.filter((value) => value !== null).length > 0 ? buildDiscreteShapeLegendGraphic({ title: shapeField.title, values: shapeValues.filter((value) => value !== null), chartWidth: props.chartWidth, startY: shapeLegendStartY, hollow: geomType === "point" }) : []),
        ...(scatterSizeLegendGraphic && sizeExtent.length > 0 ? buildSizeLegendGraphic({ title: sizeField.title, min: sizeMin, max: sizeMax, chartWidth: props.chartWidth, chartHeight: props.chartHeight, outMin: geomType === "point" ? 6 : 5, outMax: geomType === "point" ? 20 : 18, startY: quantitativeLegendStartY, filled: geomType === "circle" }) : []),
        ...(scatterOpacityLegendGraphic && opacityExtent.length > 0 ? buildOpacityLegendGraphic({ title: opacityField.title, min: opacityMin, max: opacityMax, chartWidth: props.chartWidth, chartHeight: props.chartHeight, startY: quantitativeLegendStartY + sizeLegendHeight, filled: geomType === "circle" }) : []),
    ];
}
