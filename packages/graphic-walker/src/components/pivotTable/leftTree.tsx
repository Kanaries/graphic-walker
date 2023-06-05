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
            className="whitespace-nowrap p-2 text-xs text-gray-500 m-1 border border-gray-300"
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
    measInRow: IField[];
}
const LeftTree: React.FC<TreeProps> = (props) => {
    const { data, dimsInRow, measInRow } = props;
    const nodeCells: ReactNode[] = useMemo(() => {
        const cellRows: ReactNode[][] = [[]];
        renderTree(data, dimsInRow, 0, cellRows, measInRow.length);
        cellRows[0].shift();
        if (measInRow.length > 0) {
            const ans: ReactNode[][] = [];
            for (let row of cellRows) {
                ans.push([
                    ...row,
                    <td
                        key={`0-${measInRow[0].fid}-${measInRow[0].aggName}`}
                        className="whitespace-nowrap p-2 text-xs text-gray-500 m-1 border border-gray-300"
                    >
                        {measInRow[0].aggName}({measInRow[0].name})
                    </td>,
                ]);
                for (let j = 1; j < measInRow.length; j++) {
                    ans.push([
                        <td
                            key={`${j}-${measInRow[j].fid}-${measInRow[j].aggName}`}
                            className="whitespace-nowrap p-2 text-xs text-gray-500 m-1 border border-gray-300"
                        >
                            {measInRow[j].aggName}({measInRow[j].name})
                        </td>,
                    ]);
                }
            }
            return ans;
        }
        return cellRows;
    }, [data, dimsInRow, measInRow]);
    return (
        <thead className="bg-gray-50 border border-gray-300">
            {nodeCells.map((row, rIndex) => (
                <tr className="border border-gray-300" key={rIndex}>
                    {row}
                </tr>
            ))}
        </thead>
    );
};

export default LeftTree;
