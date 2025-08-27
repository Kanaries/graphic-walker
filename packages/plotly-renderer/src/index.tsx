import React, { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import { registerRenderer, RendererProps } from '@kanaries/graphic-walker';

const PlotlyRenderer = React.forwardRef<HTMLDivElement, RendererProps>(function PlotlyRenderer(props, ref) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const xField = props.columns[0]?.fid ?? props.rows[0]?.fid;
        const yField = props.rows[0]?.fid ?? props.columns[0]?.fid;
        if (!xField || !yField) return;
        const trace: Partial<Plotly.PlotData> = {
            x: props.dataSource.map((d) => d[xField]),
            y: props.dataSource.map((d) => d[yField]),
            type: props.geomType === 'bar' ? 'bar' : 'scatter',
            mode: props.geomType === 'point' ? 'markers' : undefined,
        };
        Plotly.newPlot(el, [trace], { width: props.width, height: props.height });
    }, [props]);

    return <div ref={(node) => {
        (containerRef as any).current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as any).current = node;
    }} />;
});

registerRenderer('plotly', PlotlyRenderer);

export default PlotlyRenderer;
