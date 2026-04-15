import * as Plot from '@observablehq/plot';
import React, { useEffect, useMemo, useRef } from 'react';
import type { RendererPlugin, RendererPluginProps } from '@kanaries/graphic-walker';
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
