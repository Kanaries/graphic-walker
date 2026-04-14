import * as Plot from '@observablehq/plot';
import React, { useEffect, useMemo, useRef } from 'react';
import type { RendererPlugin, RendererPluginProps } from '@kanaries/graphic-walker';
import { arc as d3Arc } from 'd3-shape';
import { toObservablePlotSpec } from './observablePlot';
import { resolveDataKey } from './model/fieldBinding';
import { getContinuousPalette, getDiscretePalette } from './colorDefaults';
export { toObservablePlotSpec, __test__fieldBinding, __test__vegaLiteToPlot, renderObservablePlot } from './observablePlot';

type ResolveEncodingMap = Partial<Record<'color' | 'shape' | 'size' | 'opacity', boolean>>;

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
    const supplementalLegend = useMemo(() => buildSupplementalLegend(props), [props]);
    const hasFacet =
        props.draggableFieldState.rows.some((field) => field.analyticType === 'dimension') ||
        props.draggableFieldState.columns.some((field) => field.analyticType === 'dimension');
    const resolve = props.layout.resolve as ResolveEncodingMap | undefined;
    const hasIndependentAll =
        (props.visualConfig.geoms[0] === 'point' || props.visualConfig.geoms[0] === 'circle') &&
        hasFacet &&
        Boolean(resolve?.shape && resolve?.size && resolve?.opacity);
    const hasIndependentShapeOnly =
        (props.visualConfig.geoms[0] === 'point' || props.visualConfig.geoms[0] === 'circle') &&
        hasFacet &&
        Boolean(resolve?.shape) &&
        !Boolean(resolve?.size) &&
        !Boolean(resolve?.opacity) &&
        !Boolean(resolve?.color);
    const hasIndependentSizeOnly =
        (props.visualConfig.geoms[0] === 'point' || props.visualConfig.geoms[0] === 'circle') &&
        hasFacet &&
        Boolean(resolve?.size) &&
        !Boolean(resolve?.shape) &&
        !Boolean(resolve?.opacity) &&
        !Boolean(resolve?.color);
    const shouldReserveLegendBand =
        (props.visualConfig.geoms[0] === 'point' || props.visualConfig.geoms[0] === 'circle') &&
        hasFacet &&
        Boolean(resolve?.shape || resolve?.size || resolve?.opacity);
    const useOverlayLegend = shouldReserveLegendBand;
    const overlayLegendHeight = supplementalLegend && useOverlayLegend ? (hasIndependentAll ? 230 : hasIndependentSizeOnly ? 126 : 78) : 0;
    const legendSideWidth = supplementalLegend && !useOverlayLegend ? (hasIndependentAll ? 260 : 200) : 0;
    const plotSpecs = useMemo(
        () =>
            specs.map((spec) =>
                useOverlayLegend
                    ? {
                          ...spec,
                          fx: {
                              ...((spec as Record<string, unknown>).fx as Record<string, unknown> | undefined),
                              label: null,
                          },
                      }
                    : spec
            ),
        [specs, useOverlayLegend]
    );
    const gridAvailableWidth = Math.max(120, props.chartWidth - legendSideWidth);
    const effectiveSubWidth = Math.max(
        120,
        Math.floor(
            gridAvailableWidth /
                colCount /
                (hasIndependentAll ? 1.15 : hasIndependentShapeOnly ? 1.08 : 1)
        )
    );

    if (props.visualConfig.geoms[0] === 'arc') {
        return <ObservableArcView {...props} />;
    }
    if (
        props.visualConfig.geoms[0] === 'rect' &&
        props.draggableFieldState.columns.length > 0 &&
        props.draggableFieldState.rows.length > 0 &&
        props.draggableFieldState.color.length > 0
    ) {
        return <ObservableHeatmapView {...props} />;
    }
    if (
        props.visualConfig.geoms[0] === 'boxplot' &&
        props.draggableFieldState.columns.length > 0 &&
        props.draggableFieldState.rows.length > 0 &&
        props.draggableFieldState.color.length > 0 &&
        [...props.draggableFieldState.rows, ...props.draggableFieldState.columns].filter((field) => field.analyticType === 'measure').length <= 1
    ) {
        return <ObservableColorBoxplotView {...props} />;
    }
    if (
        props.visualConfig.geoms[0] === 'bar' &&
        props.draggableFieldState.size.length > 0 &&
        props.draggableFieldState.columns.length > 0 &&
        props.draggableFieldState.rows.length > 0 &&
        props.draggableFieldState.color.length === 0 &&
        ((props.draggableFieldState.columns[props.draggableFieldState.columns.length - 1]?.analyticType === 'dimension' &&
            props.draggableFieldState.rows[props.draggableFieldState.rows.length - 1]?.analyticType === 'measure') ||
            (props.draggableFieldState.columns[props.draggableFieldState.columns.length - 1]?.analyticType === 'measure' &&
                props.draggableFieldState.rows[props.draggableFieldState.rows.length - 1]?.analyticType === 'dimension'))
    ) {
        return <ObservableBarSizeView {...props} />;
    }
    if (
        props.visualConfig.geoms[0] === 'bar' &&
        props.draggableFieldState.columns.length === 1 &&
        props.draggableFieldState.columns[0]?.analyticType === 'measure' &&
        props.draggableFieldState.rows.length === 2 &&
        props.draggableFieldState.rows[0]?.analyticType === 'dimension' &&
        props.draggableFieldState.rows[1]?.analyticType === 'measure' &&
        props.draggableFieldState.color.length === 0 &&
        props.draggableFieldState.size.length === 0 &&
        props.draggableFieldState.shape.length === 0 &&
        props.draggableFieldState.opacity.length === 0
    ) {
        return <ObservableFacetMeasureBarView {...props} />;
    }
    if (
        props.visualConfig.geoms[0] === 'bar' &&
        props.draggableFieldState.columns.length === 2 &&
        props.draggableFieldState.columns[0]?.analyticType === 'dimension' &&
        props.draggableFieldState.columns[1]?.analyticType === 'measure' &&
        props.draggableFieldState.rows.length === 1 &&
        props.draggableFieldState.rows[0]?.analyticType === 'measure' &&
        props.draggableFieldState.color.length === 0 &&
        props.draggableFieldState.size.length === 0 &&
        props.draggableFieldState.shape.length === 0 &&
        props.draggableFieldState.opacity.length === 0
    ) {
        return <ObservableFacetColumnMeasureBarView {...props} />;
    }
    if (
        props.visualConfig.geoms[0] === 'bar' &&
        props.layout.stack === 'none' &&
        props.draggableFieldState.color.length > 0 &&
        props.draggableFieldState.columns.length > 0 &&
        props.draggableFieldState.rows.length > 0
    ) {
        return <ObservableOverlayBarView {...props} />;
    }
    if (
        props.visualConfig.geoms[0] === 'circle' &&
        props.draggableFieldState.rows.length === 0 &&
        props.draggableFieldState.columns.length === 0 &&
        props.draggableFieldState.color.length > 0
    ) {
        return <ObservableCenterPointView {...props} />;
    }

    useEffect(() => {
        const plots: Array<HTMLElement | SVGSVGElement> = [];

        plotSpecs.forEach((plotSpec: any, index: number) => {
            const mountNode = mountRefs.current[index];
            if (!mountNode) {
                return;
            }

            mountNode.innerHTML = '';
            const element = Plot.plot({
                ...plotSpec,
                width: props.layout.size.mode === 'auto' ? undefined : effectiveSubWidth,
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
    }, [plotSpecs, props.layout.size.mode, plotBackground, props.onGeomClick, effectiveSubWidth, subHeight]);

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'stretch',
                gap: 12,
                position: 'relative',
                paddingTop: overlayLegendHeight,
            }}
        >
            <div
                style={{
                    flex: '1 1 auto',
                    minWidth: 0,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))`,
                    width: '100%',
                    height: overlayLegendHeight > 0 ? `calc(100% - ${overlayLegendHeight}px)` : '100%',
                    overflow: props.layout.size.mode === 'auto' ? 'auto' : 'hidden',
                }}
            >
                {plotSpecs.map((_: any, idx: number) => (
                    <div
                        key={idx}
                        ref={(node) => {
                            mountRefs.current[idx] = node;
                        }}
                        style={{ overflow: 'hidden' }}
                    />
                ))}
            </div>
            {supplementalLegend && !useOverlayLegend ? (
                <div style={{ width: legendSideWidth, minWidth: legendSideWidth, overflowY: 'auto', paddingTop: 8 }}>{supplementalLegend}</div>
            ) : null}
            {supplementalLegend && useOverlayLegend ? (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: overlayLegendHeight }}>{supplementalLegend}</div>
            ) : null}
        </div>
    );
}

function valueToRampColor(value: number, min: number, max: number, ramp: string[]) {
    if (ramp.length === 0) return '#5B8FF9';
    if (max <= min) return ramp[ramp.length - 1] ?? ramp[0];
    const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const index = Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1)));
    return ramp[index] ?? ramp[ramp.length - 1] ?? '#5B8FF9';
}

function ObservableHeatmapView(props: RendererPluginProps) {
    const xField = props.draggableFieldState.columns[props.draggableFieldState.columns.length - 1];
    const yField = props.draggableFieldState.rows[props.draggableFieldState.rows.length - 1];
    const colorField = props.draggableFieldState.color[0];
    const opacityField = props.draggableFieldState.opacity[0];
    const xKey = resolveDataKey(props.data, xField ? { field: xField.fid, aggregate: xField.aggName, type: xField.semanticType } : undefined);
    const yKey = resolveDataKey(props.data, yField ? { field: yField.fid, aggregate: yField.aggName, type: yField.semanticType } : undefined);
    const colorKey = resolveDataKey(props.data, colorField ? { field: colorField.fid, aggregate: colorField.aggName, type: colorField.semanticType } : undefined);
    const opacityKey = resolveDataKey(props.data, opacityField ? { field: opacityField.fid, aggregate: opacityField.aggName, type: opacityField.semanticType } : undefined);
    const xs = xKey ? Array.from(new Set(props.data.map((row) => String(row[xKey])))).sort() : [];
    const ys = yKey ? Array.from(new Set(props.data.map((row) => String(row[yKey])))) : [];
    const values = props.data.map((row) => Number(row[colorKey ?? ''] ?? 0)).filter((value) => Number.isFinite(value));
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 1;
    const ramp = getContinuousPalette(props.vegaConfig, 'rect');
    const opacityIsDiscrete = opacityField?.analyticType === 'dimension';
    const opacityDiscreteValues =
        opacityField && opacityIsDiscrete && opacityKey
            ? Array.from(new Set(props.data.map((row) => String(row[opacityKey])))).sort()
            : [];
    const opacityContinuousValues = opacityField && !opacityIsDiscrete && opacityKey
        ? props.data.map((row) => Number(row[opacityKey])).filter((value) => Number.isFinite(value))
        : [];
    const opacityMin = opacityContinuousValues.length > 0 ? Math.min(...opacityContinuousValues) : 0;
    const opacityMax = opacityContinuousValues.length > 0 ? Math.max(...opacityContinuousValues) : 1;
    const opacityForRow = (row: Record<string, unknown>) => {
        if (!opacityField || !opacityKey) return 0.96;
        if (opacityIsDiscrete) {
            const value = String(row[opacityKey] ?? '');
            const index = Math.max(0, opacityDiscreteValues.indexOf(value));
            return 0.28 + (index / Math.max(1, opacityDiscreteValues.length - 1)) * 0.64;
        }
        const raw = Number(row[opacityKey]);
        if (!Number.isFinite(raw)) return 0.72;
        if (opacityMax <= opacityMin) return 0.72;
        return 0.2 + ((raw - opacityMin) / (opacityMax - opacityMin)) * 0.8;
    };
    const cellRows = new Map<string, Array<{ colorValue: number; opacity: number }>>();
    props.data.forEach((row) => {
        if (!xKey || !yKey || !colorKey) return;
        const xValue = String(row[xKey]);
        const yValue = String(row[yKey]);
        const colorValue = Number(row[colorKey]);
        if (!Number.isFinite(colorValue)) return;
        const key = `${xValue}__${yValue}`;
        const list = cellRows.get(key) ?? [];
        list.push({ colorValue, opacity: opacityForRow(row as Record<string, unknown>) });
        cellRows.set(key, list);
    });
    const plotWidth = props.chartWidth - 180;
    const plotHeight = props.chartHeight - 110;
    const left = 76;
    const top = 28;
    const cellWidth = plotWidth / Math.max(1, xs.length);
    const cellHeight = plotHeight / Math.max(1, ys.length);
    const colorLegendHeight = opacityField ? Math.max(150, plotHeight * 0.58) : plotHeight;
    const colorLegendTop = top + 6;
    const opacityLegendTop = colorLegendTop + colorLegendHeight + 24;
    const formatLegendValue = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${Math.round(value)}`);
    const opacityContinuousTicks =
        opacityField && !opacityIsDiscrete && Number.isFinite(opacityMin) && Number.isFinite(opacityMax)
            ? [0, 1, 2, 3].map((step) => opacityMin + (step / 3) * (opacityMax - opacityMin))
            : [];

    return (
        <div style={{ width: '100%', height: '100%', padding: '8px 12px' }}>
            <svg width={props.chartWidth} height={props.chartHeight} viewBox={`0 0 ${props.chartWidth} ${props.chartHeight}`}>
                <rect x={0} y={0} width={props.chartWidth} height={props.chartHeight} fill={normalizeBackground(props.vegaConfig.background) ?? '#ffffff'} />
                {ys.map((yValue, yIndex) => {
                    const y = top + yIndex * cellHeight;
                    return (
                        <g key={yValue}>
                            {xs.map((xValue, xIndex) => {
                                const rows = [...(cellRows.get(`${xValue}__${yValue}`) ?? [])].sort((a, b) => a.opacity - b.opacity);
                                const entryRows = rows.length > 0 ? rows : [{ colorValue: min, opacity: 0.96 }];
                                return (
                                    <g key={xValue}>
                                        {entryRows.map((entry, layerIndex) => (
                                            <rect
                                                key={`${xValue}-${layerIndex}`}
                                                x={left + xIndex * cellWidth}
                                                y={y}
                                                width={cellWidth}
                                                height={cellHeight}
                                                fill={valueToRampColor(entry.colorValue, min, max, ramp)}
                                                opacity={entry.opacity}
                                            />
                                        ))}
                                    </g>
                                );
                            })}
                            <text x={left - 8} y={y + cellHeight / 2} textAnchor="end" dominantBaseline="middle" fontSize="12">
                                {yValue}
                            </text>
                        </g>
                    );
                })}
                {xs.map((xValue, xIndex) => (
                    <text
                        key={xValue}
                        x={left + xIndex * cellWidth + cellWidth / 2}
                        y={top + plotHeight + 8}
                        transform={`rotate(-90 ${left + xIndex * cellWidth + cellWidth / 2} ${top + plotHeight + 8})`}
                        textAnchor="end"
                        fontSize="11"
                    >
                        {xValue}
                    </text>
                ))}
                <text x={left + plotWidth / 2} y={props.chartHeight - 8} textAnchor="middle" fontSize="12" fontWeight="600">
                    {xField?.name}
                </text>
                <text x={18} y={top + plotHeight / 2} transform={`rotate(-90 18 ${top + plotHeight / 2})`} textAnchor="middle" fontSize="12" fontWeight="600">
                    {yField?.name}
                </text>
                <g transform={`translate(${left + plotWidth + 18}, ${colorLegendTop})`}>
                    <text x={0} y={-10} fontSize="12" fontWeight="600">
                        {colorField?.aggName && colorField.aggName !== 'expr' ? `${colorField.aggName}(${colorField.name})` : colorField?.name}
                    </text>
                    {ramp.map((color, index) => {
                        const itemHeight = colorLegendHeight / Math.max(1, ramp.length);
                        const value = max - (index / Math.max(1, ramp.length - 1)) * (max - min);
                        return (
                            <g key={color} transform={`translate(0, ${index * itemHeight})`}>
                                <rect width={16} height={itemHeight} fill={color} />
                                <text x={22} y={itemHeight / 2} dominantBaseline="middle" fontSize="11">
                                    {formatLegendValue(value)}
                                </text>
                            </g>
                        );
                    })}
                </g>
                {opacityField ? (
                    <g transform={`translate(${left + plotWidth + 18}, ${opacityLegendTop})`}>
                        <text x={0} y={0} fontSize="12" fontWeight="600">
                            {opacityField?.aggName && opacityField.aggName !== 'expr' ? `${opacityField.aggName}(${opacityField.name})` : opacityField?.name}
                        </text>
                        {opacityIsDiscrete
                            ? opacityDiscreteValues.map((value, index) => {
                                  const alpha = 0.28 + (index / Math.max(1, opacityDiscreteValues.length - 1)) * 0.64;
                                  return (
                                      <g key={value} transform={`translate(0, ${14 + index * 18})`}>
                                          <rect width={12} height={12} fill="#6b7280" opacity={alpha} />
                                          <text x={18} y={6} dominantBaseline="middle" fontSize="11">
                                              {value}
                                          </text>
                                      </g>
                                  );
                              })
                            : opacityContinuousTicks.map((value, index) => {
                                  const alpha =
                                      opacityMax > opacityMin ? 0.2 + ((value - opacityMin) / (opacityMax - opacityMin)) * 0.8 : 0.72;
                                  return (
                                      <g key={`${value}-${index}`} transform={`translate(0, ${14 + index * 18})`}>
                                          <rect width={12} height={12} fill="#6b7280" opacity={alpha} />
                                          <text x={18} y={6} dominantBaseline="middle" fontSize="11">
                                              {Math.round(value)}
                                          </text>
                                      </g>
                                  );
                              })}
                    </g>
                ) : null}
            </svg>
        </div>
    );
}

function quantile(sorted: number[], p: number) {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0] ?? 0;
    const position = (sorted.length - 1) * p;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const weight = position - lower;
    const low = sorted[lower] ?? sorted[0] ?? 0;
    const high = sorted[upper] ?? sorted[sorted.length - 1] ?? low;
    return low + (high - low) * weight;
}

function ObservableColorBoxplotView(props: RendererPluginProps) {
    const xField = props.draggableFieldState.columns[props.draggableFieldState.columns.length - 1];
    const yField = props.draggableFieldState.rows[props.draggableFieldState.rows.length - 1];
    const colorField = props.draggableFieldState.color[0];
    const xKey = resolveDataKey(props.data, xField ? { field: xField.fid, aggregate: xField.aggName, type: xField.semanticType } : undefined);
    const yKey = resolveDataKey(props.data, yField ? { field: yField.fid, aggregate: yField.aggName, type: yField.semanticType } : undefined);
    const colorKey = resolveDataKey(props.data, colorField ? { field: colorField.fid, aggregate: colorField.aggName, type: colorField.semanticType } : undefined);
    const horizontal = xField?.analyticType === 'measure' && yField?.analyticType === 'dimension';

    if (horizontal && xKey && yKey) {
        const ys = Array.from(new Set(props.data.map((row) => String(row[yKey])))).sort();
        const series = colorKey ? Array.from(new Set(props.data.map((row) => String(row[colorKey])))).sort() : [];
        const palette = getDiscretePalette(props.vegaConfig);
        const allValues = props.data.map((row) => Number(row[xKey] ?? 0)).filter((value) => Number.isFinite(value));
        const minValue = allValues.length > 0 ? Math.min(...allValues) : 0;
        const maxValue = allValues.length > 0 ? Math.max(...allValues) : 1;
        const plotWidth = props.chartWidth - 116;
        const plotHeight = props.chartHeight - 86;
        const left = 92;
        const top = 20;
        const band = plotHeight / Math.max(1, ys.length);
        const subgroupHeight = band / Math.max(2, series.length + 0.5);
        const xScale = (value: number) => left + ((value - minValue) / Math.max(1, maxValue - minValue)) * plotWidth;

        const groups = ys.flatMap((yValue) =>
            series.map((seriesValue) => {
                const values = props.data
                    .filter((row) => String(row[yKey]) === yValue && String(row[colorKey ?? '']) === seriesValue)
                    .map((row) => Number(row[xKey] ?? 0))
                    .filter((value) => Number.isFinite(value))
                    .sort((a, b) => a - b);
                const q1 = quantile(values, 0.25);
                const median = quantile(values, 0.5);
                const q3 = quantile(values, 0.75);
                const iqr = q3 - q1;
                const lowFence = q1 - 1.5 * iqr;
                const highFence = q3 + 1.5 * iqr;
                const inliers = values.filter((value) => value >= lowFence && value <= highFence);
                const outliers = values.filter((value) => value < lowFence || value > highFence);
                return {
                    yValue,
                    seriesValue,
                    q1,
                    median,
                    q3,
                    low: inliers[0] ?? q1,
                    high: inliers[inliers.length - 1] ?? q3,
                    outliers,
                };
            })
        );

        return (
            <div style={{ width: '100%', height: '100%', padding: '10px 12px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 14, right: 10, fontSize: 12, lineHeight: 1.4 }}>
                    {series.map((seriesValue, index) => (
                        <div key={seriesValue} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ width: 12, height: 12, background: palette[index % palette.length], display: 'inline-block' }} />
                            <span>{seriesValue}</span>
                        </div>
                    ))}
                </div>
                <svg width={props.chartWidth} height={props.chartHeight - 20} viewBox={`0 0 ${props.chartWidth} ${props.chartHeight - 20}`}>
                    <line x1={left} y1={top + plotHeight} x2={left + plotWidth} y2={top + plotHeight} stroke="#333" strokeWidth="1" />
                    <line x1={left} y1={top} x2={left} y2={top + plotHeight} stroke="#333" strokeWidth="1" />
                    {groups.map((group) => {
                        const yIndex = ys.indexOf(group.yValue);
                        const seriesIndex = series.indexOf(group.seriesValue);
                        const centerY = top + yIndex * band + band / 2;
                        const boxHeight = subgroupHeight * 0.9;
                        const color = palette[Math.max(0, seriesIndex) % palette.length];
                        return (
                            <g key={`${group.yValue}-${group.seriesValue}`}>
                                <line x1={xScale(group.low)} x2={xScale(group.q1)} y1={centerY} y2={centerY} stroke="#222" />
                                <line x1={xScale(group.q3)} x2={xScale(group.high)} y1={centerY} y2={centerY} stroke="#222" />
                                <line x1={xScale(group.low)} x2={xScale(group.low)} y1={centerY - boxHeight * 0.25} y2={centerY + boxHeight * 0.25} stroke="#222" />
                                <line x1={xScale(group.high)} x2={xScale(group.high)} y1={centerY - boxHeight * 0.25} y2={centerY + boxHeight * 0.25} stroke="#222" />
                                <rect
                                    x={xScale(group.q1)}
                                    y={centerY - boxHeight / 2}
                                    width={Math.max(2, xScale(group.q3) - xScale(group.q1))}
                                    height={boxHeight}
                                    fill={color}
                                    fillOpacity={0.7}
                                />
                                <line x1={xScale(group.median)} x2={xScale(group.median)} y1={centerY - boxHeight / 2} y2={centerY + boxHeight / 2} stroke="#222" strokeWidth="1.5" />
                                {group.outliers.map((value, index) => (
                                    <circle key={index} cx={xScale(value)} cy={centerY} r="2.5" fill="none" stroke={color} strokeWidth="1.4" />
                                ))}
                            </g>
                        );
                    })}
                    {ys.map((yValue, index) => (
                        <text key={yValue} x={left - 8} y={top + index * band + band / 2} textAnchor="end" dominantBaseline="middle" fontSize="11">
                            {yValue}
                        </text>
                    ))}
                    <text x={left + plotWidth / 2} y={props.chartHeight - 26} textAnchor="middle" fontSize="12" fontWeight="600">
                        {xField?.name}
                    </text>
                    <text x={14} y={top + plotHeight / 2} transform={`rotate(-90 14 ${top + plotHeight / 2})`} textAnchor="middle" fontSize="12" fontWeight="600">
                        {yField?.name}
                    </text>
                </svg>
            </div>
        );
    }

    const xs = xKey ? Array.from(new Set(props.data.map((row) => String(row[xKey])))).sort() : [];
    const series = colorKey ? Array.from(new Set(props.data.map((row) => String(row[colorKey])))).sort() : [];
    const palette = getDiscretePalette(props.vegaConfig);
    const allValues = props.data.map((row) => Number(row[yKey ?? ''] ?? 0)).filter((value) => Number.isFinite(value));
    const minValue = allValues.length > 0 ? Math.min(...allValues) : 0;
    const maxValue = allValues.length > 0 ? Math.max(...allValues) : 1;
    const plotWidth = props.chartWidth - 90;
    const plotHeight = props.chartHeight - 86;
    const left = 52;
    const top = 20;
    const band = plotWidth / Math.max(1, xs.length);
    const subgroupWidth = band / Math.max(2, series.length + 0.5);
    const yScale = (value: number) => top + plotHeight - ((value - minValue) / Math.max(1, maxValue - minValue)) * plotHeight;

    const groups = xs.flatMap((xValue) =>
        series.map((seriesValue) => {
            const values = props.data
                .filter((row) => String(row[xKey ?? '']) === xValue && String(row[colorKey ?? '']) === seriesValue)
                .map((row) => Number(row[yKey ?? ''] ?? 0))
                .filter((value) => Number.isFinite(value))
                .sort((a, b) => a - b);
            const q1 = quantile(values, 0.25);
            const median = quantile(values, 0.5);
            const q3 = quantile(values, 0.75);
            const iqr = q3 - q1;
            const lowFence = q1 - 1.5 * iqr;
            const highFence = q3 + 1.5 * iqr;
            const inliers = values.filter((value) => value >= lowFence && value <= highFence);
            const outliers = values.filter((value) => value < lowFence || value > highFence);
            return {
                xValue,
                seriesValue,
                q1,
                median,
                q3,
                low: inliers[0] ?? q1,
                high: inliers[inliers.length - 1] ?? q3,
                outliers,
            };
        })
    );

    return (
        <div style={{ width: '100%', height: '100%', padding: '10px 12px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 14, right: 10, fontSize: 12, lineHeight: 1.4 }}>
                {series.map((seriesValue, index) => (
                    <div key={seriesValue} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ width: 12, height: 12, background: palette[index % palette.length], display: 'inline-block' }} />
                        <span>{seriesValue}</span>
                    </div>
                ))}
            </div>
            <svg width={props.chartWidth} height={props.chartHeight - 20} viewBox={`0 0 ${props.chartWidth} ${props.chartHeight - 20}`}>
                <line x1={left} y1={top + plotHeight} x2={left + plotWidth} y2={top + plotHeight} stroke="#333" strokeWidth="1" />
                <line x1={left} y1={top} x2={left} y2={top + plotHeight} stroke="#333" strokeWidth="1" />
                {groups.map((group) => {
                    const xIndex = xs.indexOf(group.xValue);
                    const seriesIndex = series.indexOf(group.seriesValue);
                    const centerX = left + xIndex * band + band / 2;
                    const boxWidth = subgroupWidth * 0.92;
                    const color = palette[Math.max(0, seriesIndex) % palette.length];
                    return (
                        <g key={`${group.xValue}-${group.seriesValue}`}>
                            <line x1={centerX} x2={centerX} y1={yScale(group.high)} y2={yScale(group.q3)} stroke="#222" />
                            <line x1={centerX} x2={centerX} y1={yScale(group.q1)} y2={yScale(group.low)} stroke="#222" />
                            <line x1={centerX - boxWidth * 0.25} x2={centerX + boxWidth * 0.25} y1={yScale(group.high)} y2={yScale(group.high)} stroke="#222" />
                            <line x1={centerX - boxWidth * 0.25} x2={centerX + boxWidth * 0.25} y1={yScale(group.low)} y2={yScale(group.low)} stroke="#222" />
                            <rect x={centerX - boxWidth / 2} y={yScale(group.q3)} width={boxWidth} height={Math.max(2, yScale(group.q1) - yScale(group.q3))} fill={color} fillOpacity={0.7} />
                            <line x1={centerX - boxWidth / 2} x2={centerX + boxWidth / 2} y1={yScale(group.median)} y2={yScale(group.median)} stroke="#222" strokeWidth="1.5" />
                            {group.outliers.map((value, index) => (
                                <circle key={index} cx={centerX} cy={yScale(value)} r="2.5" fill="none" stroke={color} strokeWidth="1.4" />
                            ))}
                        </g>
                    );
                })}
                {xs.map((xValue, index) => (
                    <text key={xValue} x={left + index * band + band / 2} y={top + plotHeight + 18} textAnchor="middle" fontSize="11">
                        {xValue}
                    </text>
                ))}
                <text x={left + plotWidth / 2} y={props.chartHeight - 26} textAnchor="middle" fontSize="12" fontWeight="600">
                    {xField?.name}
                </text>
                <text x={10} y={top + plotHeight / 2} transform={`rotate(-90 10 ${top + plotHeight / 2})`} textAnchor="middle" fontSize="12" fontWeight="600">
                    {yField?.name}
                </text>
            </svg>
        </div>
    );
}

function ObservableOverlayBarView(props: RendererPluginProps) {
    const xField = props.draggableFieldState.columns[props.draggableFieldState.columns.length - 1];
    const yField = props.draggableFieldState.rows[props.draggableFieldState.rows.length - 1];
    const colorField = props.draggableFieldState.color[0];
    const xKey = resolveDataKey(props.data, xField ? { field: xField.fid, aggregate: xField.aggName, type: xField.semanticType } : undefined);
    const yKey = resolveDataKey(props.data, yField ? { field: yField.fid, aggregate: yField.aggName, type: yField.semanticType } : undefined);
    const colorKey = resolveDataKey(props.data, colorField ? { field: colorField.fid, aggregate: colorField.aggName, type: colorField.semanticType } : undefined);
    const palette = getDiscretePalette(props.vegaConfig);

    const xIsDim = xField?.analyticType === 'dimension';
    const yIsDim = yField?.analyticType === 'dimension';
    const categoriesKey = xIsDim ? xKey : yIsDim ? yKey : undefined;
    const valueKey = xIsDim ? yKey : xKey;
    const horizontal = yIsDim && !xIsDim;
    const categories = categoriesKey ? Array.from(new Set(props.data.map((row) => String(row[categoriesKey])))).sort() : [];
    const series = colorKey ? Array.from(new Set(props.data.map((row) => String(row[colorKey])))).sort() : [];
    const categoryRows = categories.map((category) =>
        props.data.filter((row) => String(row[categoriesKey ?? '']) === category && Number.isFinite(Number(row[valueKey ?? ''] ?? NaN)))
    );
    const maxValue = Math.max(1, ...categoryRows.flatMap((rows) => rows.map((row) => Number(row[valueKey ?? ''] ?? 0))));
    const plotWidth = props.chartWidth - 96;
    const plotHeight = props.chartHeight - 84;
    const left = 56;
    const top = 20;
    const band = (horizontal ? plotHeight : plotWidth) / Math.max(1, categories.length);
    const barWidth = band * 0.9;
    const quantitativeTicks = Array.from({ length: 6 }, (_, index) => (maxValue * index) / 5);

    return (
        <div style={{ width: '100%', height: '100%', padding: '12px 16px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 16, right: 10, fontSize: 12, lineHeight: 1.4 }}>
                {series.map((seriesValue, index) => (
                    <div key={seriesValue} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ width: 12, height: 12, background: palette[index % palette.length], display: 'inline-block' }} />
                        <span>{seriesValue}</span>
                    </div>
                ))}
            </div>
            <svg width={props.chartWidth} height={props.chartHeight - 24} viewBox={`0 0 ${props.chartWidth} ${props.chartHeight - 24}`}>
                {horizontal
                    ? quantitativeTicks.map((tick, index) => {
                          const x = left + (tick / maxValue) * plotWidth;
                          return (
                              <g key={`hx-${index}`}>
                                  <line x1={x} y1={top} x2={x} y2={top + plotHeight} stroke="#e5e7eb" strokeWidth="1" />
                                  <text x={x} y={top + plotHeight + 16} fontSize="10" textAnchor="middle" fill="#6b7280">
                                      {Math.round(tick).toLocaleString('en-US')}
                                  </text>
                              </g>
                          );
                      })
                    : null}
                <line x1={left} y1={top + plotHeight} x2={left + plotWidth} y2={top + plotHeight} stroke="#333" strokeWidth="1" />
                <line x1={left} y1={top} x2={left} y2={top + plotHeight} stroke="#333" strokeWidth="1" />
                {categories.map((category, categoryIndex) => {
                    const x = left + categoryIndex * band + (band - barWidth) / 2;
                    return (
                        <g key={category}>
                            {categoryRows[categoryIndex].map((row, rowIndex) => {
                                const seriesValue = String(row[colorKey ?? ''] ?? '');
                                const value = Number(row[valueKey ?? ''] ?? 0);
                                const height = (value / maxValue) * plotHeight;
                                const y = top + plotHeight - height;
                                const width = (value / maxValue) * plotWidth;
                                const x0 = left;
                                const yBand = top + categoryIndex * band + (band - barWidth) / 2;
                                const seriesIndex = Math.max(0, series.indexOf(seriesValue));
                                return (
                                    <rect
                                        key={`${seriesValue}-${rowIndex}`}
                                        x={horizontal ? x0 : x}
                                        y={horizontal ? yBand : y}
                                        width={horizontal ? width : barWidth}
                                        height={horizontal ? barWidth : height}
                                        fill={palette[seriesIndex % palette.length]}
                                    />
                                );
                            })}
                            <text x={x + barWidth / 2} y={top + plotHeight + 16} fontSize="11" textAnchor="middle">
                                {!horizontal ? category : ''}
                            </text>
                        </g>
                    );
                })}
                {horizontal
                    ? categories.map((category, index) => (
                          <text key={`h-${category}`} x={left - 8} y={top + index * band + band / 2} fontSize="11" textAnchor="end" dominantBaseline="middle">
                              {category}
                          </text>
                      ))
                    : null}
                <text x={left + plotWidth / 2} y={props.chartHeight - 28} textAnchor="middle" fontSize="12" fontWeight="600">
                    {horizontal
                        ? xField?.aggName && xField.aggName !== 'expr'
                            ? `${xField.aggName}(${xField.name})`
                            : xField?.name
                        : xField?.name}
                </text>
                <text x={8} y={top + plotHeight / 2} transform={`rotate(-90 8 ${top + plotHeight / 2})`} textAnchor="middle" fontSize="12" fontWeight="600">
                    {horizontal
                        ? yField?.name
                        : yField?.aggName && yField.aggName !== 'expr'
                          ? `${yField.aggName}(${yField.name})`
                          : yField?.name}
                </text>
            </svg>
        </div>
    );
}

function ObservableBarSizeView(props: RendererPluginProps) {
    const xField = props.draggableFieldState.columns[props.draggableFieldState.columns.length - 1];
    const yField = props.draggableFieldState.rows[props.draggableFieldState.rows.length - 1];
    const sizeField = props.draggableFieldState.size[0];
    const xKey = resolveDataKey(props.data, xField ? { field: xField.fid, aggregate: xField.aggName, type: xField.semanticType } : undefined);
    const yKey = resolveDataKey(props.data, yField ? { field: yField.fid, aggregate: yField.aggName, type: yField.semanticType } : undefined);
    const sizeKey = resolveDataKey(props.data, sizeField ? { field: sizeField.fid, aggregate: sizeField.aggName, type: sizeField.semanticType } : undefined);
    const palette = getDiscretePalette(props.vegaConfig);

    if (!xKey || !yKey || !sizeKey) {
        return <ObservablePlotView {...props} />;
    }

    const horizontal = xField?.analyticType === 'measure' && yField?.analyticType === 'dimension';
    const vertical = xField?.analyticType === 'dimension' && yField?.analyticType === 'measure';
    if (!horizontal && !vertical) {
        return <ObservablePlotView {...props} />;
    }

    const categoryKey = horizontal ? yKey : xKey;
    const valueKey = horizontal ? xKey : yKey;
    const categories = Array.from(new Set(props.data.map((row) => String(row[categoryKey])))).sort((a, b) => a.localeCompare(b));
    const maxValue = Math.max(1, ...props.data.map((row) => Number(row[valueKey] ?? 0)));
    const plotWidth = props.chartWidth - 104;
    const plotHeight = props.chartHeight - 92;
    const left = 64;
    const top = 20;
    const band = (horizontal ? plotHeight : plotWidth) / Math.max(1, categories.length);
    const isSizeDiscrete = sizeField?.analyticType === 'dimension';
    const discreteValues = isSizeDiscrete ? Array.from(new Set(props.data.map((row) => String(row[sizeKey])))).sort((a, b) => a.localeCompare(b)) : [];
    const sizeValues = props.data.map((row) => Number(row[sizeKey] ?? 0)).filter((value) => Number.isFinite(value));
    const sizeMin = sizeValues.length ? Math.min(...sizeValues) : 0;
    const sizeMax = sizeValues.length ? Math.max(...sizeValues) : 1;
    const groupedTotalMap = isSizeDiscrete
        ? new Map(
              categories.map((category) => {
                  const total = props.data
                      .filter((row) => String(row[categoryKey]) === category)
                      .reduce((sum, row) => sum + Number(row[valueKey] ?? 0), 0);
                  return [category, total];
              })
          )
        : null;
    const quantitativeMax = isSizeDiscrete
        ? Math.max(1, ...categories.map((category) => groupedTotalMap?.get(category) ?? 0))
        : maxValue;

    type SizeBar = {
        x: number;
        y: number;
        width: number;
        height: number;
        color: string;
        opacity?: number;
        legend: string | null;
        category: string;
        series?: string;
        value: number;
        ratio?: number;
    };
    type RenderBar = Pick<SizeBar, 'x' | 'y' | 'width' | 'height' | 'color' | 'opacity'>;

    const bars: SizeBar[] = props.data
        .map((row) => {
            const category = String(row[categoryKey]);
            const value = Number(row[valueKey] ?? 0);
            const sizeValue = row[sizeKey];
            if (!Number.isFinite(value)) return null;
            const xIndex = categories.indexOf(category);
            const center = horizontal ? top + xIndex * band + band / 2 : left + xIndex * band + band / 2;
            if (isSizeDiscrete) {
                const series = String(sizeValue);
                const seriesIndex = Math.max(0, discreteValues.indexOf(series));
                const thickness = 5;
                const offset = (seriesIndex - (discreteValues.length - 1) / 2) * (thickness + 1.5);
                const valueExtent = (value / maxValue) * (horizontal ? plotWidth : plotHeight);
                return {
                    x: horizontal ? left : center + offset - thickness / 2,
                    y: horizontal ? center + offset - thickness / 2 : top + plotHeight - valueExtent,
                    width: horizontal ? valueExtent : thickness,
                    height: horizontal ? thickness : valueExtent,
                    color: palette[seriesIndex % palette.length],
                    legend: series,
                    category,
                    series,
                    value,
                };
            }
            const numeric = Number(sizeValue ?? 0);
            const ratio = sizeMax > sizeMin ? (numeric - sizeMin) / (sizeMax - sizeMin) : 0.5;
            const thickness = 14;
            const valueExtent = (value / maxValue) * (horizontal ? plotWidth : plotHeight);
            return {
                x: horizontal ? left : center - thickness / 2,
                y: horizontal ? center - thickness / 2 : top + plotHeight - valueExtent,
                width: horizontal ? valueExtent : thickness,
                height: horizontal ? thickness : valueExtent,
                color: palette[0],
                legend: null,
                category,
                value,
                ratio,
            };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const discreteMainBars: RenderBar[] = isSizeDiscrete
        ? categories.flatMap((category) => {
              const items = bars.filter((bar) => bar.category === category);
              if (items.length === 0) return [];
              const preferred = items.find((item) => item.series === 'standard') ?? items[0];
              if (!preferred) return [];
              const secondary = items.find((item) => item !== preferred);
              const preferredExtent = Number(preferred.value ?? 0) / quantitativeMax * (horizontal ? plotWidth : plotHeight);
              const secondaryExtent = Number(secondary?.value ?? 0) / quantitativeMax * (horizontal ? plotWidth : plotHeight);
              const total = preferredExtent + secondaryExtent;
              const center = horizontal ? Number(preferred.y) + Number(preferred.height) / 2 : Number(preferred.x) + Number(preferred.width) / 2;
              const out: RenderBar[] = horizontal
                  ? [
                        {
                            x: left,
                            y: center - 2 / 2,
                            width: Math.max(0.8, secondaryExtent),
                            height: 2,
                            color: '#5B8FF9',
                            opacity: 0.92,
                        },
                        {
                            x: left + Math.max(0, secondaryExtent),
                            y: center - 14 / 2,
                            width: Math.max(1, preferredExtent),
                            height: 14,
                            color: '#5B8FF9',
                            opacity: 0.96,
                        },
                    ]
                  : [
                        {
                            x: center - 14 / 2,
                            y: top + plotHeight - Math.max(1, preferredExtent),
                            width: 14,
                            height: Math.max(1, preferredExtent),
                            color: '#5B8FF9',
                            opacity: 0.96,
                        },
                        {
                            x: center - 2 / 2,
                            y: top + plotHeight - Math.max(1, total),
                            width: 2,
                            height: Math.max(0.8, total - preferredExtent),
                            color: '#5B8FF9',
                            opacity: 0.92,
                        },
                    ];
              if (secondary) {
                  return out;
              }
              return out;
          })
        : [];
    const displayBars = discreteMainBars.length > 0 ? discreteMainBars : bars;
    const quantitativeTicks = Array.from({ length: 7 }, (_, index) => (quantitativeMax * index) / 6);
    const pick = (values: number[]) => {
        if (values.length === 0) return [] as number[];
        const indexes = [0, Math.floor(values.length * 0.33), Math.floor(values.length * 0.66), values.length - 1];
        return Array.from(new Set(indexes.map((index) => values[index]).filter((value): value is number => Number.isFinite(value))));
    };
    const formatTick = (value: number) => {
        if (!Number.isFinite(value)) return '';
        if (value >= 1000) return `${Math.round(value).toLocaleString('en-US')}`;
        return `${Math.round(value)}`;
    };
    const quantToPixel = (value: number) => {
        const ratio = quantitativeMax > 0 ? value / quantitativeMax : 0;
        return horizontal ? left + ratio * plotWidth : top + plotHeight - ratio * plotHeight;
    };
    const sizeContinuousLegend = !isSizeDiscrete ? pick(sizeValues) : [];
    return (
        <div style={{ width: '100%', height: '100%', padding: '12px 14px', position: 'relative' }}>
            {isSizeDiscrete ? (
                <div style={{ position: 'absolute', top: 16, right: 10, fontSize: 12, lineHeight: 1.4 }}>
                    {discreteValues.map((value, index) => (
                        <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ width: 10, height: 10, background: palette[index % palette.length], display: 'inline-block' }} />
                            <span>{value}</span>
                        </div>
                    ))}
                </div>
            ) : sizeContinuousLegend.length > 0 ? (
                <div style={{ position: 'absolute', top: 16, right: 10, fontSize: 12, lineHeight: 1.4 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{sizeField?.aggName && sizeField.aggName !== 'expr' ? `${sizeField.aggName}(${sizeField.name})` : sizeField?.name}</div>
                    {sizeContinuousLegend.map((value) => (
                        <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ width: 10, height: 10, background: palette[0], display: 'inline-block' }} />
                            <span>{Math.round(value).toLocaleString('en-US')}</span>
                        </div>
                    ))}
                </div>
            ) : null}
            <svg width={props.chartWidth} height={props.chartHeight - 24} viewBox={`0 0 ${props.chartWidth} ${props.chartHeight - 24}`}>
                {horizontal
                    ? quantitativeTicks.map((tick, index) => {
                          const x = quantToPixel(tick);
                          return (
                              <g key={`qt-${index}`}>
                                  <line x1={x} y1={top} x2={x} y2={top + plotHeight} stroke="#e5e7eb" strokeWidth="1" />
                                  <text x={x} y={top + plotHeight + 16} fontSize="10" textAnchor="middle" fill="#6b7280">
                                      {formatTick(tick)}
                                  </text>
                              </g>
                          );
                      })
                    : quantitativeTicks.map((tick, index) => {
                          const y = quantToPixel(tick);
                          return (
                              <g key={`qt-${index}`}>
                                  <line x1={left} y1={y} x2={left + plotWidth} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                                  <text x={left - 8} y={y} fontSize="10" textAnchor="end" dominantBaseline="middle" fill="#6b7280">
                                      {formatTick(tick)}
                                  </text>
                              </g>
                          );
                      })}
                <line x1={left} y1={top + plotHeight} x2={left + plotWidth} y2={top + plotHeight} stroke="#333" strokeWidth="1" />
                <line x1={left} y1={top} x2={left} y2={top + plotHeight} stroke="#333" strokeWidth="1" />
                {displayBars.map((bar, index) => (
                    <rect key={index} x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={bar.color} opacity={bar.opacity ?? 0.96} />
                ))}
                {horizontal
                    ? categories.map((category, index) => (
                          <text key={category} x={left - 8} y={top + index * band + band / 2} fontSize="11" textAnchor="end" dominantBaseline="middle">
                              {category}
                          </text>
                      ))
                    : categories.map((category, index) => (
                          <text key={category} x={left + index * band + band / 2} y={top + plotHeight + 16} fontSize="11" textAnchor="middle">
                              {category}
                          </text>
                      ))}
                <text x={left + plotWidth / 2} y={props.chartHeight - 28} textAnchor="middle" fontSize="12" fontWeight="600">
                    {horizontal
                        ? xField?.aggName && xField.aggName !== 'expr'
                            ? `${xField.aggName}(${xField.name})`
                            : xField?.name
                        : xField?.name}
                </text>
                <text x={10} y={top + plotHeight / 2} transform={`rotate(-90 10 ${top + plotHeight / 2})`} textAnchor="middle" fontSize="12" fontWeight="600">
                    {horizontal ? yField?.name : yField?.aggName && yField.aggName !== 'expr' ? `${yField.aggName}(${yField.name})` : yField?.name}
                </text>
            </svg>
        </div>
    );
}

function ObservableFacetMeasureBarView(props: RendererPluginProps) {
    const facetField = props.draggableFieldState.rows[0];
    const yField = props.draggableFieldState.rows[1];
    const xField = props.draggableFieldState.columns[0];
    const facetKey = resolveDataKey(props.data, facetField ? { field: facetField.fid, aggregate: facetField.aggName, type: facetField.semanticType } : undefined);
    const xKey = resolveDataKey(props.data, xField ? { field: xField.fid, aggregate: xField.aggName, type: xField.semanticType } : undefined);
    const yKey = resolveDataKey(props.data, yField ? { field: yField.fid, aggregate: yField.aggName, type: yField.semanticType } : undefined);
    if (!facetKey || !xKey || !yKey) {
        return <div style={{ width: '100%', height: '100%' }} />;
    }

    const rows = props.data
        .map((row) => ({
            facet: String(row[facetKey]),
            x: Number(row[xKey] ?? 0),
            y: Number(row[yKey] ?? 0),
        }))
        .filter((row) => Number.isFinite(row.x) && Number.isFinite(row.y))
        .sort((a, b) => a.facet.localeCompare(b.facet));
    const facets = Array.from(new Set(rows.map((row) => row.facet)));
    const xMin = Math.min(...rows.map((row) => row.x));
    const xMax = Math.max(...rows.map((row) => row.x));
    const yMax = Math.max(1, ...rows.map((row) => row.y));

    const left = 58;
    const top = 26;
    const panelGap = 10;
    const panelHeight = (props.chartHeight - top - 52 - panelGap * Math.max(0, facets.length - 1)) / Math.max(1, facets.length);
    const panelWidth = props.chartWidth - left - 22;
    const xScale = (value: number) => left + 8 + ((value - xMin) / Math.max(1, xMax - xMin)) * (panelWidth - 18);
    const yScale = (value: number, panelTop: number) => panelTop + panelHeight - (value / yMax) * panelHeight;

    return (
        <div style={{ width: '100%', height: '100%', padding: '10px 8px' }}>
            <svg width={props.chartWidth} height={props.chartHeight} viewBox={`0 0 ${props.chartWidth} ${props.chartHeight}`}>
                {facets.map((facet, index) => {
                    const row = rows.find((item) => item.facet === facet);
                    if (!row) return null;
                    const panelTop = top + index * (panelHeight + panelGap);
                    const x = xScale(row.x);
                    const y = yScale(row.y, panelTop);
                    return (
                        <g key={facet}>
                            <rect x={left} y={panelTop} width={panelWidth} height={panelHeight} fill="none" stroke="#e5e7eb" />
                            <line x1={left + 8} y1={panelTop + panelHeight} x2={left + panelWidth - 8} y2={panelTop + panelHeight} stroke="#374151" />
                            <line x1={left + 8} y1={panelTop + 8} x2={left + 8} y2={panelTop + panelHeight} stroke="#374151" />
                            <line x1={left + 8} y1={panelTop + panelHeight * 0.5} x2={left + panelWidth - 8} y2={panelTop + panelHeight * 0.5} stroke="#e5e7eb" />
                            <rect x={x - 2.5} y={y} width={5} height={panelTop + panelHeight - y} fill="#5B8FF9" />
                            {index === 0 ? (
                                <>
                                    <text x={left + 2} y={panelTop + panelHeight} fontSize="10" textAnchor="end" fill="#4b5563">
                                        0
                                    </text>
                                    <text x={left + 2} y={panelTop + panelHeight * 0.5} fontSize="10" textAnchor="end" fill="#4b5563">
                                        {Math.round(yMax / 2)}
                                    </text>
                                    <text x={left + 2} y={panelTop + 10} fontSize="10" textAnchor="end" fill="#4b5563">
                                        {Math.round(yMax)}
                                    </text>
                                </>
                            ) : null}
                            <text x={left - 10} y={panelTop + 12} fontSize="11" textAnchor="end">
                                {facet}
                            </text>
                        </g>
                    );
                })}
                <text x={left + 8} y={props.chartHeight - 26} fontSize="10" textAnchor="start" fill="#4b5563">
                    {Math.round(xMin)}
                </text>
                <text x={left + panelWidth - 8} y={props.chartHeight - 26} fontSize="10" textAnchor="end" fill="#4b5563">
                    {Math.round(xMax)}
                </text>
                <text x={props.chartWidth / 2} y={props.chartHeight - 10} textAnchor="middle" fontSize="12" fontWeight="600">
                    {xField?.aggName && xField.aggName !== 'expr' ? `${xField.aggName}(${xField.name})` : xField?.name}
                </text>
                <text x={14} y={props.chartHeight / 2} transform={`rotate(-90 14 ${props.chartHeight / 2})`} textAnchor="middle" fontSize="12" fontWeight="600">
                    {yField?.aggName && yField.aggName !== 'expr' ? `${yField.aggName}(${yField.name})` : yField?.name}
                </text>
                <text x={left - 34} y={top - 8} fontSize="11" textAnchor="start" fill="#374151">
                    {facetField?.name}
                </text>
            </svg>
        </div>
    );
}

function ObservableFacetColumnMeasureBarView(props: RendererPluginProps) {
    const facetField = props.draggableFieldState.columns[0];
    const xField = props.draggableFieldState.columns[1];
    const yField = props.draggableFieldState.rows[0];
    const facetKey = resolveDataKey(props.data, facetField ? { field: facetField.fid, aggregate: facetField.aggName, type: facetField.semanticType } : undefined);
    const xKey = resolveDataKey(props.data, xField ? { field: xField.fid, aggregate: xField.aggName, type: xField.semanticType } : undefined);
    const yKey = resolveDataKey(props.data, yField ? { field: yField.fid, aggregate: yField.aggName, type: yField.semanticType } : undefined);
    if (!facetKey || !xKey || !yKey) {
        return <div style={{ width: '100%', height: '100%' }} />;
    }

    const rows = props.data
        .map((row) => ({
            facet: String(row[facetKey]),
            x: Number(row[xKey] ?? 0),
            y: Number(row[yKey] ?? 0),
        }))
        .filter((row) => Number.isFinite(row.x) && Number.isFinite(row.y))
        .sort((a, b) => a.facet.localeCompare(b.facet));
    const facets = Array.from(new Set(rows.map((row) => row.facet)));
    if (facets.length === 0) return <div style={{ width: '100%', height: '100%' }} />;

    const xMin = Math.min(...rows.map((row) => row.x));
    const xMax = Math.max(...rows.map((row) => row.x));
    const yMax = Math.max(1, ...rows.map((row) => row.y));
    const yTicks = Array.from({ length: 7 }, (_, index) => (yMax * index) / 6);
    const xTicks = Array.from({ length: 5 }, (_, index) => xMin + ((xMax - xMin) * index) / 4);
    const left = 56;
    const top = 40;
    const bottom = 54;
    const right = 18;
    const panelGap = 14;
    const panelWidth = (props.chartWidth - left - right - panelGap * Math.max(0, facets.length - 1)) / Math.max(1, facets.length);
    const panelHeight = props.chartHeight - top - bottom;
    const xScale = (value: number, panelLeft: number) => panelLeft + ((value - xMin) / Math.max(1, xMax - xMin)) * panelWidth;
    const yScale = (value: number) => top + panelHeight - (value / yMax) * panelHeight;

    return (
        <div style={{ width: '100%', height: '100%', padding: '10px 8px' }}>
            <svg width={props.chartWidth} height={props.chartHeight} viewBox={`0 0 ${props.chartWidth} ${props.chartHeight}`}>
                {facets.map((facet, index) => {
                    const row = rows.find((item) => item.facet === facet);
                    if (!row) return null;
                    const panelLeft = left + index * (panelWidth + panelGap);
                    const x = xScale(row.x, panelLeft);
                    const y = yScale(row.y);
                    return (
                        <g key={facet}>
                            <rect x={panelLeft} y={top} width={panelWidth} height={panelHeight} fill="none" stroke="#d1d5db" />
                            {yTicks.map((tick, tickIndex) => {
                                const yy = yScale(tick);
                                return (
                                    <line
                                        key={`${facet}-yt-${tickIndex}`}
                                        x1={panelLeft}
                                        y1={yy}
                                        x2={panelLeft + panelWidth}
                                        y2={yy}
                                        stroke="#e5e7eb"
                                        strokeWidth="1"
                                    />
                                );
                            })}
                            {xTicks.map((tick, tickIndex) => {
                                const xx = xScale(tick, panelLeft);
                                return (
                                    <line
                                        key={`${facet}-xt-${tickIndex}`}
                                        x1={xx}
                                        y1={top}
                                        x2={xx}
                                        y2={top + panelHeight}
                                        stroke="#e5e7eb"
                                        strokeWidth="1"
                                    />
                                );
                            })}
                            <line x1={panelLeft} y1={top + panelHeight} x2={panelLeft + panelWidth} y2={top + panelHeight} stroke="#6b7280" />
                            <line x1={panelLeft} y1={top} x2={panelLeft} y2={top + panelHeight} stroke="#6b7280" />
                            <rect x={x - 2} y={y} width={4} height={top + panelHeight - y} fill="#5B8FF9" />
                            {xTicks.map((tick, tickIndex) => (
                                <text
                                    key={`${facet}-xv-${tickIndex}`}
                                    x={xScale(tick, panelLeft)}
                                    y={top + panelHeight + 16}
                                    fontSize="10"
                                    textAnchor="middle"
                                    fill="#4b5563"
                                >
                                    {Math.round(tick).toLocaleString('en-US')}
                                </text>
                            ))}
                            <text x={panelLeft + panelWidth / 2} y={top - 12} fontSize="11" textAnchor="middle" fill="#111827">
                                {facet}
                            </text>
                        </g>
                    );
                })}
                {yTicks.map((tick, index) => (
                    <text key={`y-axis-${index}`} x={left - 8} y={yScale(tick)} fontSize="10" textAnchor="end" dominantBaseline="middle" fill="#4b5563">
                        {Math.round(tick).toLocaleString('en-US')}
                    </text>
                ))}
                <text x={props.chartWidth / 2} y={props.chartHeight - 10} textAnchor="middle" fontSize="12" fontWeight="600">
                    {xField?.aggName && xField.aggName !== 'expr' ? `${xField.aggName}(${xField.name})` : xField?.name}
                </text>
                <text x={14} y={props.chartHeight / 2} transform={`rotate(-90 14 ${props.chartHeight / 2})`} textAnchor="middle" fontSize="12" fontWeight="600">
                    {yField?.aggName && yField.aggName !== 'expr' ? `${yField.aggName}(${yField.name})` : yField?.name}
                </text>
            </svg>
        </div>
    );
}

function buildSupplementalLegend(props: RendererPluginProps) {
    const shapeField = props.draggableFieldState.shape[0];
    const sizeField = props.draggableFieldState.size[0];
    const opacityField = props.draggableFieldState.opacity[0];
    const shapeKey = resolveDataKey(props.data, shapeField ? { field: shapeField.fid, aggregate: shapeField.aggName, type: shapeField.semanticType } : undefined);
    const sizeKey = resolveDataKey(props.data, sizeField ? { field: sizeField.fid, aggregate: sizeField.aggName, type: sizeField.semanticType } : undefined);
    const opacityKey = resolveDataKey(props.data, opacityField ? { field: opacityField.fid, aggregate: opacityField.aggName, type: opacityField.semanticType } : undefined);
    const geom = props.visualConfig.geoms[0];
    const shapeActive = geom !== 'circle' && Boolean(shapeField);
    const sizeActive = Boolean(sizeField);
            const opacityActive = Boolean(opacityField);
    if (!shapeActive && !sizeActive && !opacityActive) return null;
    const resolve = props.layout.resolve as ResolveEncodingMap | undefined;
    const hasIndependentEncoding = Boolean(resolve?.shape || resolve?.size || resolve?.opacity);
    const hasFacetForPoints =
        (geom === 'point' || geom === 'circle') &&
        (props.draggableFieldState.rows.some((field) => field.analyticType === 'dimension') ||
            props.draggableFieldState.columns.some((field) => field.analyticType === 'dimension'));
    if (hasFacetForPoints && !hasIndependentEncoding) return null;
    const hasFacet =
        props.draggableFieldState.rows.some((field) => field.analyticType === 'dimension') ||
        props.draggableFieldState.columns.some((field) => field.analyticType === 'dimension');

    const shapeValues = shapeField && shapeKey ? Array.from(new Set(props.data.map((row) => String(row[shapeKey])))).sort() : [];
    const sizeIsDiscrete = sizeField?.analyticType === 'dimension';
    const sizeValues = sizeField
        ? props.data.map((row) => Number(row[sizeKey ?? ''])).filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
        : [];
    const sizeDiscreteValues = sizeField && sizeIsDiscrete && sizeKey ? Array.from(new Set(props.data.map((row) => String(row[sizeKey])))).sort() : [];
    const opacityIsDiscrete = opacityField?.analyticType === 'dimension';
    const opacityDiscreteValues =
        opacityField && opacityIsDiscrete && opacityKey ? Array.from(new Set(props.data.map((row) => String(row[opacityKey])))).sort() : [];
    const opacityValues = opacityField
        ? props.data.map((row) => Number(row[opacityKey ?? ''])).filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
        : [];
    const palette = getDiscretePalette(props.vegaConfig);

    const pick = (values: number[]) => {
        if (values.length === 0) return [];
        const indexes = [0, Math.floor(values.length * 0.25), Math.floor(values.length * 0.5), Math.floor(values.length * 0.75), values.length - 1];
        return Array.from(new Set(indexes.map((index) => values[index])));
    };

    if (hasFacet && hasIndependentEncoding && (geom === 'point' || geom === 'circle')) {
        const colorField = props.draggableFieldState.color[0];
        const colorKey = resolveDataKey(props.data, colorField ? { field: colorField.fid, aggregate: colorField.aggName, type: colorField.semanticType } : undefined);
        const facetField =
            props.draggableFieldState.columns.find((field) => field.analyticType === 'dimension') ??
            props.draggableFieldState.rows.find((field) => field.analyticType === 'dimension');
        const facetKey = resolveDataKey(props.data, facetField ? { field: facetField.fid, aggregate: facetField.aggName, type: facetField.semanticType } : undefined);
        const showLocalColor = Boolean(resolve?.color);
        const showLocalSize = Boolean(resolve?.size) && sizeActive;
        const showLocalShape = Boolean(resolve?.shape) && shapeActive;
        const showLocalOpacity = Boolean(resolve?.opacity) && opacityActive;
        if (!facetKey) return null;
        const facetValues = Array.from(new Set(props.data.map((row) => String(row[facetKey])))).sort();
        if (facetValues.length < 2) return null;
        return (
            <div
                style={{
                    position: 'absolute',
                    top: 2,
                    left: 12,
                    right: 12,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${facetValues.length}, minmax(0, 1fr))`,
                    gap: 6,
                    alignItems: 'start',
                    pointerEvents: 'none',
                }}
            >
                {facetValues.map((facet) => {
                    const rows = props.data.filter((row) => String(row[facetKey]) === facet);
                    const localShapeValues = showLocalShape && shapeKey ? Array.from(new Set(rows.map((row) => String(row[shapeKey])))).sort() : [];
                    const colorIsContinuous = Boolean(colorField && (colorField.analyticType === 'measure' || colorField.semanticType === 'quantitative'));
                    const localColorValues = colorKey ? Array.from(new Set(rows.map((row) => String(row[colorKey])))).sort() : [];
                    const localColorNums = colorKey
                        ? rows.map((row) => Number(row[colorKey])).filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
                        : [];
                    const localOpacityValues = opacityKey
                        ? rows.map((row) => Number(row[opacityKey])).filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
                        : [];
                    const continuousRamp = getContinuousPalette(props.vegaConfig, geom);
                    const colorMin = localColorNums.length > 0 ? localColorNums[0] : 0;
                    const colorMax = localColorNums.length > 0 ? localColorNums[localColorNums.length - 1] : 1;
                    return (
                        <div key={facet} style={{ background: 'rgba(255,255,255,0.96)', padding: '5px 6px', fontSize: 10, lineHeight: 1.25 }}>
                            {showLocalColor && colorIsContinuous && localColorNums.length > 0 ? (
                                <div style={{ marginBottom: 3 }}>
                                    <div style={{ fontWeight: 600 }}>{colorField?.name}</div>
                                    {pick(localColorNums).map((value) => (
                                        <div key={`color-${facet}-${value}`} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <span
                                                style={{
                                                    width: 7,
                                                    height: 7,
                                                    borderRadius: 999,
                                                    background: valueToRampColor(value, colorMin, colorMax, continuousRamp),
                                                    display: 'inline-block',
                                                }}
                                            />
                                            <span>{Math.round(value)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : showLocalColor && localColorValues.length > 0 ? (
                                <div style={{ marginBottom: 3 }}>
                                    <div style={{ fontWeight: 600 }}>{colorField?.name}</div>
                                    {localColorValues.map((value, index) => (
                                        <div key={`color-${facet}-${value}`} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <span style={{ width: 7, height: 7, background: palette[index % palette.length], display: 'inline-block' }} />
                                            <span>{value}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                            {showLocalShape && localShapeValues.length > 0 ? (
                                <div style={{ marginBottom: 3 }}>
                                    <div style={{ fontWeight: 600 }}>{shapeField?.name}</div>
                                    {localShapeValues.map((value, index) => (
                                        <div key={`shape-${facet}-${value}`} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <span style={{ width: 10, textAlign: 'center' }}>{index === 0 ? '○' : index === 1 ? '□' : '△'}</span>
                                            <span>{value}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                            {showLocalSize && sizeValues.length > 0 ? (
                                <div style={{ marginBottom: 3 }}>
                                    <div style={{ fontWeight: 600 }}>{sizeField?.name}</div>
                                    {pick(sizeValues).map((value, index, arr) => {
                                        const r = 2.5 + (index / Math.max(1, arr.length - 1)) * 4.5;
                                        return (
                                            <div key={`size-${facet}-${value}`} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                <span
                                                    style={{
                                                        width: r * 2,
                                                        height: r * 2,
                                                        borderRadius: 999,
                                                        border: `1px solid ${palette[0]}`,
                                                        display: 'inline-block',
                                                    }}
                                                />
                                                <span>{Math.round(value)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : null}
                            {showLocalOpacity && localOpacityValues.length > 0 ? (
                                <div>
                                    <div style={{ fontWeight: 600 }}>{opacityField?.name}</div>
                                    {pick(localOpacityValues).map((value, index, arr) => {
                                        const alpha = 0.18 + (index / Math.max(1, arr.length - 1)) * 0.82;
                                        return (
                                            <div key={`opacity-${facet}-${value}`} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                <span
                                                    style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: 999,
                                                        background: palette[0],
                                                        opacity: alpha,
                                                        display: 'inline-block',
                                                    }}
                                                />
                                                <span>{Math.round(value)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                alignItems: 'stretch',
            }}
        >
            {shapeActive ? (
                <div style={{ background: 'rgba(255,255,255,0.92)', padding: '6px 8px', fontSize: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>{shapeField?.name}</div>
                    {shapeValues.map((value, index) => (
                        <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ width: 12, textAlign: 'center' }}>{index === 0 ? '○' : index === 1 ? '□' : '△'}</span>
                            <span>{value}</span>
                        </div>
                    ))}
                </div>
            ) : null}
            {sizeActive ? (
                <div style={{ background: 'rgba(255,255,255,0.92)', padding: '6px 8px', fontSize: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>{sizeField?.name}</div>
                    {sizeIsDiscrete
                        ? sizeDiscreteValues.map((value, index) => {
                              const r = 3 + (index / Math.max(1, sizeDiscreteValues.length - 1)) * 8;
                              return (
                                  <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                      <span style={{ width: r * 2, height: r * 2, borderRadius: 999, border: `1.5px solid ${palette[0]}`, display: 'inline-block' }} />
                                      <span>{value}</span>
                                  </div>
                              );
                          })
                        : pick(sizeValues).map((value, index, arr) => {
                              const r = 3 + (index / Math.max(1, arr.length - 1)) * 8;
                              return (
                                  <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                      <span style={{ width: r * 2, height: r * 2, borderRadius: 999, border: `1.5px solid ${palette[0]}`, display: 'inline-block' }} />
                                      <span>{Math.round(value)}</span>
                                  </div>
                              );
                          })}
                </div>
            ) : null}
            {opacityActive ? (
                <div style={{ background: 'rgba(255,255,255,0.92)', padding: '6px 8px', fontSize: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>{opacityField?.name}</div>
                    {opacityIsDiscrete
                        ? opacityDiscreteValues.map((value, index) => {
                              const alpha = 0.28 + (index / Math.max(1, opacityDiscreteValues.length - 1)) * 0.64;
                              return (
                                  <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                      <span style={{ width: 10, height: 10, borderRadius: 999, background: '#555', opacity: alpha, display: 'inline-block' }} />
                                      <span>{value}</span>
                                  </div>
                              );
                          })
                        : pick(opacityValues).map((value, index, arr) => {
                              const alpha = 0.2 + (index / Math.max(1, arr.length - 1)) * 0.8;
                              return (
                                  <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                      <span style={{ width: 10, height: 10, borderRadius: 999, background: '#555', opacity: alpha, display: 'inline-block' }} />
                                      <span>{Math.round(value)}</span>
                                  </div>
                              );
                          })}
                </div>
            ) : null}
        </div>
    );
}

function ObservableCenterPointView(props: RendererPluginProps) {
    const colorField = props.draggableFieldState.color[0];
    const colorKey = resolveDataKey(props.data, colorField ? { field: colorField.fid, aggregate: colorField.aggName, type: colorField.semanticType } : undefined);
    const palette = getDiscretePalette(props.vegaConfig);
    const values = colorKey ? Array.from(new Set(props.data.map((row) => String(row[colorKey])))).sort() : [];
    const pointColor = values.length > 1 ? palette[1] ?? palette[0] : palette[0];

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '18px 22px' }}>
            <svg width={props.chartWidth * 0.72} height={props.chartHeight - 36} viewBox={`0 0 ${props.chartWidth * 0.72} ${props.chartHeight - 36}`}>
                <circle cx={(props.chartWidth * 0.72) / 2} cy={(props.chartHeight - 36) / 2} r="4" fill={pointColor} />
            </svg>
            <div style={{ minWidth: 120 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{colorField?.name ?? 'color'}</div>
                {values.map((value, index) => (
                    <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 999, background: palette[index % palette.length], display: 'inline-block' }} />
                        <span>{value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ObservableArcView(props: RendererPluginProps) {
    const colorField = props.draggableFieldState.color[0];
    const thetaField = props.draggableFieldState.theta[0] ?? props.draggableFieldState.rows[0] ?? props.draggableFieldState.columns[0];
    const radiusField = props.draggableFieldState.radius[0];
    const colorKey = resolveDataKey(props.data, colorField ? { field: colorField.fid, aggregate: colorField.aggName, type: colorField.semanticType } : undefined);
    const thetaKey = resolveDataKey(props.data, thetaField ? { field: thetaField.fid, aggregate: thetaField.aggName, type: thetaField.semanticType } : undefined);
    const radiusKey = resolveDataKey(props.data, radiusField ? { field: radiusField.fid, aggregate: radiusField.aggName, type: radiusField.semanticType } : undefined);

    const slices = useMemo(() => {
        if (!thetaKey) return [];
        return props.data.map((row, index) => ({
            id: `${index}-${colorKey ? String(row[colorKey] ?? '') : 'value'}`,
            label: colorKey ? String(row[colorKey] ?? '') : (thetaField?.name ?? 'value'),
            theta: Number(row[thetaKey] ?? 0),
            radius: radiusKey ? Number(row[radiusKey] ?? 0) : undefined,
        }));
    }, [colorKey, thetaKey, radiusKey, props.data, thetaField?.name]);
    const legendDomain = useMemo(() => Array.from(new Set(slices.map((slice) => slice.label))).sort((a, b) => a.localeCompare(b)), [slices]);

    const palette = getDiscretePalette(props.vegaConfig);
    const width = props.chartWidth;
    const height = props.chartHeight;
    const legendWidth = 180;
    const plotWidth = Math.max(220, width - legendWidth);
    const cx = plotWidth * 0.5;
    const cy = height * 0.52;
    const baseRadius = Math.min(plotWidth * 0.43, height * 0.45);
    const radiusExtent = slices.map((slice) => slice.radius ?? 0).filter((value) => Number.isFinite(value));
    const radiusMin = radiusExtent.length ? Math.min(...radiusExtent) : 0;
    const radiusMax = radiusExtent.length ? Math.max(...radiusExtent) : 0;
    const thetaMax = Math.max(1, ...slices.map((slice) => Math.max(0, slice.theta)));
    const orderedSlices = useMemo(() => {
        if (!radiusKey) return [...slices];
        const byRadius = [...slices].sort((a, b) => (b.radius ?? 0) - (a.radius ?? 0));
        const [outer, ...rest] = byRadius;
        if (!outer) return [];
        const byThetaDesc = rest.sort((a, b) => b.theta - a.theta);
        if (byThetaDesc.length <= 1) return [outer, ...byThetaDesc];
        const [largestTheta, secondLargestTheta, ...tail] = byThetaDesc;
        return [outer, secondLargestTheta, largestTheta, ...tail];
    }, [radiusKey, slices]);
    const visibleSlices = orderedSlices;
    const thetaTotal = Math.max(1, visibleSlices.reduce((acc, slice) => acc + Math.max(0, slice.theta), 0));
    const getAngles = (index: number, theta: number) => {
        if (radiusKey) {
            const ratio = Math.max(0, Math.min(1, theta / thetaMax));
            return { startAngle: 0, endAngle: ratio * Math.PI * 2 };
        }
        const start = 0;
        const consumed = visibleSlices
            .slice(0, index)
            .reduce((acc, slice) => acc + Math.max(0, slice.theta), 0);
        const startAngle = start + (consumed / thetaTotal) * Math.PI * 2;
        const endAngle = startAngle + (Math.max(0, theta) / thetaTotal) * Math.PI * 2;
        return { startAngle, endAngle };
    };
    const arcRotationDeg = 0;

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}>
            <svg width={plotWidth} height={height} viewBox={`0 0 ${plotWidth} ${height}`}>
                {visibleSlices.map((slice, index) => {
                    const normalizedRadius = radiusKey
                        ? radiusMax > radiusMin
                            ? Math.max(0, Math.min(1, ((slice.radius ?? radiusMin) - radiusMin) / (radiusMax - radiusMin)))
                            : 1
                        : 1;
                    if (radiusKey && normalizedRadius < 0.2) {
                        return null;
                    }
                    const outerRadius = baseRadius * normalizedRadius;
                    const { startAngle, endAngle } = getAngles(index, slice.theta);
                    if (radiusKey && Math.abs(endAngle - startAngle) >= Math.PI * 2 - 1e-6) {
                        const colorIndex = legendDomain.indexOf(slice.label);
                        return (
                            <circle
                                key={slice.id}
                                cx={cx}
                                cy={cy}
                                r={outerRadius}
                                fill={palette[(colorIndex >= 0 ? colorIndex : index) % palette.length]}
                            />
                        );
                    }
                    const path = d3Arc()
                        .innerRadius(0)
                        .outerRadius(outerRadius)
                        .startAngle(startAngle)
                        .endAngle(endAngle)({
                            innerRadius: 0,
                            outerRadius,
                            startAngle,
                            endAngle,
                        });
                    if (!path) return null;
                    const colorIndex = legendDomain.indexOf(slice.label);
                    return (
                        <path
                            key={slice.id}
                            d={path}
                            transform={`translate(${cx}, ${cy}) rotate(${arcRotationDeg})`}
                            fill={palette[(colorIndex >= 0 ? colorIndex : index) % palette.length]}
                        />
                    );
                })}
            </svg>
            <div style={{ width: legendWidth - 12, alignSelf: 'flex-start', paddingTop: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{colorField?.name ?? thetaField?.name ?? 'category'}</div>
                {legendDomain.map((label, index) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
                        <span style={{ width: 12, height: 12, background: palette[index % palette.length], display: 'inline-block' }} />
                        <span>{label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

const SUPPORTED_GEOMS = new Set(['auto', 'bar', 'line', 'area', 'point', 'circle', 'tick', 'rect', 'rule', 'boxplot', 'text', 'arc']);

export function createObservablePlotPlugin(): RendererPlugin {
    return {
        id: 'plugin:observable-plot',
        displayName: 'Observable Plot',
        priority: 20,
        canRender: (props) => props.visualConfig.coordSystem !== 'geographic' && SUPPORTED_GEOMS.has(props.visualConfig.geoms[0]),
        render: (props) => <ObservablePlotView {...props} />,
    };
}
