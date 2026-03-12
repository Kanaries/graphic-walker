import { useContext } from 'react';
import { themeContext } from '../context';
import { GraphicWalker } from '@kanaries/graphic-walker';
import { IDataSource, useFetch } from '../util';
import { createEChartsPlugin } from '@kanaries/graphic-walker-renderer-echarts';
import { createObservablePlotPlugin } from '@kanaries/graphic-walker-renderer-observable-plot';

export default function GraphicWalkerComponent() {
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>('https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json');
    return (
        <GraphicWalker
            defaultRenderer="plugin:echarts"
            rendererPlugins={[createObservablePlotPlugin(), createEChartsPlugin()]}
            fields={fields}
            data={dataSource}
            appearance={theme}
            vizThemeConfig="g2"
        />
    );
}
