import { useContext, useEffect, useRef } from 'react';
import spec from '../specs/student-chart-filter.json';
import { FilterWalker, VizSpecStore } from '@kanaries/graphic-walker';
import { themeContext } from '../context';
import { useFetch, IDataSource } from '../util';

export default function GraphicWalkerComponent() {
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>('https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json');
    const ref = useRef<VizSpecStore>(null);

    useEffect(() => {
        setTimeout(() => {
            if (ref.current) {
                ref.current.importCode(spec as never);
            }
        }, 0);
    }, []);
    return <FilterWalker rawFields={fields} dataSource={dataSource} dark={theme} storeRef={ref} />;
}
