import React, { useMemo, useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import type { IMutField, IRow, DataSet, IComputationFunction } from '../../interfaces';
import { useTranslation } from 'react-i18next';
import LoadingLayer from "../loadingLayer";
import { useComputationFunc } from "../../renderer/hooks";
import { dataReadRawServer } from "../../computation/serverComputation";
import Pagination from './pagination';
import { ChevronUpDownIcon } from '@heroicons/react/24/outline';
import DropdownContext from '../dropdownContext';

interface DataTableProps {
    /** page limit */
    size?: number;
    /** total count of rows */
    total: number;
    dataset: DataSet;
    computation?: IComputationFunction;
    onMetaChange: (fid: string, fIndex: number, meta: Partial<IMutField>) => void;
    loading?: boolean;
}
const Container = styled.div`
    overflow-x: auto;
    max-height: 660px;
    overflow-y: auto;
    table {
        box-sizing: content-box;
        border-collapse: collapse;
        font-size: 12px;
        tbody {
            td {
            }
            td.number {
                text-align: right;
            }
            td.text {
                text-align: left;
            }
        }
    }
`;
const ANALYTIC_TYPE_LIST = ['dimension', 'measure'];
const SEMANTIC_TYPE_LIST = ['nominal', 'ordinal', 'quantitative', 'temporal'];
// function getCellType(field: IMutField): 'number' | 'text' {
//     return field.dataType === 'number' || field.dataType === 'integer' ? 'number' : 'text';
// }
function getHeaderType(field: IMutField): 'number' | 'text' {
    return field.analyticType === 'dimension' ? 'text' : 'number';
}

function getHeaderClassNames(field: IMutField) {
    return field.analyticType === 'dimension' ? 'border-t-4 border-blue-400' : 'border-t-4 border-purple-400';
}

function getSemanticColors(field: IMutField): string {
    switch (field.semanticType) {
        case 'nominal':
            return 'border border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100 dark:border-sky-600';
        case 'ordinal':
            return 'border border-transparent bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100 dark:border-indigo-600';
        case 'quantitative':
            return 'border border-transparent bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 dark:border-purple-600';
        case 'temporal':
            return 'border border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 dark:border-yellow-600';
        default:
            return 'border border-transparent bg-gray-400';
    }
}

type wrapMutField = {
    colSpan: number;
    rowSpan: number;
} & (
    | { type: 'field'; value: IMutField; fIndex: number }
    | {
          type: 'name';
          value: string;
      }
);

const getHeaders = (metas: IMutField[]): wrapMutField[][] => {
    const height = metas.map((x) => x.path?.length ?? 1).reduce((a, b) => Math.max(a, b), 0);
    const result: wrapMutField[][] = [...Array(height)].map(() => []);
    let now = 1;
    metas.forEach((x, fIndex) => {
        const path = x.path ?? [x.name ?? x.fid];
        if (path.length > now) {
            for (let i = now - 1; i < path.length - 1; i++) {
                result[i].push({
                    colSpan: 0,
                    rowSpan: 1,
                    type: 'name',
                    value: path[i],
                });
            }
        }
        now = path.length;
        for (let i = 0; i < path.length - 1; i++) {
            result[i][result[i].length - 1].colSpan++;
        }
        result[path.length - 1].push({
            type: 'field',
            value: x,
            colSpan: 1,
            rowSpan: height - path.length + 1,
            fIndex,
        });
    });
    return result;
};

const getHeaderKey = (f: wrapMutField) => {
    if (f.type === 'name') {
        return f.value;
    }
    return f.value.name ?? f.value.fid;
};

const DataTable: React.FC<DataTableProps> = (props) => {
    const { size = 10, onMetaChange, dataset, computation, total, loading: statLoading } = props;
    const [pageIndex, setPageIndex] = useState(0);
    const { t } = useTranslation();
    const defaultComputation = useComputationFunc();
    const computationFunction = computation ?? defaultComputation;

    const analyticTypeList = useMemo<{ value: string; label: string }[]>(() => {
        return ANALYTIC_TYPE_LIST.map((at) => ({
            value: at,
            label: t(`constant.analytic_type.${at}`),
        }));
    }, []);

    const semanticTypeList = useMemo<{ value: string; label: string }[]>(() => {
        return SEMANTIC_TYPE_LIST.map((st) => ({
            value: st,
            label: t(`constant.semantic_type.${st}`),
        }));
    }, []);

    const from = pageIndex * size;
    const to = Math.min((pageIndex + 1) * size - 1, total - 1);

    const [rows, setRows] = useState<IRow[]>([]);
    const [dataLoading, setDataLoading] = useState(false);
    const taskIdRef = useRef(0);

    useEffect(() => {
        if (statLoading) {
            return;
        }
        setDataLoading(true);
        const taskId = ++taskIdRef.current;
        dataReadRawServer(computationFunction, size, pageIndex).then(data => {
            if (taskId === taskIdRef.current) {
                setDataLoading(false);
                setRows(data);
            }
        }).catch(err => {
            if (taskId === taskIdRef.current) {
                console.error(err);
                setDataLoading(false);
                setRows([]);
            }
        });
        return () => {
            taskIdRef.current++;
        };
    }, [computationFunction, pageIndex, size]);

    const loading = statLoading || dataLoading;

    const metas = dataset.rawFields;

    const headers = useMemo(() => getHeaders(metas), [metas]);

    return (
        <Container className="rounded border-gray-200 dark:border-gray-700 border relative">
            <Pagination
                total={total}
                from={from + 1}
                to={to + 1}
                onNext={() => {
                    setPageIndex(Math.min(Math.ceil(total / size) - 1, pageIndex + 1));
                }}
                onPrev={() => {
                    setPageIndex(Math.max(0, pageIndex - 1));
                }}
            />
            <table className="min-w-full divide-y">
                <thead className="bg-gray-50 dark:bg-gray-900">
                    {headers.map((row) => (
                        <tr
                            className="divide-x divide-gray-200 dark:divide-gray-700"
                            key={`row_${getHeaderKey(row[0])}`}
                        >
                            {row.map((f) => (
                                <th
                                    colSpan={f.colSpan}
                                    rowSpan={f.rowSpan}
                                    key={getHeaderKey(f)}
                                    className={'align-top'}
                                >
                                    {f.type === 'name' && (
                                        <div
                                            className={
                                                'border-t-4 border-yellow-400 whitespace-nowrap py-3.5 text-left text-xs font-semibold text-gray-900 dark:text-gray-50'
                                            }
                                        >
                                            <b className="sticky inset-x-0 w-fit px-6 sm:pl-6">{f.value}</b>
                                        </div>
                                    )}
                                    {f.type === 'field' && (
                                        <div
                                            className={
                                                getHeaderClassNames(f.value) +
                                                ' whitespace-nowrap py-3.5 px-6 text-left text-xs font-semibold text-gray-900 dark:text-gray-50 sm:pl-6'
                                            }
                                        >
                                            <b>{f.value.basename || f.value.name || f.value.fid}</b>
                                            <div>
                                                <DropdownContext
                                                    options={analyticTypeList}
                                                    onSelect={(value) => {
                                                        onMetaChange(f.value.fid, f.fIndex, {
                                                            analyticType: value as IMutField['analyticType'],
                                                        });
                                                    }}
                                                >
                                                    <span
                                                        className={
                                                            'cursor-pointer inline-flex px-2.5 py-0.5 text-xs font-medium mt-1 rounded-full text-xs text-white ' +
                                                            (f.value.analyticType === 'dimension'
                                                                ? 'bg-blue-500'
                                                                : 'bg-purple-500')
                                                        }
                                                    >
                                                        {f.value.analyticType}
                                                        <ChevronUpDownIcon className="ml-2 w-3" />
                                                    </span>
                                                </DropdownContext>
                                            </div>
                                            <div>
                                                <DropdownContext
                                                    options={semanticTypeList}
                                                    onSelect={(value) => {
                                                        onMetaChange(f.value.fid, f.fIndex, {
                                                            semanticType: value as IMutField['semanticType'],
                                                        });
                                                    }}
                                                >
                                                    <span
                                                        className={
                                                            'cursor-pointer inline-flex px-2.5 py-0.5 text-xs font-medium mt-1 rounded-full text-xs ' +
                                                            getSemanticColors(f.value)
                                                        }
                                                    >
                                                        {f.value.semanticType}
                                                        <ChevronUpDownIcon className="ml-2 w-3" />
                                                    </span>
                                                </DropdownContext>
                                            </div>
                                        </div>
                                    )}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-zinc-900">
                    {rows.map((row, index) => (
                        <tr
                            className={
                                'divide-x divide-gray-200 dark:divide-gray-700 ' +
                                (index % 2 ? 'bg-gray-50 dark:bg-gray-900' : '')
                            }
                            key={index}
                        >
                            {metas.map((field) => (
                                <td
                                    key={field.fid + index}
                                    className={
                                        getHeaderType(field) +
                                        ' whitespace-nowrap py-2 pl-4 pr-3 text-xs text-gray-500 dark:text-gray-300 sm:pl-6'
                                    }
                                >
                                    {`${row[field.fid]}`}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {loading && <LoadingLayer />}
        </Container>
    );
};

export default observer(DataTable);
