import { useContext } from 'react';
import { themeContext } from '../context';
import { GraphicWalker } from '@kanaries/graphic-walker';
import { IDataSource, useFetch } from '../util';

export default function GraphicWalkerComponent() {
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>('https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json');
    return <GraphicWalker fields={fields} data={dataSource} appearance={theme} />;
}
