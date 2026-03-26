export function createSeriesByGeom(params: {
    geomType: string;
    xField?: string;
    yField?: string;
    valueField?: string;
    textField?: string;
    datasetIndex: number;
    name?: string;
    xAxisIndex?: number;
    yAxisIndex?: number;
    symbol?: string;
    stack?: string;
}) {
    const { geomType, xField, yField, valueField, textField, datasetIndex, name, xAxisIndex = 0, yAxisIndex = 0, symbol, stack } = params;
    const shared = { name, xAxisIndex, yAxisIndex };
    const datasetBinding = { datasetIndex };

    if (geomType === "line") {
        return { ...shared, ...datasetBinding, type: "line", showSymbol: false, encode: { x: xField, y: yField } };
    }
    if (geomType === "area") {
        return { ...shared, ...datasetBinding, type: "line", areaStyle: {}, stack, showSymbol: false, encode: { x: xField, y: yField } };
    }
    if (geomType === "point" || geomType === "circle") {
        return { ...shared, ...datasetBinding, type: "scatter", symbol: symbol ?? (geomType === "circle" ? "circle" : "emptyCircle"), encode: { x: xField, y: yField } };
    }
    if (geomType === "tick") {
        return { ...shared, ...datasetBinding, type: "scatter", symbol: symbol ?? "rect", symbolSize: 10, encode: { x: xField, y: yField } };
    }
    if (geomType === "text") {
        return {
            ...shared,
            ...datasetBinding,
            type: "scatter",
            symbol: symbol ?? "circle",
            symbolSize: 8,
            label: {
                show: true,
                position: "top",
                color: "#333",
                fontSize: 10,
                formatter: (arg: any) => {
                    const datum = arg?.data ?? {};
                    return textField ? `${datum[textField] ?? ""}` : `${datum[yField ?? ""] ?? ""}`;
                },
            },
            labelLayout: { hideOverlap: false },
            encode: { x: xField, y: yField },
        };
    }
    if (geomType === "rect") {
        return {
            ...shared,
            ...datasetBinding,
            type: "heatmap",
            coordinateSystem: "cartesian2d",
            itemStyle: {
                borderColor: "rgba(255,255,255,0)",
                borderWidth: 0,
            },
            encode: { x: xField, y: yField, value: valueField },
        };
    }
    if (geomType === "boxplot") {
        return {
            ...shared,
            ...datasetBinding,
            type: "boxplot",
            encode: { x: xField, y: [valueField ?? yField, "q1", "median", "q3", "max"] },
        };
    }
    return {
        ...shared,
        ...datasetBinding,
        type: "bar",
        stack,
        barGap: stack ? "0%" : "-100%",
        barCategoryGap: stack ? undefined : "18%",
        itemStyle: stack ? undefined : { opacity: 0.92 },
        encode: { x: xField, y: yField },
    };
}
