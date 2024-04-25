import { useContext } from 'react';
import spec from '../specs/student-chart.json';
import spec2 from '../specs/student-chart-filter.json';

import { Chart, ComputationProvider, IAggregator, IChart, SelectFilter, useAggergateValue } from '@kanaries/graphic-walker';
import { themeContext } from '../context';
import { useFetch, IDataSource } from '../util';

function StatCard(props: { title: string; fid: string; agg: IAggregator }) {
    const data = useAggergateValue(props.fid, props.agg);
    return (
        <div className="rounded-xl border bg-card text-card-foreground shadow">
            <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="text-sm font-medium leading-none tracking-tight">{props.title}</div>
            </div>
            <div className="p-6 pt-0">
                <div className="text-2xl font-bold">{data}</div>
            </div>
        </div>
    );
}

export default function GraphicWalkerComponent() {
    const { theme } = useContext(themeContext);
    const { dataSource } = useFetch<IDataSource>('https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json');

    return (
        <ComputationProvider data={dataSource}>
            <div className="flex flex-col gap-2 p-2">
                <div className="w-full flex justify-end">
                    <div className="w-[300px]">
                        <SelectFilter fid="race/ethnicity" name="race/ethnicity" />
                    </div>
                    <div className="w-[300px]">
                        <SelectFilter fid="parental level of education" name="parental level of education" />
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <StatCard agg="mean" fid="math score" title="Mean Math score" />
                    <StatCard agg="mean" fid="reading score" title="Mean Reading score" />
                    <StatCard agg="mean" fid="writing score" title="Mean Writing score" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border bg-card text-card-foreground shadow">
                        <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="font-medium leading-none tracking-tight">Scores by gender</div>
                        </div>
                        <div className="h-96 p-2">
                            <Chart overrideSize={{ mode: 'full', height: 1, width: 1 }} chart={spec[0] as IChart} appearance={theme} />
                        </div>
                    </div>
                    <div className="rounded-xl border bg-card text-card-foreground shadow">
                        <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="font-medium leading-none tracking-tight">Score by group and lunch</div>
                        </div>
                        <div className="h-96 p-2">
                            <Chart overrideSize={{ mode: 'full', height: 1, width: 1 }} chart={spec2[0] as IChart} appearance={theme} />
                        </div>
                    </div>
                </div>
            </div>
        </ComputationProvider>
    );
}
