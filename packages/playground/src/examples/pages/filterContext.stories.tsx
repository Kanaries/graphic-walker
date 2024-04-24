import { useContext } from 'react';
import spec from '../specs/student-chart.json';
import spec2 from '../specs/student-chart-filter.json';

import { Chart, ComputationProvider, IChart, SelectFilter } from '@kanaries/graphic-walker';
import { themeContext } from '../context';
import { useFetch, IDataSource } from '../util';

export default function GraphicWalkerComponent() {
    const { theme } = useContext(themeContext);
    const { dataSource } = useFetch<IDataSource>('https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json');

    return (
        <ComputationProvider data={dataSource}>
            <div className="flex flex-col gap-2">
                <div className="w-full flex justify-end">
                    <div className="w-[300px]">
                        <SelectFilter fid="parental level of education" name="parental level of education" />
                    </div>
                </div>
                <Chart chart={spec[0] as IChart} appearance={theme} />
                <Chart chart={spec2[0] as IChart} appearance={theme} />
            </div>
        </ComputationProvider>
    );
}
