import React from 'react';
import { IField } from '../../interfaces';

interface MetricTableProps {
    matrix: any[][];
    measures: IField[];
}
const MetricTable: React.FC<MetricTableProps> = (props) => {
    const { matrix, measures } = props;
    // console.log(props)
    return (
        <tbody className="divide-y divide-gray-200 bg-white ">
            {matrix.map((row, rIndex) => {
                return (
                    <tr className="divide-x divide-gray-200" key={rIndex}>
                        {row.flatMap((cell, cIndex) => {
                            return measures.map((mea) => (
                                <td className='whitespace-nowrap p-2 text-xs text-gray-500' key={`${rIndex}-${cIndex}-${mea.fid}`}>{cell[mea.fid] ?? '--'}</td>
                            ));
                        })}
                    </tr>
                );
            })}
        </tbody>
    );
};

export default MetricTable;
