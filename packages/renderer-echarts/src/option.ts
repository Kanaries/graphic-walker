import type { RendererPluginProps } from "@kanaries/graphic-walker";

import { buildArcOption, buildBoxplotOption, buildCategoricalStackSeries, buildCartesianOption, buildMissingAxisOption } from "./builders";
import { createOptionContext } from "./optionContext";
import { axisTypeForField } from "./utils";

export function buildEChartsOption(props: RendererPluginProps) {
    const state = createOptionContext(props);
    const { vegaConfig, channelScales, sourceData, xField, yField, colorField, opacityField, thetaField, geomType, categoryPalette, defaultColor, cartesianGeom, rowFacetBinding, colFacetBinding, useDiscreteColor, xValues, yValues, colorValues } = state;

    if (state.geomType === "arc") {
        return buildArcOption({ props, sourceData, colorField, thetaField, xField, yField });
    }

    if (
        (geomType === "bar" || geomType === "area") &&
        !rowFacetBinding.key &&
        !colFacetBinding.key &&
        useDiscreteColor &&
        !opacityField.key &&
        xField.key &&
        yField.key &&
        axisTypeForField(xField.field) === "category" &&
        axisTypeForField(yField.field) === "value"
    ) {
        return buildCategoricalStackSeries({
            rows: sourceData,
            xKey: xField.key,
            yKey: yField.key,
            xValues,
            colorKey: colorField.key as string,
            colorValues: colorValues.filter((value) => value !== null),
            geomType: geomType as "bar" | "area",
            stackMode: props.layout.stack ?? "stack",
            xTitle: xField.title,
            yTitle: yField.title,
            background: vegaConfig.background as string | undefined,
            palette: categoryPalette,
            zeroScale: channelScales?.y?.zeroScale ?? true,
        });
    }

    if (
        geomType === "area" &&
        !rowFacetBinding.key &&
        !colFacetBinding.key &&
        !useDiscreteColor &&
        !opacityField.key &&
        xField.key &&
        yField.key &&
        axisTypeForField(xField.field) === "value" &&
        axisTypeForField(yField.field) === "category"
    ) {
        return buildCategoricalStackSeries({
            rows: sourceData.map((row) => ({ ...row, __gw_single_series__: "default" })),
            xKey: yField.key,
            yKey: xField.key,
            xValues: yValues,
            colorKey: "__gw_single_series__",
            colorValues: ["default"],
            geomType: "area",
            stackMode: props.layout.stack ?? "stack",
            xTitle: yField.title,
            yTitle: xField.title,
            background: vegaConfig.background as string | undefined,
            palette: [defaultColor],
            zeroScale: channelScales?.x?.zeroScale ?? true,
            orientation: "horizontal",
        });
    }

    if (
        (geomType === "bar" || geomType === "area") &&
        !rowFacetBinding.key &&
        !colFacetBinding.key &&
        useDiscreteColor &&
        !opacityField.key &&
        xField.key &&
        yField.key &&
        axisTypeForField(xField.field) === "value" &&
        axisTypeForField(yField.field) === "category"
    ) {
        return buildCategoricalStackSeries({
            rows: sourceData,
            xKey: yField.key,
            yKey: xField.key,
            xValues: yValues,
            colorKey: colorField.key as string,
            colorValues: colorValues.filter((value) => value !== null),
            geomType: geomType as "bar" | "area",
            stackMode: props.layout.stack ?? "stack",
            xTitle: yField.title,
            yTitle: xField.title,
            background: vegaConfig.background as string | undefined,
            palette: categoryPalette,
            zeroScale: channelScales?.x?.zeroScale ?? true,
            orientation: "horizontal",
        });
    }

    if (cartesianGeom && (!xField.key || !yField.key)) {
        return buildMissingAxisOption({ props, geomType, sourceData, xField, yField, colorField, defaultColor, categoryPalette });
    }

    if (geomType === "boxplot") {
        const option = buildBoxplotOption({
            props,
            sourceData,
            xField,
            yField,
            colorField,
            useDiscreteColor,
            colorValues,
            xValues,
            categoryPalette,
        });
        if (option) {
            return option;
        }
    }
    return buildCartesianOption(state);
}
