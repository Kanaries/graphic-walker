import { useContext, useMemo } from 'react';
import { TableWalker, getComputation } from '@kanaries/graphic-walker';
import { themeContext } from '../context';
import { useFetch, IDataSource } from '../util';

export default function GraphicWalkerComponent() {
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>('https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json');

    const computation = getComputation(dataSource);

    const droped = useMemo(() => {
        const data = dataSource.map((x) => ({ ...x, randomValue: Math.random() }));
        return data.filter((x) => x.randomValue > 0.5).map((x) => ({ ...x, randomValue: undefined }));
    }, [dataSource]);
    const computation2 = getComputation(droped);

    return (
        <TableWalker
            fields={fields}
            data={dataSource}
            cellStyle={(v, field, row, darkMode) => {
                if (field.fid.endsWith('_cleaned') && `${v}` !== `${row[field.fid.replace('_cleaned', '')]}`) {
                    return { backgroundColor: darkMode ? '#a16207' : '#fef9c3' };
                }
                if (v === 'none') return { backgroundColor: darkMode ? '#a16207' : '#fef9c3' };
                return {};
            }}
            profilingComputation={[computation, computation2]}
            appearance={theme}
            pageSize={50}
        />
    );
}
