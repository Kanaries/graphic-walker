import React, { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import type { RendererPlugin, RendererPluginProps } from "@kanaries/graphic-walker";
import type { ECBasicOption } from "echarts/types/dist/shared";

import { EChartsActionMenu } from "./actionMenu";
import { buildEChartsOption } from "./option";
import { resolveChartRenderSize } from "./size";
import { SUPPORTED_GEOMS } from "./utils";

function EChartsView(props: RendererPluginProps) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const chartHostRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<echarts.EChartsType | null>(null);
    const renderSize = useMemo(() => resolveChartRenderSize(props), [props]);
    const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);
    const effectiveWidth = renderSize.mode === "full" ? (containerSize?.width ?? props.chartWidth) : renderSize.width;
    const effectiveHeight = renderSize.mode === "full" ? (containerSize?.height ?? props.chartHeight) : renderSize.height;
    const optionProps = useMemo(
        () => ({
            ...props,
            chartWidth: effectiveWidth,
            chartHeight: effectiveHeight,
        }),
        [effectiveHeight, effectiveWidth, props],
    );
    const option = useMemo(() => buildEChartsOption(optionProps), [optionProps]);
    const echartsOption = useMemo(() => option as ECBasicOption | undefined, [option]);
    const optionText = useMemo(() => JSON.stringify(option ?? { renderer: "plugin:echarts", unsupported: true }, null, 2), [option]);

    useEffect(() => {
        props.onReportSpec?.(JSON.stringify(option ?? { renderer: "plugin:echarts", unsupported: true }, null, 2));
        if (!chartHostRef.current || !echartsOption) {
            return;
        }

        let resizeObserver: ResizeObserver | null = null;

        const ensureChart = (width?: number, height?: number) => {
            if (!chartHostRef.current) {
                return null;
            }
            const safeWidth = width && width > 0 ? width : undefined;
            const safeHeight = height && height > 0 ? height : undefined;
            if (!chartRef.current) {
                chartRef.current = echarts.init(chartHostRef.current, undefined, {
                    width: safeWidth,
                    height: safeHeight,
                });
            }
            chartRef.current.setOption(echartsOption, true);
            chartRef.current.resize({
                width: safeWidth,
                height: safeHeight,
            });
            return chartRef.current;
        };

        try {
            if (renderSize.mode === "full" && wrapperRef.current) {
                const initialWidth = Math.floor(wrapperRef.current.clientWidth);
                const initialHeight = Math.floor(wrapperRef.current.clientHeight);
                if (initialWidth > 0 && initialHeight > 0) {
                    ensureChart(initialWidth, initialHeight);
                }
                resizeObserver = new ResizeObserver(entries => {
                    const entry = entries[0];
                    const width = Math.floor(entry?.contentRect.width ?? wrapperRef.current?.clientWidth ?? 0);
                    const height = Math.floor(entry?.contentRect.height ?? wrapperRef.current?.clientHeight ?? 0);
                    if (width > 0 && height > 0) {
                        setContainerSize(prev => (prev?.width === width && prev?.height === height ? prev : { width, height }));
                        ensureChart(width, height);
                    }
                });
                resizeObserver.observe(wrapperRef.current);
            } else {
                ensureChart(renderSize.width, renderSize.height);
            }
        } catch (err) {
            console.warn("[graphic-walker] ECharts runtime is not installed or failed to load.", err);
        }

        return () => {
            props.onReportSpec?.("");
            resizeObserver?.disconnect();
            chartRef.current?.dispose?.();
            chartRef.current = null;
        };
    }, [echartsOption, option, props, renderSize]);

    const wrapperStyle =
        renderSize.mode === "full"
            ? { position: "relative" as const, width: "100%", height: "100%", minWidth: 0, minHeight: 0 }
            : { position: "relative" as const, width: `${renderSize.width}px`, height: `${renderSize.height}px`, minHeight: 160 };
    const chartHostStyle =
        renderSize.mode === "full"
            ? { width: "100%", height: "100%", minWidth: 0, minHeight: 0 }
            : { width: `${renderSize.width}px`, height: `${renderSize.height}px`, minHeight: 160 };

    return (
        <div ref={wrapperRef} style={wrapperStyle}>
            {props.layout.showActions && option ? <EChartsActionMenu optionText={optionText} /> : null}
            <div ref={chartHostRef} style={chartHostStyle} />
        </div>
    );
}

export function createEChartsPlugin(): RendererPlugin {
    return {
        id: "plugin:echarts",
        displayName: "ECharts",
        priority: 10,
        canRender: props => props.visualConfig.coordSystem !== "geographic" && SUPPORTED_GEOMS.has(props.visualConfig.geoms[0]),
        render: props => <EChartsView {...props} />,
    };
}

export { buildEChartsOption } from "./option";
export { computeAutoChartSize, resolveChartRenderSize } from "./size";
