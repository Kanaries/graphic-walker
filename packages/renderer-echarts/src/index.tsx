import React, { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import type { RendererPlugin, RendererPluginProps } from '@kanaries/graphic-walker';

const SUPPORTED_GEOMS = new Set(['auto', 'bar', 'line', 'area', 'point', 'circle']);

function createTooltip(details: RendererPluginProps['draggableFieldState']['details'], xField?: string, yField?: string) {
    const detailFids = details.map((f) => f.fid);
    return {
        trigger: 'axis',
        formatter(params: any) {
            const rows = Array.isArray(params) ? params : [params];
            const data = rows[0]?.data ?? {};
            const lines = [] as string[];
            if (xField) lines.push(`${xField}: ${data[xField]}`);
            if (yField) lines.push(`${yField}: ${data[yField]}`);
            detailFids.forEach((fid) => lines.push(`${fid}: ${data[fid]}`));
            return lines.join('<br/>');
        },
    };
}

export function buildEChartsOption(props: RendererPluginProps) {
    const rawGeomType = props.visualConfig.geoms[0];
    const geomType = rawGeomType === 'auto' ? 'bar' : rawGeomType;
    const xField = props.draggableFieldState.columns[0]?.fid;
    const yField = props.draggableFieldState.rows[0]?.fid;
    const colorField = props.draggableFieldState.color[0]?.fid;

    if (!xField || !yField) {
        return null;
    }

    const seriesType = geomType === 'area' ? 'line' : geomType === 'point' || geomType === 'circle' ? 'scatter' : geomType;
    const grouped = new Map<string, Record<string, any>[]>();

    for (const row of props.data) {
        const key = colorField ? `${row[colorField] ?? 'default'}` : 'default';
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key)!.push(row);
    }

    const option = {
        animation: false,
        backgroundColor: props.vegaConfig.background,
        tooltip: createTooltip(props.draggableFieldState.details, xField, yField),
        xAxis: {
            type: 'category',
            name: xField,
        },
        yAxis: {
            type: 'value',
            name: yField,
        },
        series: Array.from(grouped.entries()).map(([group, rows]) => ({
            name: group,
            type: seriesType,
            areaStyle: geomType === 'area' ? {} : undefined,
            encode: {
                x: xField,
                y: yField,
            },
            data: rows,
        })),
        dataset: {
            source: props.data,
        },
    };

    return option;
}

function EChartsView(props: RendererPluginProps) {
    const ref = useRef<HTMLDivElement | null>(null);
    const option = useMemo(() => buildEChartsOption(props), [props]);

    useEffect(() => {
        props.onReportSpec?.(JSON.stringify(option ?? { renderer: 'plugin:echarts', unsupported: true }, null, 2));
        if (!ref.current || !option) {
            return;
        }

        let chart: any;
        try {
            chart = echarts.init(ref.current);
            chart.setOption(option, true);
        } catch (err) {
            console.warn('[graphic-walker] ECharts runtime is not installed or failed to load.', err);
        }

        return () => {
            props.onReportSpec?.('');
            chart?.dispose?.();
        };
    }, [option, props]);

    return <div ref={ref} style={{ width: '100%', height: '100%', minHeight: 160 }} />;
}

export function createEChartsPlugin(): RendererPlugin {
    return {
        id: 'plugin:echarts',
        displayName: 'ECharts',
        priority: 10,
        canRender: (props) => props.visualConfig.coordSystem !== 'geographic' && SUPPORTED_GEOMS.has(props.visualConfig.geoms[0]),
        render: (props) => <EChartsView {...props} />,
    };
}
