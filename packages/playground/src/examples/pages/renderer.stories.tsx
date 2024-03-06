import { useContext } from 'react';
import spec from '../specs/student-chart-filter.json';
import { GraphicRenderer, IChart } from '@kanaries/graphic-walker';
import { themeContext } from '../context';
import { useFetch, IDataSource } from '../util';

export default function GraphicWalkerComponent() {
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>('https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json');

    return <GraphicRenderer rawFields={fields} chart={spec as IChart[]} dataSource={dataSource} dark={theme} />;
}
