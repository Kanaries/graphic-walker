import { useEffect, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import Plotly from 'plotly.js/dist/plotly';
import type { IRendererProps, IRendererHandler } from './interfaces';
import { vegaLiteToPlotly } from './vega-to-plotly';
import { toVegaSpec } from './vega-spec';

/**
 * Plotly renderer component for Graphic Walker
 */
const PlotlyRenderer = forwardRef<IRendererHandler, IRendererProps>(function PlotlyRenderer(props, ref) {
    const {
        name,
        rows = [],
        columns = [],
        dataSource = [],
        defaultAggregate = true,
        stack = 'stack',
        geomType,
        color,
        opacity,
        size,
        theta,
        radius,
        shape,
        text,
        onGeomClick,
        showActions,
        interactiveScale,
        layoutMode,
        width,
        height,
        details = [],
        locale = 'en-US',
        useSvg,
        scales,
        scale,
        displayOffset,
        vegaConfig,
        onReportSpec,
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);
    const plotlyRef = useRef<any>(null);

    // Generate Vega-Lite spec first, then transform to Plotly
    const plotlySpec = useMemo(() => {
        // First generate Vega-Lite spec
        const vegaLiteSpecs = toVegaSpec({
            rows,
            columns,
            color,
            opacity,
            size,
            shape,
            theta,
            radius,
            text,
            details,
            interactiveScale,
            dataSource,
            layoutMode,
            width,
            height,
            defaultAggregated: defaultAggregate,
            geomType,
            stack,
            scales,
            mediaTheme: 'light', // TODO: get from context
            vegaConfig,
            displayOffset,
        });

        // Transform Vega-Lite to Plotly
        if (vegaLiteSpecs.length > 0) {
            return vegaLiteToPlotly(vegaLiteSpecs[0]);
        }
        
        return null;
    }, [
        rows, columns, color, opacity, size, shape, theta, radius, text,
        details, interactiveScale, dataSource, layoutMode, width, height,
        defaultAggregate, geomType, stack, scales, vegaConfig, displayOffset
    ]);

    // Report spec for debugging
    useEffect(() => {
        if (onReportSpec && plotlySpec) {
            onReportSpec(JSON.stringify(plotlySpec, null, 2));
        }
        return () => {
            onReportSpec?.('');
        };
    }, [plotlySpec, onReportSpec]);

    // Render Plotly chart
    useEffect(() => {
        if (!containerRef.current || !plotlySpec) return;

        const { data, layout, config } = plotlySpec;
        
        // Clear previous plot
        Plotly.purge(containerRef.current);
        
        // Create new plot
        Plotly.newPlot(containerRef.current, data, layout, config)
            .then((gd: any) => {
                plotlyRef.current = gd;
                
                // Add click handler
                if (onGeomClick) {
                    gd.on('plotly_click', (eventData: any) => {
                        onGeomClick(eventData.points[0], eventData.event);
                    });
                }
            })
            .catch((error: any) => {
                console.error('Failed to create Plotly chart:', error);
            });

        return () => {
            if (containerRef.current) {
                Plotly.purge(containerRef.current);
            }
        };
    }, [plotlySpec, onGeomClick]);

    // Handle resize
    useEffect(() => {
        if (!containerRef.current || !plotlyRef.current) return;

        const handleResize = () => {
            Plotly.Plots.resize(plotlyRef.current);
        };

        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    // Expose handler methods
    useImperativeHandle(
        ref,
        () => ({
            getSVGData: async () => {
                if (!plotlyRef.current) return [];
                
                return new Promise((resolve) => {
                    Plotly.toImage(plotlyRef.current, { format: 'svg', width, height })
                        .then((url: string) => {
                            // Convert data URL to SVG string
                            const svgString = atob(url.split(',')[1]);
                            resolve([svgString]);
                        })
                        .catch(() => resolve([]));
                });
            },
            
            getCanvasData: async () => {
                if (!plotlyRef.current) return [];
                
                return new Promise((resolve) => {
                    Plotly.toImage(plotlyRef.current, { format: 'png', width, height })
                        .then((url: string) => {
                            resolve([url]);
                        })
                        .catch(() => resolve([]));
                });
            },
            
            downloadSVG: async (filename = 'chart.svg') => {
                const data = await (ref as any).current?.getSVGData();
                if (data.length > 0) {
                    const blob = new Blob([data[0]], { type: 'image/svg+xml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);
                }
                return data;
            },
            
            downloadPNG: async (filename = 'chart.png') => {
                if (!plotlyRef.current) return [];
                
                return new Promise((resolve) => {
                    Plotly.downloadImage(plotlyRef.current, {
                        format: 'png',
                        width,
                        height,
                        filename: filename.replace('.png', ''),
                    })
                        .then(() => resolve([]))
                        .catch(() => resolve([]));
                });
            },
        }),
        [width, height]
    );

    return (
        <div
            ref={containerRef}
            style={{
                width: layoutMode === 'auto' ? 'auto' : width,
                height: layoutMode === 'auto' ? 'auto' : height,
                minHeight: layoutMode === 'auto' ? 400 : undefined,
            }}
        />
    );
});

export default PlotlyRenderer;