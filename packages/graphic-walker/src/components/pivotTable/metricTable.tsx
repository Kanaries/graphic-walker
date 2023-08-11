import React from 'react';
import { IField, IRow } from '../../interfaces';
import { getMeaAggKey } from '../../utils';

interface MetricTableProps {
    matrix: any[][];
    meaInRows: IField[];
    meaInColumns: IField[];
}

function getCellData (cell: IRow, measure: IField) {
    const meaKey = getMeaAggKey(measure.fid, measure.aggName);
    if (cell[meaKey] === undefined) {
        return '--';
    }
    return cell[meaKey];
}
const MetricTable: React.FC<MetricTableProps> = React.memo((props) => {
    const { matrix, meaInRows, meaInColumns } = props;
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
                                                    {getCellData(cell, rowMea)} , {getCellData(cell, colMea)}
                                                </td>
                                            ));
                                        }
                                        return (
                                            <td
                                                className="whitespace-nowrap p-2 text-xs"
                                                key={`${rIndex}-${cIndex}-${rowMea.fid}-${rowMea.aggName}`}
                                            >
                                                {getCellData(cell, rowMea)}
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
                                            getCellData(cell, colMea)
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
                                                { getCellData(cell, rowMea) } , { getCellData(cell, colMea) }
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
    if (JSON.stringify(prevProps.matrix) === JSON.stringify(nextProps.matrix)) {
        return true;
    }
    
    return false;
});

export default MetricTable;
