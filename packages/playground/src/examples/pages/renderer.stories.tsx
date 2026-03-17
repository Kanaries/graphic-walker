import { useContext, useMemo, useState } from 'react';
import spec from '../specs/student-chart.json';
import { createEChartsPlugin } from '@kanaries/graphic-walker-renderer-echarts';
import { createObservablePlotPlugin } from '@kanaries/graphic-walker-renderer-observable-plot';
import { GraphicRenderer, IChart, RendererId } from '@kanaries/graphic-walker';
import { themeContext } from '../context';
import { useFetch, IDataSource } from '../util';

export default function GraphicWalkerComponent() {
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>('https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json');
    const [renderer, setRenderer] = useState<RendererId>('vega-lite');
    const chart = useMemo(
        () =>
            (spec as IChart[]).map((item) => ({
                ...item,
                layout: {
                    ...item.layout,
                    renderer,
                },
            })),
        [renderer]
    );

    return (
        <div className="space-y-2">
            <select value={renderer} onChange={(e) => setRenderer(e.target.value as RendererId)}>
                <option value="vega-lite">VegaLite</option>
                <option value="plugin:observable-plot">Observable Plot</option>
                <option value="plugin:echarts">ECharts</option>
            </select>
            <GraphicRenderer
                key={renderer}
                fields={fields}
                chart={chart}
                data={dataSource}
                appearance={theme}
                defaultRenderer={renderer}
                rendererPlugins={[createObservablePlotPlugin(), createEChartsPlugin()]}
            />
        </div>
    );
}
