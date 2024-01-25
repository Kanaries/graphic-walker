import React from 'react';
import { useMemo } from "react";
import { IField, IRow, IVisualConfig } from '../../interfaces';
import { getMeaAggKey } from '../../utils';
import { format } from "d3-format";

interface MetricTableProps {
    matrix: any[][];
    meaInRows: IField[];
    meaInColumns: IField[];
    numberFormat: string;
}

function getCellData (cell: IRow, measure: IField, formatter: (value: unknown) => string) {

    const meaKey = getMeaAggKey(measure.fid, measure.aggName);
    if (cell[meaKey] === undefined) {
        return '--';
    }
    const formattedValue = formatter(cell[meaKey]);
    return formattedValue;
}

const MetricTable: React.FC<MetricTableProps> = React.memo((props) => {
    const { matrix, meaInRows, meaInColumns, numberFormat } = props;

    const numberFormatter = useMemo<(value: unknown) => string>(() => {
        const numberFormatter = numberFormat ? format(numberFormat) : (v: number) => v.toLocaleString();
        return (value: unknown) => {
            if (typeof value !== "number") {
                return `${value}`;
            }
            return numberFormatter(value);
        };
    }, [numberFormat]);

    return (
        <tbody className="bg-white dark:bg-black text-gray-800 dark:text-gray-100 border-r border-b border-gray-300">
            {matrix.map((row, rIndex) => {
                if (meaInRows.length !== 0) {
                    return meaInRows.map((rowMea, rmIndex) => {
                        return (
                            <tr className="divide-x divide-gray-200" key={`${rIndex}-${rowMea.fid}-${rowMea.aggName}`}>
                                {
                                    row.flatMap((cell, cIndex) => {
                                        cell = cell ?? {};
                                        if (meaInColumns.length !== 0) {
                                            return meaInColumns.map((colMea, cmIndex) => (
                                                <td
                                                    className="whitespace-nowrap p-2 text-xs"
                                                    key={`${rIndex}-${cIndex}-${rowMea.fid}-${rowMea.aggName}-${colMea.fid}-${colMea.aggName}`}
                                                >
                                                    {getCellData(cell, rowMea, numberFormatter)} , {getCellData(cell, colMea, numberFormatter)}
                                                </td>
                                            ));
                                        }
                                        return (
                                            <td
                                                className="whitespace-nowrap p-2 text-xs"
                                                key={`${rIndex}-${cIndex}-${rowMea.fid}-${rowMea.aggName}`}
                                            >
                                                {getCellData(cell, rowMea, numberFormatter)}
                                            </td>
                                        );
                                    })
                                }
                            </tr>
                        );
                    });
                }
                return (
                    <tr className="divide-x divide-gray-200" key={rIndex}>
                        {row.flatMap((cell, cIndex) => {
                            cell = cell ?? {};
                            if (meaInRows.length === 0 && meaInColumns.length !== 0) {
                                return meaInColumns.map((colMea, cmIndex) => (
                                    <td
                                        className="whitespace-nowrap p-2 text-xs"
                                        key={`${rIndex}-${cIndex}-${cmIndex}-${colMea.fid}-${colMea.aggName}`}
                                    >
                                        {
                                            getCellData(cell, colMea, numberFormatter)
                                        }
                                    </td>
                                ));
                            }else if (meaInRows.length === 0 && meaInColumns.length === 0) {
                                return (
                                    <td
                                        className="whitespace-nowrap p-2 text-xs"
                                        key={`${rIndex}-${cIndex}`}
                                    >
                                        {`True`}
                                    </td>
                                );
                            } else {
                                return meaInRows.flatMap((rowMea, rmIndex) => (
                                    <td
                                        className="whitespace-nowrap p-2 text-xs"
                                        key={`${rIndex}-${cIndex}-${rmIndex}-${rowMea.fid}-${rowMea.aggName}`}
                                    >
                                        {meaInColumns.flatMap((colMea, cmIndex) => (
                                            <td
                                                className="whitespace-nowrap p-2 text-xs"
                                                key={`${rIndex}-${cIndex}-${rmIndex}-${cmIndex}-${colMea.fid}-${colMea.aggName}`}
                                            >
                                                { getCellData(cell, rowMea, numberFormatter) } , { getCellData(cell, colMea, numberFormatter) }
                                            </td>
                                        ))}
                                    </td>
                                ));
                            }
                            // return measures.map((mea) => (
                            //     <td className='whitespace-nowrap p-2 text-xs text-gray-500' key={`${rIndex}-${cIndex}-${mea.fid}`}>{cell[mea.fid] ?? '--'}</td>
                            // ));
                        })}
                    </tr>
                );
            })}
        </tbody>
    );
}, function areEqual(prevProps, nextProps) {
    if (JSON.stringify(prevProps.matrix) === JSON.stringify(nextProps.matrix) && prevProps.numberFormat === nextProps.numberFormat) {
        return true;
    }
    
    return false;
});

export default MetricTable;
