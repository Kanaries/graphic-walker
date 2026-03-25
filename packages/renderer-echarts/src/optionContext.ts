import type { RendererPluginProps } from "@kanaries/graphic-walker";

import type { FieldBinding } from "./types";
import {
    axisTypeForField,
    createValueOrder,
    getFacetField,
    getFieldBinding,
    isDiscreteField,
    isScatterLikeGeom,
    isSyntheticMeasureFacetField,
    niceCeil,
    niceFloor,
    normalizeGeom,
    orderedUniqueValues,
    prepareCartesianState,
    resolveColorRange,
    resolveGeomDefaultColor,
    sortSourceData,
} from "./utils";

export function createOptionContext(props: RendererPluginProps) {
    const vegaConfig = props.vegaConfig as Record<string, any>;
    const channelScales = props.scales as Record<string, any> | undefined;
    const preparedState = prepareCartesianState(props);
    const rows = preparedState.rows;
    const columns = preparedState.columns;
    const sourceData = preparedState.data;
    const { color, opacity, size, shape, details, text, theta } = props.draggableFieldState;
    const xField = getFieldBinding(sourceData, columns[columns.length - 1]);
    const yField = getFieldBinding(sourceData, rows[rows.length - 1]);
    const colorField = getFieldBinding(sourceData, color[0] as any);
    const opacityField = getFieldBinding(sourceData, opacity[0] as any);
    const sizeField = getFieldBinding(sourceData, size[0] as any);
    const shapeField = getFieldBinding(sourceData, shape[0] as any);
    const thetaField = getFieldBinding(sourceData, theta[0] as any);
    const textField = getFieldBinding(sourceData, text[0] as any);
    const rawGeom = props.visualConfig.geoms[0] ?? "auto";
    const geomType = normalizeGeom(rawGeom, xField.field, yField.field);
    const categoryPalette = resolveColorRange(props.vegaConfig.range?.category);
    const defaultColor = resolveGeomDefaultColor(geomType, props.vegaConfig, categoryPalette[0] ?? "#5B8FF9");
    const cartesianGeom = geomType !== "arc";

    const detailFields = details
        .map((field) => getFieldBinding(sourceData, field as any))
        .filter((value): value is Required<Pick<FieldBinding, "key" | "title">> & FieldBinding => Boolean(value.key && value.title))
        .map((value) => ({ key: value.key as string, title: value.title as string }));
    const tooltipFields = [xField, yField, colorField, opacityField, sizeField, shapeField]
        .filter((value): value is Required<Pick<FieldBinding, "key" | "title">> & FieldBinding => Boolean(value.key && value.title))
        .map((value) => ({ key: value.key as string, title: value.title as string }))
        .concat(detailFields);

    const rowFacetField = getFacetField(rows);
    const colFacetField = getFacetField(columns);
    const rowFacetBinding = getFieldBinding(sourceData, rowFacetField);
    const colFacetBinding = getFieldBinding(sourceData, colFacetField);
    const rowFacetValues = orderedUniqueValues(sourceData, rowFacetBinding);
    const colFacetValues = orderedUniqueValues(sourceData, colFacetBinding);
    const useDiscreteColor = Boolean(colorField.key && isDiscreteField(colorField.field));
    const useDiscreteShape = Boolean(shapeField.key && geomType !== "circle" && isScatterLikeGeom(geomType) && isDiscreteField(shapeField.field));
    const separateDiscreteLegends = Boolean(useDiscreteColor && useDiscreteShape);
    const showLegend = Boolean(useDiscreteColor || useDiscreteShape) && !separateDiscreteLegends;
    const colorValues = useDiscreteColor ? orderedUniqueValues(sourceData, colorField) : [null];
    const shapeValues = useDiscreteShape ? orderedUniqueValues(sourceData, shapeField) : [null];
    const xValues = orderedUniqueValues(sourceData, xField);
    const yValues = orderedUniqueValues(sourceData, yField);
    const sortedSource = sortSourceData(
        sourceData,
        {
            rowFacet: rowFacetBinding,
            colFacet: colFacetBinding,
            color: useDiscreteColor ? colorField : undefined,
            shape: useDiscreteShape ? shapeField : undefined,
            x: xField,
            y: yField,
        },
        {
            rowFacet: createValueOrder(rowFacetValues),
            colFacet: createValueOrder(colFacetValues),
            color: createValueOrder(colorValues),
            shape: createValueOrder(shapeValues),
            x: createValueOrder(xValues),
            y: createValueOrder(yValues),
        },
    );

    const scatterOpacityLegendGraphic = Boolean(opacityField.key && (geomType === "point" || geomType === "circle") && xField.key && yField.key);
    const scatterSizeLegendGraphic = Boolean(sizeField.key && (geomType === "point" || geomType === "circle") && xField.key && yField.key);
    const preferCustomDiscreteLegends = Boolean((scatterOpacityLegendGraphic || scatterSizeLegendGraphic) && (useDiscreteColor || useDiscreteShape));
    const facetTitleReserve = rowFacetBinding.key && colFacetBinding.key ? 10 : rowFacetBinding.key || colFacetBinding.key ? 6 : 0;
    const legendTopReserve = 0;
    const visualMapBottomReserve = Boolean(opacityField.key || (sizeField.key && isScatterLikeGeom(geomType))) ? 12 : 0;
    const categoryBottomReserve =
        axisTypeForField(xField.field) === "category"
            ? geomType === "rect"
                ? 26
                : geomType === "line" || geomType === "area"
                  ? 30
                  : 28
            : 0;
    const measureFacetBottomReserve = isSyntheticMeasureFacetField(colFacetBinding.field) ? 8 : 0;
    const gridTopReserve = legendTopReserve + facetTitleReserve;
    const gridBottomReserve = Math.max(visualMapBottomReserve, categoryBottomReserve, measureFacetBottomReserve);
    const continuousColorLegend = Boolean(colorField.key && !useDiscreteColor);
    const useCustomDiscreteLegends = separateDiscreteLegends || preferCustomDiscreteLegends;
    const showNativeLegend = showLegend && !preferCustomDiscreteLegends;
    const nativeLegendTitle = showNativeLegend ? (useDiscreteColor ? colorField.title : shapeField.title) : undefined;
    const legendRightReserve = showNativeLegend || useCustomDiscreteLegends || continuousColorLegend || scatterOpacityLegendGraphic || scatterSizeLegendGraphic ? 22 : 0;
    const facetLeftReserve = rowFacetBinding.key ? 10 : 0;
    const sizeExtent = sizeField.key ? sortedSource.map((row) => Number(row[sizeField.key as string])).filter((value) => Number.isFinite(value)) : [];
    const sizeMin = sizeExtent.length > 0 ? Math.min(...sizeExtent) : 0;
    const sizeMax = sizeExtent.length > 0 ? Math.max(...sizeExtent) : 1;
    const xExtent = xField.key && axisTypeForField(xField.field) === "value" ? sortedSource.map((row) => Number(row[xField.key as string])).filter((value) => Number.isFinite(value)) : [];
    const yExtent = yField.key && axisTypeForField(yField.field) === "value" ? sortedSource.map((row) => Number(row[yField.key as string])).filter((value) => Number.isFinite(value)) : [];
    const opacityExtent = opacityField.key ? sortedSource.map((row) => Number(row[opacityField.key as string])).filter((value) => Number.isFinite(value)) : [];

    return {
        props,
        vegaConfig,
        channelScales,
        rows,
        columns,
        sourceData,
        xField,
        yField,
        colorField,
        opacityField,
        sizeField,
        shapeField,
        thetaField,
        textField,
        geomType,
        categoryPalette,
        defaultColor,
        cartesianGeom,
        tooltipFields,
        rowFacetBinding,
        colFacetBinding,
        rowFacetValues,
        colFacetValues,
        useDiscreteColor,
        useDiscreteShape,
        showLegend,
        colorValues,
        shapeValues,
        xValues,
        yValues,
        sortedSource,
        scatterOpacityLegendGraphic,
        scatterSizeLegendGraphic,
        preferCustomDiscreteLegends,
        continuousColorLegend,
        useCustomDiscreteLegends,
        showNativeLegend,
        nativeLegendTitle,
        legendRightReserve,
        gridTopReserve,
        gridBottomReserve,
        facetLeftReserve,
        sizeExtent,
        sizeMin,
        sizeMax,
        xMin: xExtent.length > 0 ? niceFloor(Math.min(...xExtent)) : undefined,
        xMax: xExtent.length > 0 ? niceCeil(Math.max(...xExtent)) : undefined,
        yMin: yExtent.length > 0 ? niceFloor(Math.min(...yExtent)) : undefined,
        yMax: yExtent.length > 0 ? niceCeil(Math.max(...yExtent)) : undefined,
        opacityExtent,
        opacityMin: opacityExtent.length > 0 ? Math.min(...opacityExtent) : 0,
        opacityMax: opacityExtent.length > 0 ? Math.max(...opacityExtent) : 1,
        useZeroBaselineScatter: (geomType === "point" || geomType === "circle") && Boolean(props.layout.zeroScale),
    };
}
