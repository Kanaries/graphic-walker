import React, { useMemo, useState, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import styled from "styled-components";
import { DataSet, IMutField, IRow } from "../../interfaces";
import { useTranslation } from "react-i18next";
import { useGlobalStore } from "../../store";
import LoadingLayer from "../loadingLayer";
import Pagination from "./pagination";
import { ChevronUpDownIcon } from "@heroicons/react/24/outline";
import DropdownContext from "../dropdownContext";

interface DataTableProps {
    /** page limit */
    size?: number;
    /** total count of rows */
    total: number;
    dataset: DataSet;
    /**
     * @default false
     * Enable this option will extract data from `dataset.dataSource`.
     * This is useful when you want to preview a temporary table.
     */
    inMemory?: boolean;
    onMetaChange: (fid: string, fIndex: number, meta: Partial<IMutField>) => void;
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
const ANALYTIC_TYPE_LIST = ["dimension", "measure"];
const SEMANTIC_TYPE_LIST = ["nominal", "ordinal", "quantitative", "temporal"];
// function getCellType(field: IMutField): 'number' | 'text' {
//     return field.dataType === 'number' || field.dataType === 'integer' ? 'number' : 'text';
// }
function getHeaderType(field: IMutField): "number" | "text" {
    return field.analyticType === "dimension" ? "text" : "number";
}

function getHeaderClassNames(field: IMutField) {
    return field.analyticType === "dimension" ? "border-t-4 border-blue-400" : "border-t-4 border-purple-400";
}

function getSemanticColors(field: IMutField): string {
    switch (field.semanticType) {
        case "nominal":
            return "border border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100 dark:border-sky-600";
        case "ordinal":
            return "border border-transparent bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100 dark:border-indigo-600";
        case "quantitative":
            return "border border-transparent bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 dark:border-purple-600";
        case "temporal":
            return "border border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 dark:border-yellow-600";
        default:
            return "border border-transparent bg-gray-400";
    }
}

const DataTable: React.FC<DataTableProps> = (props) => {
    const { size = 10, onMetaChange, dataset, total, inMemory = false } = props;
    const [pageIndex, setPageIndex] = useState(0);
    const { t } = useTranslation();
    const { vizStore } = useGlobalStore();
    const { dataLoader } = vizStore;

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
    const to = Math.min((pageIndex + 1) * size, total - 1);

    const [rows, setRows] = useState<IRow[]>([]);
    const [loading, setLoading] = useState(false);

    const columnsRef = useRef(dataset.rawFields);
    columnsRef.current = dataset.rawFields;

    useEffect(() => {
        if (inMemory) {
            setRows(dataset.dataSource.slice(from, to));
            return;
        }
        // switch all
        let isCurrent = true;
        const task = dataLoader.preview({
            datasetId: dataset.id,
            pageSize: size,
            pageIndex,
        }, {
            dataset,
            columns: columnsRef.current,
        });
        setLoading(true);
        task.then(d => {
            if (isCurrent) {
                setRows(d);
            }
        }).catch(reason => {
            console.error(reason);
            if (isCurrent) {
                setRows([]);
            }
        }).finally(() => {
            if (isCurrent) {
                setLoading(false);
            }
        });
        return () => {
            isCurrent = false;
            setLoading(false);
        };
    }, [dataset, dataLoader, size, pageIndex, inMemory]);

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
                    <tr className="divide-x divide-gray-200 dark:divide-gray-700">
                        {dataset.rawFields.map((field, fIndex) => (
                            <th key={field.fid} className={""}>
                                <div
                                    className={
                                        getHeaderClassNames(field) +
                                        " whitespace-nowrap py-3.5 px-6 text-left text-xs font-semibold text-gray-900 dark:text-gray-50 sm:pl-6"
                                    }
                                >
                                    <b>{field.name || field.fid}</b>
                                    <div>
                                        <DropdownContext
                                            options={analyticTypeList}
                                            onSelect={(value) => {
                                                onMetaChange(field.fid, fIndex, {
                                                    analyticType: value as IMutField["analyticType"],
                                                });
                                            }}
                                        >
                                            <span
                                                className={
                                                    "cursor-pointer inline-flex px-2.5 py-0.5 text-xs font-medium mt-1 rounded-full text-xs text-white " +
                                                    (field.analyticType === "dimension" ? "bg-blue-500" : "bg-purple-500")
                                                }
                                            >
                                                {field.analyticType}
                                                <ChevronUpDownIcon className="ml-2 w-3" />
                                            </span>
                                        </DropdownContext>
                                    </div>
                                    <div>
                                        <DropdownContext
                                            options={semanticTypeList}
                                            onSelect={(value) => {
                                                onMetaChange(field.fid, fIndex, {
                                                    semanticType: value as IMutField["semanticType"],
                                                });
                                            }}
                                        >
                                            <span
                                                className={
                                                    "cursor-pointer inline-flex px-2.5 py-0.5 text-xs font-medium mt-1 rounded-full text-xs " +
                                                    getSemanticColors(field)
                                                }
                                            >
                                                {field.semanticType}
                                                <ChevronUpDownIcon className="ml-2 w-3" />
                                            </span>
                                        </DropdownContext>
                                    </div>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-zinc-900">
                    {rows.map((row, index) => (
                        <tr className={"divide-x divide-gray-200 dark:divide-gray-700 " + (index % 2 ? "bg-gray-50 dark:bg-gray-900" : "")} key={index}>
                            {dataset.rawFields.map((field) => (
                                <td
                                    key={field.fid + index}
                                    className={
                                        getHeaderType(field) +
                                        " whitespace-nowrap py-2 pl-4 pr-3 text-xs text-gray-500 dark:text-gray-300 sm:pl-6"
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
