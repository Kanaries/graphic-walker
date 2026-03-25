import type { RendererPluginProps } from "@kanaries/graphic-walker";

import { buildArcOption, buildBoxplotOption, buildCategoricalStackSeries, buildCartesianOption, buildMissingAxisOption } from "./builders";
import { createOptionContext } from "./optionContext";
import { axisTypeForField } from "./utils";

export function buildEChartsOption(props: RendererPluginProps) {
    const state = createOptionContext(props);
    const { vegaConfig, channelScales, sourceData, xField, yField, colorField, thetaField, geomType, categoryPalette, defaultColor, cartesianGeom, rowFacetBinding, colFacetBinding, useDiscreteColor, xValues, colorValues } = state;

    if (state.geomType === "arc") {
        return buildArcOption({ props, sourceData, colorField, thetaField, xField, yField });
    }

    if (
        (geomType === "bar" || geomType === "area") &&
        !rowFacetBinding.key &&
        !colFacetBinding.key &&
        useDiscreteColor &&
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
