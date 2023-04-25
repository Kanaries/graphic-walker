import React, { ReactElement, ReactNode, useMemo } from 'react';
import { INestNode } from './inteface';
import { IField } from '../../interfaces';
import { nanoid } from 'nanoid';
import { getAllChildrenSize } from './utils';

/**
 * render pivot table left tree table
 * @param node
 * @param dimsInRow
 * @param depth
 * @param cellRows
 * @returns
 */
function renderTree(node: INestNode, dimsInRow: IField[], depth: number, cellRows: ReactNode[][], rIndex: number): number {
    if (depth === dimsInRow.length) {
        cellRows.push([
            <td
                key={nanoid()}
                className="whitespace-nowrap p-2 text-xs text-gray-500"
                colSpan={1}
                rowSpan={1}
            >
                {node.value}
            </td>,
        ])
        return 1;
    }
    for (const child of node.children) {
        const rpos = renderTree(child, dimsInRow, depth + 1, cellRows, rIndex);
        
    }

}

export interface TreeProps {
    data: INestNode;
    dimsInRow: IField[];
}
const LeftTree: React.FC<TreeProps> = (props) => {
    const { data, dimsInRow } = props;
    const nodeCells: ReactNode[] = useMemo(() => {
        const cellRows: ReactNode[][] = [];
        renderTree(data, dimsInRow, 0, cellRows);
        return cellRows;
    }, [data, dimsInRow]);
    return (
        <div>
            <thead>
                {nodeCells.map((row, rIndex) => (
                    <tr key={rIndex}>{row}</tr>
                ))}
            </thead>
        </div>
    );
};

export default LeftTree;
