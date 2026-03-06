import * as Plot from '@observablehq/plot';
import React, { useEffect, useMemo, useRef } from 'react';
import type { RendererPlugin, RendererPluginProps } from '@kanaries/graphic-walker';

function ObservablePlotView(props: RendererPluginProps) {
    const mountRef = useRef<HTMLDivElement | null>(null);

    const view = useMemo(() => {
        const rawGeomType = props.visualConfig.geoms[0];
        const geomType = rawGeomType === 'auto' ? 'bar' : rawGeomType;
        const xField = props.draggableFieldState.columns[0]?.fid;
        const yField = props.draggableFieldState.rows[0]?.fid;
        const colorField = props.draggableFieldState.color[0]?.fid;

        if (!xField || !yField) {
            return null;
        }

        const titleFields = props.draggableFieldState.details.map((f) => f.fid);
        const title = titleFields.length > 0 ? (d: Record<string, any>) => titleFields.map((f) => `${f}: ${d[f]}`).join('\n') : undefined;

        let mark: Plot.Mark;
        switch (geomType) {
            case 'line':
                mark = Plot.lineY(props.data as any, { x: xField, y: yField, stroke: colorField, title });
                break;
            case 'area':
                mark = Plot.areaY(props.data as any, { x: xField, y: yField, fill: colorField, title });
                break;
            case 'point':
            case 'circle':
                mark = Plot.dot(props.data as any, { x: xField, y: yField, fill: colorField, title });
                break;
            case 'bar':
            default:
                mark = Plot.barY(props.data as any, { x: xField, y: yField, fill: colorField, title });
                break;
        }

        return Plot.plot({
            width: Math.max(240, props.chartWidth),
            height: Math.max(160, props.chartHeight),
            marks: [mark],
            style: {
                background: props.vegaConfig.background,
            },
        });
    }, [props]);

    useEffect(() => {
        const rawGeomType = props.visualConfig.geoms[0];
        props.onReportSpec?.(
            JSON.stringify(
                {
                    renderer: 'plugin:observable-plot',
                    geomType: rawGeomType,
                    columns: props.draggableFieldState.columns.map((f) => f.fid),
                    rows: props.draggableFieldState.rows.map((f) => f.fid),
                },
                null,
                2
            )
        );

        if (!mountRef.current) {
            return;
        }
        mountRef.current.innerHTML = '';
        if (view) {
            mountRef.current.appendChild(view);
        }

        return () => {
            props.onReportSpec?.('');
            view?.remove();
        };
    }, [view, props]);

    return <div ref={mountRef} style={{ width: '100%', height: '100%', overflow: 'auto' }} />;
}

const SUPPORTED_GEOMS = new Set(['auto', 'bar', 'line', 'area', 'point', 'circle']);

export function createObservablePlotPlugin(): RendererPlugin {
    return {
        id: 'plugin:observable-plot',
        displayName: 'Observable Plot',
        priority: 20,
        canRender: (props) => props.visualConfig.coordSystem !== 'geographic' && SUPPORTED_GEOMS.has(props.visualConfig.geoms[0]),
        render: (props) => <ObservablePlotView {...props} />,
    };
}
