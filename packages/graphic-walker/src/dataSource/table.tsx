import React, { useMemo } from "react";
import styled from "styled-components";
import { observer } from "mobx-react-lite";
import { IMutField } from "../interfaces";
import { useGlobalStore } from "../store";
import { useTranslation } from "react-i18next";

interface TableProps {
    size?: number;
}
const Container = styled.div`
    overflow-x: auto;
    table {
        box-sizing: content-box;
        border-collapse: collapse;
        font-size: 12px;
        thead {
            th {
            }
            th.number {
                border-top: 3px solid #5cdbd3;
            }
            th.text {
                border-top: 3px solid #69c0ff;
            }
        }
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
const TYPE_LIST = [
    {
        value: "dimension",
        label: "维度",
    },
    {
        value: "measure",
        label: "度量",
    },
];
// function getCellType(field: IMutField): 'number' | 'text' {
//     return field.dataType === 'number' || field.dataType === 'integer' ? 'number' : 'text';
// }
function getHeaderType(field: IMutField): "number" | "text" {
    return field.analyticType === "dimension" ? "text" : "number";
}

function getHeaderClassNames(field: IMutField) {
    return field.analyticType === "dimension" ? "border-t-4 border-blue-400" : "border-t-4 border-teal-400";
}

function getSemanticColors(field: IMutField): string {
    switch (field.semanticType) {
        case "nominal":
            return "bg-indigo-100 text-indigo-800";
        case "ordinal":
            return "bg-purple-100 text-purple-800"
        case "quantitative":
            return "bg-green-100 text-green-800"
        case "temporal":
            return "bg-yellow-100 text-yellow-800"
        default:
            return "bg-gray-400";
    }
}

const Table: React.FC<TableProps> = (props) => {
    const { size = 10 } = props;
    const { commonStore } = useGlobalStore();
    const { tmpDSRawFields, tmpDataSource } = commonStore;
    const { t } = useTranslation();

    const analyticTypeList = useMemo<{ value: string; label: string }[]>(() => {
        return TYPE_LIST.map((at) => ({
            value: at.value,
            label: t(`constant.analytic_type.${at.value}`),
        }));
    }, []);

    return (
        <Container className="rounded border-gray-200 border">
            <table className="min-w-full divide-y divide-gray-30">
                <thead className="bg-gray-50">
                    <tr className="divide-x divide-gray-200">
                        {tmpDSRawFields.map((field, fIndex) => (
                            <th key={field.fid} className={""}>
                                <div
                                    className={
                                        getHeaderClassNames(field) +
                                        " whitespace-nowrap py-3.5 px-6 text-left text-xs font-semibold text-gray-900 sm:pl-6"
                                    }
                                >
                                    <b>{field.name || field.fid}</b>
                                    <div>
                                        <select
                                            className={
                                                "px-2 py font-normal mt-2 rounded-full text-xs text-white " +
                                                (field.analyticType === "dimension" ? "bg-blue-500" : "bg-teal-500")
                                            }
                                            // className="border-b border-gray-200 bg-gray-50 pl-0 mt-2 font-light"
                                            value={field.analyticType}
                                            onChange={(e) => {
                                                commonStore.updateTempFieldAnalyticType(
                                                    field.fid,
                                                    e.target.value as IMutField["analyticType"]
                                                );
                                            }}
                                        >
                                            {analyticTypeList.map((type) => (
                                                <option key={type.value} value={type.value}>
                                                    {type.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div
                                        className={
                                            "inline-block px-2.5 py-0.5 text-xs font-medium mt-1 rounded-full text-xs text-white " +
                                            getSemanticColors(field)
                                        }
                                    >
                                        {field.semanticType}
                                    </div>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                    {tmpDataSource.slice(0, size).map((record, index) => (
                        <tr className={"divide-x divide-gray-200 " + (index % 2 ? "bg-gray-50" : "")} key={index}>
                            {tmpDSRawFields.map((field) => (
                                <td
                                    key={field.fid + index}
                                    className={
                                        getHeaderType(field) +
                                        " whitespace-nowrap py-2 pl-4 pr-3 text-xs text-gray-500 sm:pl-6"
                                    }
                                >
                                    {record[field.fid]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </Container>
    );
};

export default observer(Table);
