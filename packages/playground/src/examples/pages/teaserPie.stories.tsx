import { useContext, useMemo } from 'react';
import { themeContext } from '../context';
import { GraphicRenderer, normalize } from '@kanaries/graphic-walker';
import type { TerseSpec } from '@kanaries/graphic-walker';
import { useFetch, IDataSource } from '../util';

const DATASET_URL = '/datasets/ds-carsales-service.json';

const spec: TerseSpec = {
    mark: 'arc',
    theta: 'sum(Sales_in_thousands)',
    color: 'Manufacturer',
    filters: [{ field: 'Vehicle_type', oneOf: ['Passenger'] }],
    limit: 8,
};

export default function TeaserPie() {
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>(DATASET_URL);
    const chart = useMemo(() => [normalize(spec, fields)], [fields]);

    return <GraphicRenderer fields={fields} data={dataSource} chart={chart} appearance={theme} />;
}
