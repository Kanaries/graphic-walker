import React, { useMemo } from 'react';
import PivotTableImpl from './components/pivotTable';
import { IFilterField, IRow, IViewField, IVisualConfigNew } from './interfaces';
import { emptyVisualLayout, initEncoding } from './utils/save';
import { useRenderer } from './renderer/hooks';
import { getComputation } from './computation/clientComputation';
import { getSort } from './utils';

export interface IPivotTableValueField extends IViewField {
    placement?: 'row' | 'column';
}

export interface IPivotTableProps {
    data: IRow[];
    rowDimensions?: IViewField[];
    columnDimensions?: IViewField[];
    values?: IPivotTableValueField[];
    numberFormat?: string;
    timezoneDisplayOffset?: number;
    className?: string;
    style?: React.CSSProperties;
}

function toViewField(field: IPivotTableValueField): IViewField {
    const { placement: _placement, ...viewField } = field;
    if (viewField.analyticType === 'measure' && !viewField.aggName) {
        return {
            ...viewField,
            aggName: 'sum',
        };
    }
    return viewField;
}

function getPivotFieldKey(field: IViewField): string {
    return [field.fid, field.aggName ?? '', field.sort ?? '', field.semanticType, field.analyticType].join(':');
}

const PivotTable: React.FC<IPivotTableProps> = ({
    data,
    rowDimensions = [],
    columnDimensions = [],
    values = [],
    numberFormat,
    timezoneDisplayOffset,
    className,
    style,
}) => {
    const [rowValues, columnValues] = useMemo<[IViewField[], IViewField[]]>(() => {
        const rowValues: IViewField[] = [];
        const columnValues: IViewField[] = [];
        values.forEach((field) => {
            if ((field.placement ?? 'column') === 'row') {
                rowValues.push(toViewField(field));
            } else {
                columnValues.push(toViewField(field));
            }
        });
        return [rowValues, columnValues];
    }, [values]);

    const rows = useMemo(() => [...rowDimensions, ...rowValues], [rowDimensions, rowValues]);
    const columns = useMemo(() => [...columnDimensions, ...columnValues], [columnDimensions, columnValues]);

    const dimensions = useMemo(() => [...rows, ...columns].filter((field) => field.analyticType === 'dimension'), [rows, columns]);
    const measures = useMemo(() => [...rows, ...columns].filter((field) => field.analyticType === 'measure'), [rows, columns]);

    const draggableFieldState = useMemo(
        () => ({
            ...initEncoding(),
            dimensions,
            measures,
            rows,
            columns,
        }),
        [dimensions, measures, rows, columns]
    );

    const allFields = useMemo(() => {
        const map = new Map<string, IViewField>();
        [...dimensions, ...measures].forEach((field) => {
            map.set(getPivotFieldKey(field), field);
        });
        return [...map.values()];
    }, [dimensions, measures]);

    const computation = useMemo(() => getComputation(data), [data]);
    const sort = useMemo(() => getSort({ rows, columns }), [rows, columns]);
    const filters = useMemo<IFilterField[]>(() => [], []);

    const { viewData } = useRenderer({
        allFields,
        viewDimensions: dimensions,
        viewMeasures: measures,
        filters,
        defaultAggregated: true,
        sort,
        limit: -1,
        computationFunction: computation,
        timezoneDisplayOffset,
    });

    const visualConfig = useMemo<IVisualConfigNew>(
        () => ({
            defaultAggregated: true,
            geoms: ['table'],
            limit: -1,
            timezoneDisplayOffset,
        }),
        [timezoneDisplayOffset]
    );

    const layout = useMemo(
        () => ({
            ...emptyVisualLayout,
            showTableSummary: false,
            format: {
                ...emptyVisualLayout.format,
                numberFormat,
            },
        }),
        [numberFormat]
    );

    const pivotTableKey = useMemo(
        () =>
            `${rows.map(getPivotFieldKey).join('|')}::${columns.map(getPivotFieldKey).join('|')}::${timezoneDisplayOffset ?? ''}::${numberFormat ?? ''}`,
        [rows, columns, timezoneDisplayOffset, numberFormat]
    );

    return (
        <div className={className} style={style}>
            <PivotTableImpl
                key={pivotTableKey}
                data={viewData}
                draggableFieldState={draggableFieldState}
                visualConfig={visualConfig}
                layout={layout}
                disableCollapse={true}
            />
        </div>
    );
};

export default PivotTable;
