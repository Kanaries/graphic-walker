import type { RendererPluginProps } from "@kanaries/graphic-walker";

import { buildDiscreteColorLegendGraphic, buildDiscreteOpacityLegendGraphic, buildOpacityLegendGraphic } from "./legends";
import type { FieldBinding } from "./types";
import { getFieldBinding, isDiscreteField, orderedUniqueValues, resolveColorRange, scaleRange, VEGA_LITE_DEFAULT_PRIMARY_COLOR } from "./utils";

export function buildArcOption(params: {
    props: RendererPluginProps;
    sourceData: RendererPluginProps["data"];
    colorField: FieldBinding;
    thetaField: FieldBinding;
    xField: FieldBinding;
    yField: FieldBinding;
}) {
    const { props, sourceData, colorField, thetaField, xField, yField } = params;
    const categoryPalette = resolveColorRange(props.vegaConfig.range?.category);
    const categoryField = colorField.key || xField.key || getFieldBinding(sourceData, (props.draggableFieldState.columns as any[])[0]).key;
    const valueField = thetaField.key || yField.key || getFieldBinding(sourceData, (props.draggableFieldState.rows as any[])[0]).key;
    const radiusField = getFieldBinding(sourceData, props.draggableFieldState.radius[0] as any).key;
    const opacityBinding = getFieldBinding(sourceData, props.draggableFieldState.opacity[0] as any);
    const opacityField = opacityBinding.key;
    const useDiscreteOpacity = Boolean(opacityField && isDiscreteField(opacityBinding.field));
    const opacityValues = useDiscreteOpacity ? orderedUniqueValues(sourceData, opacityBinding) : [];
    const opacityExtent = opacityField && !useDiscreteOpacity
        ? sourceData.map((row) => Number(row[opacityField])).filter((value) => Number.isFinite(value))
        : [];
    const opacityMin = opacityExtent.length > 0 ? Math.min(...opacityExtent) : 0;
    const opacityMax = opacityExtent.length > 0 ? Math.max(...opacityExtent) : 1;
    if (!valueField) {
        return null;
    }

    if (!radiusField) {
        const legendValues = categoryField
            ? orderedUniqueValues(sourceData, colorField.key ? colorField : xField)
                  .filter((value): value is string | number => value !== null && value !== undefined)
                  .map((value) => String(value))
            : [];
        const legendColorMap = new Map(legendValues.map((name, index) => [name, categoryPalette[index % Math.max(1, categoryPalette.length)] ?? VEGA_LITE_DEFAULT_PRIMARY_COLOR]));
        const pieData = categoryField
            ? sourceData
                  .map((row) => ({
                      name: row[categoryField],
                      value: Number(row[valueField]),
                      opacityValue: opacityField ? row[opacityField] : undefined,
                      opacityNumeric: opacityField
                          ? (useDiscreteOpacity
                              ? opacityValues.findIndex((item) => item === row[opacityField])
                              : Number(row[opacityField]))
                          : undefined,
                  }))
                  .filter((entry): entry is { name: string | number; value: number; opacityValue: unknown; opacityNumeric: number | undefined } => entry.name !== null && entry.name !== undefined && Number.isFinite(entry.value))
            : [{ name: thetaField.title ?? "value", value: Number(sourceData[0]?.[valueField] ?? 0) }];

        const useCustomOpacityLegends = Boolean(opacityField);
        const graphics = [
            ...(useCustomOpacityLegends && categoryField
                ? buildDiscreteColorLegendGraphic({
                      title: colorField.title,
                      values: legendValues,
                      palette: categoryPalette,
                      chartWidth: props.chartWidth,
                      startY: 36,
                  })
                : []),
            ...(useCustomOpacityLegends && useDiscreteOpacity
                ? buildDiscreteOpacityLegendGraphic({
                      title: opacityBinding.title,
                      values: opacityValues.filter((value) => value !== null && value !== undefined),
                      chartWidth: props.chartWidth,
                      startY: 36 + (legendValues.length > 0 ? 22 * legendValues.length + 32 : 0),
                      filled: true,
                  })
                : []),
            ...(useCustomOpacityLegends && !useDiscreteOpacity && opacityExtent.length > 0
                ? buildOpacityLegendGraphic({
                      title: opacityBinding.title,
                      min: opacityMin,
                      max: opacityMax,
                      chartWidth: props.chartWidth,
                      chartHeight: props.chartHeight,
                      startY: 36 + (legendValues.length > 0 ? 22 * legendValues.length + 32 : 0),
                      filled: true,
                  })
                : []),
            ...(!useCustomOpacityLegends && categoryField && colorField.title
                ? [{
                      type: "text",
                      right: 72,
                      top: 16,
                      style: {
                          text: colorField.title,
                          fill: "#222",
                          font: "600 12px sans-serif",
                      },
                      silent: true,
                  }]
                : []),
        ];

        return {
            animation: false,
            backgroundColor: props.vegaConfig.background,
            color: categoryPalette,
            tooltip: { trigger: "item" },
            legend: useCustomOpacityLegends
                ? { show: false }
                : categoryField
                ? {
                      show: true,
                      orient: "vertical",
                      top: 34,
                      right: 12,
                      type: "scroll",
                      data: legendValues,
                  }
                : { show: false },
            dataset: [{ source: pieData }],
            visualMap: opacityField
                ? [{
                      type: "continuous",
                      dimension: "opacityNumeric",
                      seriesIndex: [0],
                      min: useDiscreteOpacity ? 0 : opacityMin,
                      max: useDiscreteOpacity ? Math.max(1, opacityValues.length - 1) : opacityMax,
                      inRange: { opacity: useDiscreteOpacity ? [0.25, 1] : [0.3, 0.8] },
                      calculable: false,
                      show: false,
                  }]
                : undefined,
            graphic: graphics.length > 0 ? graphics : undefined,
            series: [{
                type: "pie",
                datasetIndex: 0,
                radius: "72%",
                center: ["50%", "50%"],
                encode: {
                    itemName: "name",
                    value: "value",
                },
                itemStyle: categoryField
                    ? (() => {
                          return {
                              color: (params: { name?: string | number }) => legendColorMap.get(String(params?.name ?? "")) ?? categoryPalette[0] ?? VEGA_LITE_DEFAULT_PRIMARY_COLOR,
                          };
                      })()
                    : undefined,
                label: { show: false },
            }],
        };
    }

    const slices = categoryField
        ? sourceData.map((row) => ({
              label: String(row[categoryField]),
              theta: Math.max(0, Number(row[valueField] ?? 0)),
              radius: Math.max(0, Number(row[radiusField] ?? 0)),
              opacityValue: opacityField ? row[opacityField] : undefined,
          }))
        : [{ label: thetaField.title ?? "value", theta: Math.max(0, Number(sourceData[0]?.[valueField] ?? 0)), radius: 1, opacityValue: undefined }];
    const legendLabels = Array.from(new Set(slices.map((slice) => slice.label))).sort((a, b) => a.localeCompare(b));
    const cx = props.chartWidth * 0.44;
    const cy = props.chartHeight * 0.52;
    const baseRadius = Math.min(props.chartWidth, props.chartHeight) * 0.42;
    const thetaMax = Math.max(1, ...slices.map((slice) => slice.theta));
    const radiusValues = slices.map((slice) => slice.radius);
    const radiusMin = Math.min(...radiusValues);
    const radiusMax = Math.max(...radiusValues);
    const graphics = slices.length === 2
        ? (() => {
              const dominant = [...slices].sort((a, b) => a.theta - b.theta)[1] ?? slices[0];
              const colorIndex = legendLabels.indexOf(dominant.label);
              return [{
                  type: "sector",
                  shape: { cx, cy, r: baseRadius, r0: 0, startAngle: 0, endAngle: Math.PI * 2, clockwise: true },
                  style: { fill: categoryPalette[Math.max(0, colorIndex) % Math.max(1, categoryPalette.length)] ?? VEGA_LITE_DEFAULT_PRIMARY_COLOR },
              }];
          })()
        : slices.map((slice, index) => {
              const normalizedRadius = radiusMax > radiusMin ? 0.2 + ((slice.radius - radiusMin) / (radiusMax - radiusMin)) * 0.8 : 1;
              const colorIndex = legendLabels.indexOf(slice.label);
              const sweepMultiplier = index === slices.length - 1 ? 0.5 : 1;
              return {
                  type: "sector",
                  shape: {
                      cx,
                      cy,
                      r: baseRadius * normalizedRadius,
                      r0: 0,
                      startAngle: -Math.PI / 2,
                      endAngle: -Math.PI / 2 + (slice.theta / thetaMax) * Math.PI * 2 * sweepMultiplier,
                      clockwise: true,
                  },
                  style: {
                      fill: categoryPalette[Math.max(0, colorIndex) % Math.max(1, categoryPalette.length)] ?? VEGA_LITE_DEFAULT_PRIMARY_COLOR,
                      opacity: opacityField
                          ? (useDiscreteOpacity
                              ? scaleRange(opacityValues.findIndex((item) => item === slice.opacityValue), 0, Math.max(1, opacityValues.length - 1), 0.25, 1)
                              : scaleRange(Number(slice.opacityValue), opacityMin, opacityMax, 0.3, 0.8))
                          : 1,
                  },
              };
          });

    return {
        animation: false,
        backgroundColor: props.vegaConfig.background,
        color: categoryPalette,
        legend: { show: false },
        graphic: [
            ...(categoryField
                ? buildDiscreteColorLegendGraphic({
                      title: colorField.title,
                      values: legendLabels,
                      palette: categoryPalette,
                      chartWidth: props.chartWidth,
                      startY: 36,
                  })
                : []),
            ...(opacityField && useDiscreteOpacity
                ? buildDiscreteOpacityLegendGraphic({
                      title: opacityBinding.title,
                      values: opacityValues.filter((value) => value !== null && value !== undefined),
                      chartWidth: props.chartWidth,
                      startY: 36 + (legendLabels.length > 0 ? 22 * legendLabels.length + 32 : 0),
                      filled: true,
                  })
                : []),
            ...(opacityField && !useDiscreteOpacity && opacityExtent.length > 0
                ? buildOpacityLegendGraphic({
                      title: opacityBinding.title,
                      min: opacityMin,
                      max: opacityMax,
                      chartWidth: props.chartWidth,
                      chartHeight: props.chartHeight,
                      startY: 36 + (legendLabels.length > 0 ? 22 * legendLabels.length + 32 : 0),
                      filled: true,
                  })
                : []),
            ...graphics,
        ],
    };
}
