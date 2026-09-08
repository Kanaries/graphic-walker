import { useContext, useMemo } from 'react';
import { themeContext } from '../context';
import { GraphicRenderer, normalize } from '@kanaries/graphic-walker';
import type { TerseSpec } from '@kanaries/graphic-walker';
import { useFetch, IDataSource } from '../util';

const DATASET_URL = 'https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-bikesharing-service.json';

const spec: TerseSpec = {
    mark: 'line',
    x: { field: 'date', timeUnit: 'month' },
    y: 'mean(count)',
    color: 'workingday',
};

export default function TeaserTimeSeries() {
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>(DATASET_URL);
    const chart = useMemo(() => [normalize(spec, fields)], [fields]);

    return <GraphicRenderer fields={fields} data={dataSource} chart={chart} appearance={theme} />;
}
