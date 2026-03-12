import * as Plot from '@observablehq/plot';
import React, { useEffect, useMemo, useRef } from 'react';
import type { RendererPlugin, RendererPluginProps } from '@kanaries/graphic-walker';
import { toObservablePlotSpec } from './observablePlot';

function normalizeBackground(background: unknown): string | undefined {
    return typeof background === 'string' ? background : undefined;
}

function inferMediaTheme(background?: string): 'light' | 'dark' {
    const value = (background ?? '').toLowerCase();
    if (!value) {
        return 'light';
    }
    if (value === 'black' || value === '#000' || value === '#000000') {
        return 'dark';
    }

    const hex = value.startsWith('#') ? value.slice(1) : '';
    if (hex.length === 3 || hex.length === 6) {
        const norm = hex.length === 3 ? hex.split('').map((x) => `${x}${x}`).join('') : hex;
        const r = parseInt(norm.slice(0, 2), 16);
        const g = parseInt(norm.slice(2, 4), 16);
        const b = parseInt(norm.slice(4, 6), 16);
        if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
            return (r * 299 + g * 587 + b * 114) / 1000 < 128 ? 'dark' : 'light';
        }
    }

    return value.includes('dark') ? 'dark' : 'light';
}

function ObservablePlotView(props: RendererPluginProps) {
    const mountRefs = useRef<Array<HTMLDivElement | null>>([]);
    const plotBackground = normalizeBackground(props.vegaConfig.background);

    const guardedRows = useMemo(
        () => props.draggableFieldState.rows.filter((x) => props.visualConfig.defaultAggregated || x.aggName !== 'expr'),
        [props.draggableFieldState.rows, props.visualConfig.defaultAggregated]
    );
    const guardedCols = useMemo(
        () => props.draggableFieldState.columns.filter((x) => props.visualConfig.defaultAggregated || x.aggName !== 'expr'),
        [props.draggableFieldState.columns, props.visualConfig.defaultAggregated]
    );

    const rowDims = useMemo(() => guardedRows.filter((f) => f.analyticType === 'dimension'), [guardedRows]);
    const colDims = useMemo(() => guardedCols.filter((f) => f.analyticType === 'dimension'), [guardedCols]);
    const rowMeas = useMemo(() => guardedRows.filter((f) => f.analyticType === 'measure'), [guardedRows]);
    const colMeas = useMemo(() => guardedCols.filter((f) => f.analyticType === 'measure'), [guardedCols]);

    const rowRepeatFields = useMemo(() => (rowMeas.length === 0 ? rowDims.slice(-1) : rowMeas), [rowDims, rowMeas]);
    const colRepeatFields = useMemo(() => (colMeas.length === 0 ? colDims.slice(-1) : colMeas), [colDims, colMeas]);

    const specs = useMemo(() => {
        if (rowRepeatFields.length === 0 && colRepeatFields.length === 0) {
            return [] as any[];
        }
        return toObservablePlotSpec({
            rows: guardedRows,
            columns: guardedCols,
            dataSource: props.data,
            defaultAggregated: props.visualConfig.defaultAggregated,
            geomType: props.visualConfig.geoms[0],
            stack: props.layout.stack,
            interactiveScale: props.layout.interactiveScale,
            layoutMode: props.layout.size.mode,
            width: props.chartWidth,
            height: props.chartHeight,
            scales: props.scales,
            color: props.draggableFieldState.color[0],
            details: props.draggableFieldState.details,
            opacity: props.draggableFieldState.opacity[0],
            radius: props.draggableFieldState.radius[0],
            shape: props.draggableFieldState.shape[0],
            size: props.draggableFieldState.size[0],
            text: props.draggableFieldState.text[0],
            theta: props.draggableFieldState.theta[0],
            vegaConfig: props.vegaConfig,
            mediaTheme: inferMediaTheme(plotBackground),
            displayOffset: props.visualConfig.timezoneDisplayOffset,
        });
    }, [
        rowRepeatFields,
        colRepeatFields,
        guardedRows,
        guardedCols,
        props.data,
        props.visualConfig.defaultAggregated,
        props.visualConfig.geoms,
        props.visualConfig.timezoneDisplayOffset,
        props.layout.stack,
        props.layout.interactiveScale,
        props.layout.size.mode,
        props.chartWidth,
        props.chartHeight,
        props.scales,
        props.draggableFieldState.color,
        props.draggableFieldState.details,
        props.draggableFieldState.opacity,
        props.draggableFieldState.radius,
        props.draggableFieldState.shape,
        props.draggableFieldState.size,
        props.draggableFieldState.text,
        props.draggableFieldState.theta,
        props.vegaConfig,
        plotBackground,
    ]);

    useEffect(() => {
        props.onReportSpec?.(JSON.stringify(specs, null, 2));
        return () => {
            props.onReportSpec?.('');
        };
    }, [props.onReportSpec, specs]);

    const rowCount = Math.max(1, rowRepeatFields.length);
    const colCount = Math.max(1, colRepeatFields.length);
    const subWidth = Math.max(120, Math.floor(props.chartWidth / colCount));
    const subHeight = Math.max(100, Math.floor(props.chartHeight / rowCount));

    useEffect(() => {
        const plots: Array<HTMLElement | SVGSVGElement> = [];

        specs.forEach((plotSpec: any, index: number) => {
            const mountNode = mountRefs.current[index];
            if (!mountNode) {
                return;
            }

            mountNode.innerHTML = '';
            const element = Plot.plot({
                ...plotSpec,
                width: props.layout.size.mode === 'auto' ? undefined : subWidth,
                height: props.layout.size.mode === 'auto' ? undefined : subHeight,
                style: {
                    ...(plotSpec?.style ?? {}),
                    background: plotBackground,
                },
            });

            element.addEventListener('pointerdown', (e: Event) => {
                props.onGeomClick?.(null, e);
            });

            mountNode.appendChild(element);
            plots.push(element as HTMLElement | SVGSVGElement);
        });

        return () => {
            plots.forEach((plot) => plot.remove());
        };
    }, [specs, props.layout.size.mode, plotBackground, props.onGeomClick, subWidth, subHeight]);

    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))`,
                width: '100%',
                height: '100%',
                overflow: props.layout.size.mode === 'auto' ? 'auto' : 'hidden',
            }}
        >
            {specs.map((_: any, idx: number) => (
                <div
                    key={idx}
                    ref={(node) => {
                        mountRefs.current[idx] = node;
                    }}
                    style={{ overflow: 'hidden' }}
                />
            ))}
        </div>
    );
}

const SUPPORTED_GEOMS = new Set(['auto', 'bar', 'line', 'area', 'point', 'circle', 'tick', 'rect', 'rule', 'boxplot', 'text']);

export function createObservablePlotPlugin(): RendererPlugin {
    return {
        id: 'plugin:observable-plot',
        displayName: 'Observable Plot',
        priority: 20,
        canRender: (props) => props.visualConfig.coordSystem !== 'geographic' && SUPPORTED_GEOMS.has(props.visualConfig.geoms[0]),
        render: (props) => <ObservablePlotView {...props} />,
    };
}
