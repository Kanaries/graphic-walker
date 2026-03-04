import * as GW from '@kanaries/graphic-walker';
import { IViewField } from '@kanaries/graphic-walker';
import { IDataSource, useFetch } from '../util';
import { ComponentType } from 'react';

type PivotTableValueField = IViewField & {
    placement?: 'row' | 'column';
};

const rowDimensions: IViewField[] = [
    {
        fid: 'gender',
        name: 'gender',
        analyticType: 'dimension',
        semanticType: 'nominal',
    },
    {
        fid: 'race/ethnicity',
        name: 'race/ethnicity',
        analyticType: 'dimension',
        semanticType: 'nominal',
    },
];

const columnDimensions: IViewField[] = [
    {
        fid: 'test preparation course',
        name: 'test preparation course',
        analyticType: 'dimension',
        semanticType: 'nominal',
    },
];

const values: PivotTableValueField[] = [
    {
        fid: 'math score',
        name: 'math score',
        analyticType: 'measure',
        semanticType: 'quantitative',
        aggName: 'mean',
        placement: 'column',
    },
    {
        fid: 'reading score',
        name: 'reading score',
        analyticType: 'measure',
        semanticType: 'quantitative',
        aggName: 'mean',
        placement: 'column',
    },
    {
        fid: 'writing score',
        name: 'writing score',
        analyticType: 'measure',
        semanticType: 'quantitative',
        aggName: 'median',
        placement: 'column',
    },
];

export default function PivotTableComponent() {
    const { dataSource } = useFetch<IDataSource>('https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json');
    const PivotTable = (GW as unknown as { PivotTable?: ComponentType<any> }).PivotTable;

    if (!PivotTable) {
        return <div className="p-4">`PivotTable` export is not available in current build.</div>;
    }

    return (
        <div className="p-4">
            <PivotTable data={dataSource} rowDimensions={rowDimensions} columnDimensions={columnDimensions} values={values} numberFormat=".2f" />
        </div>
    );
}
