import React, { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import type { RendererPlugin, RendererPluginProps } from "@kanaries/graphic-walker";

import { buildEChartsOption } from "./option";
import { SUPPORTED_GEOMS } from "./utils";

function EChartsView(props: RendererPluginProps) {
    const ref = useRef<HTMLDivElement | null>(null);
    const option = useMemo(() => buildEChartsOption(props), [props]);

    useEffect(() => {
        props.onReportSpec?.(JSON.stringify(option ?? { renderer: "plugin:echarts", unsupported: true }, null, 2));
        if (!ref.current || !option) {
            return;
        }

        let chart: any;
        try {
            chart = echarts.init(ref.current);
            chart.setOption(option, true);
            chart.resize();
        } catch (err) {
            console.warn("[graphic-walker] ECharts runtime is not installed or failed to load.", err);
        }

        return () => {
            props.onReportSpec?.("");
            chart?.dispose?.();
        };
    }, [option, props]);

    return <div ref={ref} style={{ width: `${props.chartWidth}px`, height: `${props.chartHeight}px`, minHeight: 160 }} />;
}

export function createEChartsPlugin(): RendererPlugin {
    return {
        id: "plugin:echarts",
        displayName: "ECharts",
        priority: 10,
        canRender: (props) => props.visualConfig.coordSystem !== "geographic" && SUPPORTED_GEOMS.has(props.visualConfig.geoms[0]),
        render: (props) => <EChartsView {...props} />,
    };
}

export { buildEChartsOption } from "./option";
