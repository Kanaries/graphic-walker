import React from 'react';
import { IField } from '../../interfaces';

interface MetricTableProps {
    matrix: any[][];
    meaInRows: IField[];
    meaInColumns: IField[];
}
const MetricTable: React.FC<MetricTableProps> = (props) => {
    const { matrix, meaInRows, meaInColumns } = props;

    return (
        <tbody className="bg-white border-r border-b border-gray-300">
            {matrix.map((row, rIndex) => {
                if (meaInRows.length !== 0) {
                    return meaInRows.map((rowMea, rmIndex) => {
                        return (
                            <tr className="divide-x divide-gray-200" key={`${rIndex}-${rowMea.fid}`}>
                                {
                                    row.flatMap((cell, cIndex) => {
                                        cell = cell ?? {};
                                        if (meaInColumns.length !== 0) {
                                            return meaInColumns.map((colMea, cmIndex) => (
                                                <td
                                                    className="whitespace-nowrap p-2 text-xs text-gray-500"
                                                    key={`${rIndex}-${cIndex}-${rowMea.fid}-${colMea.fid}-${colMea.fid}`}
                                                >
                                                    {cell[rowMea.fid] ?? '--'} , {cell[colMea.fid] ?? '--'}
                                                </td>
                                            ));
                                        }
                                        return (
                                            <td
                                                className="whitespace-nowrap p-2 text-xs text-gray-500"
                                                key={`${rIndex}-${cIndex}-${rowMea.fid}`}
                                            >
                                                {cell[rowMea.fid] ?? '--'}
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
                                        className="whitespace-nowrap p-2 text-xs text-gray-500"
                                        key={`${rIndex}-${cIndex}-${cmIndex}-${colMea.fid}`}
                                    >
                                        {cell[meaInColumns[cmIndex].fid] ?? '--'}
                                    </td>
                                ));
                            }else if (meaInRows.length === 0 && meaInColumns.length === 0) {
                                return (
                                    <td
                                        className="whitespace-nowrap p-2 text-xs text-gray-500"
                                        key={`${rIndex}-${cIndex}`}
                                    >
                                        {`${cell}`}
                                    </td>
                                );
                            } else {
                                return meaInRows.flatMap((rowMea, rmIndex) => (
                                    <td
                                        className="whitespace-nowrap p-2 text-xs text-gray-500"
                                        key={`${rIndex}-${cIndex}-${rmIndex}-${rowMea.fid}`}
                                    >
                                        {meaInColumns.flatMap((colMea, cmIndex) => (
                                            <td
                                                className="whitespace-nowrap p-2 text-xs text-gray-500"
                                                key={`${rIndex}-${cIndex}-${rmIndex}-${cmIndex}-${colMea.fid}`}
                                            >
                                                {cell[rowMea.fid] ?? '--'} , {cell[colMea.fid] ?? '--'}
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
};

export default MetricTable;
