import { useContext, useState } from 'react';
import spec from '../specs/student-chart-filter.json';
import { GraphicRenderer, IChart, getRendererList } from '@kanaries/graphic-walker';
import { themeContext } from '../context';
import { useFetch, IDataSource } from '../util';

export default function GraphicWalkerComponent() {
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>('https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json');
    const [renderer, setRenderer] = useState<string>('vega-lite');
    const renderers = getRendererList();

    return (
        <div className="space-y-2">
            <select value={renderer} onChange={(e) => setRenderer(e.target.value)}>
                {renderers.map((r) => (
                    <option key={r} value={r}>
                        {r}
                    </option>
                ))}
            </select>
            <GraphicRenderer
                fields={fields}
                chart={spec as IChart[]}
                data={dataSource}
                appearance={theme}
                defaultRenderer={renderer}
            />
        </div>
    );
}
