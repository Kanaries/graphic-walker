import { useContext, useMemo } from 'react';
import { themeContext } from '../context';
import { GraphicRenderer, normalize } from '@kanaries/graphic-walker';
import type { TerseSpec } from '@kanaries/graphic-walker';
import { useFetch, IDataSource } from '../util';

const DATASET_URL = '/datasets/ds-titanic-service.json';

const spec: TerseSpec = {
    mark: 'bar',
    x: 'Pclass',
    y: 'count()',
    color: 'Survived',
    stack: 'normalize',
    filters: [{ field: 'Embarked', notIn: [''] }],
};

export default function TeaserStackedBar() {
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>(DATASET_URL);
    const chart = useMemo(() => [normalize(spec, fields)], [fields]);

    return <GraphicRenderer fields={fields} data={dataSource} chart={chart} appearance={theme} />;
}
