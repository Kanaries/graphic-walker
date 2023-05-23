import React, { ReactNode, useMemo } from 'react';
import { INestNode } from './inteface';
import { IField } from '../../interfaces';

function getChildCount(node: INestNode): number {
    if (node.children.length === 0) {
        return 1;
    }
    return node.children.map(getChildCount).reduce((a, b) => a + b, 0);
}

/**
 * render pivot table left tree table
 * @param node
 * @param dimsInRow
 * @param depth
 * @param cellRows
 * @returns
 */
function renderTree(node: INestNode, dimsInRow: IField[], depth: number, cellRows: ReactNode[][], meaNumber: number) {
    const childrenSize = getChildCount(node);
    if (depth > dimsInRow.length) {
        return;
    }
    cellRows[cellRows.length - 1].push(
        <td
            key={`${depth}-${node.fieldKey}-${node.value}`}
            className="bg-white dark:bg-zinc-800 whitespace-nowrap p-2 text-xs text-gray-500 dark:text-white m-1 border border-gray-300"
            rowSpan={childrenSize * Math.max(meaNumber, 1)}
        >
            {node.value}
        </td>
    );
    for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        renderTree(child, dimsInRow, depth + 1, cellRows, meaNumber);
        if (i < node.children.length - 1) {
            cellRows.push([]);
        }
    }
}

export interface TreeProps {
    data: INestNode;
    dimsInRow: IField[];
}
const LeftTree: React.FC<TreeProps> = (props) => {
    const { data, dimsInRow } = props;
    const nodeCells: ReactNode[] = useMemo(() => {
        const cellRows: ReactNode[][] = [[]];
        renderTree(data, dimsInRow, 0, cellRows, 0);
        cellRows[0].shift();
        return cellRows;
    }, [data, dimsInRow]);
    return (
        <thead className="bg-gray-50 border border-gray-300 border border-gray-300">
            {nodeCells.map((row, rIndex) => (
                <tr className="border border-gray-300" key={rIndex}>
                    {row}
                </tr>
            ))}
        </thead>
    );
};

export default LeftTree;
