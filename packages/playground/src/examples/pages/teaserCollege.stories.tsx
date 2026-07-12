import { useContext, useMemo } from 'react';
import { themeContext } from '../context';
import { GraphicRenderer, normalize } from '@kanaries/graphic-walker';
import type { TerseSpec } from '@kanaries/graphic-walker';
import { useFetch, IDataSource } from '../util';

const DATASET_URL = '/datasets/ds-collage-service.json';

const spec: TerseSpec = {
    mark: 'point',
    x: 'AverageCost',
    y: 'MedianEarnings',
    color: 'FundingModel',
    size: 'AdmissionRate',
    aggregate: false,
    filters: [
        { field: 'MedianEarnings', range: [10000, null] },
        { field: 'AverageCost', range: [1000, null] },
    ],
};

export default function TeaserCollege() {
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>(DATASET_URL);
    const chart = useMemo(() => [normalize(spec, fields)], [fields]);

    return <GraphicRenderer fields={fields} data={dataSource} chart={chart} appearance={theme} />;
}
