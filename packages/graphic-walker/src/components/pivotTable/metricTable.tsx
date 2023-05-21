import React from 'react';
import { IField, IRow } from '../../interfaces';
import { getMeaAggKey } from '../../utils';

interface MetricTableProps {
    matrix: any[][];
    measures: IField[];
}

function getCellData (cell: IRow, measure: IField) {
    const meaKey = getMeaAggKey(measure.fid, measure.aggName);
    if (cell[meaKey] === undefined) {
        return '--';
    }
    return cell[meaKey];
}
const MetricTable: React.FC<MetricTableProps> = (props) => {
    const { matrix, measures } = props;

    return (
        <tbody className="bg-white border-r border-b border-gray-300">
            {matrix.map((row, rIndex) => {
                return (
                    <tr className="divide-x divide-gray-200" key={rIndex}>
                        {row.flatMap((cell, cIndex) => {
                            cell = cell ?? {};
                            if (measures.length > 0) {
                                return measures.map((mea, meaIdx) => {
                                    return (
                                        <td
                                            className="whitespace-nowrap p-2 text-xs text-gray-500"
                                            key={`${rIndex}-${cIndex}-${meaIdx}`}
                                        >
                                            {getCellData(cell, mea)}
                                        </td>
                                    );
                                })
                            } else {
                                return (
                                    <td
                                        className="whitespace-nowrap p-2 text-xs text-gray-500"
                                        key={`${rIndex}-${cIndex}`}
                                    >
                                        --
                                    </td>
                                )
                            }
                        })}
                    </tr>
                );
            })}
        </tbody>
    );
};

export default MetricTable;
