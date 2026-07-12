import { useContext, useMemo } from 'react';
import { themeContext } from '../context';
import { GraphicRenderer, normalize } from '@kanaries/graphic-walker';
import type { TerseSpec } from '@kanaries/graphic-walker';
import { useFetch, IDataSource } from '../util';

const DATASET_URL = '/datasets/ds-carsales-service.json';

const spec: TerseSpec = {
    mark: 'point',
    x: 'Horsepower',
    y: 'Price_in_thousands',
    color: 'Vehicle_type',
    size: 'Engine_size',
    aggregate: false,
};

export default function TeaserScatter() {
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>(DATASET_URL);
    const chart = useMemo(() => [normalize(spec, fields)], [fields]);

    return <GraphicRenderer fields={fields} data={dataSource} chart={chart} appearance={theme} />;
}
