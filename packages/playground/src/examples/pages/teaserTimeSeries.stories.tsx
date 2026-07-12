import { useContext, useMemo } from 'react';
import { themeContext } from '../context';
import { GraphicRenderer, normalize } from '@kanaries/graphic-walker';
import type { TerseSpec } from '@kanaries/graphic-walker';
import { useFetch, IDataSource } from '../util';

const DATASET_URL = '/datasets/ds-bikesharing-service.json';

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
