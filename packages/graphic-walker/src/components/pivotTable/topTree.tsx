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
 * @param dimsInCol
 * @param depth
 * @param cellRows
 * @returns
 */
function renderTree(node: INestNode, dimsInCol: IField[], depth: number, cellRows: ReactNode[][], meaNumber: number) {
    const childrenSize = getChildCount(node);
    if (depth > dimsInCol.length) {
        return;
    }
    cellRows[depth].push(
        <td
            key={`${depth}-${node.fieldKey}-${node.value}-${cellRows[depth].length}`}
            className="bg-white dark:bg-zinc-800 whitespace-nowrap p-2 text-xs text-gray-500 dark:text-white m-1 border border-gray-300"
            colSpan={childrenSize * Math.max(meaNumber, 1)}
        >
            {node.value}
        </td>
    );
    for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        renderTree(child, dimsInCol, depth + 1, cellRows, meaNumber);
    }
}

export interface TreeProps {
    data: INestNode;
    dimsInCol: IField[];
    measures: IField[];
}
const TopTree: React.FC<TreeProps> = (props) => {
    const { data, dimsInCol, measures } = props;
    const nodeCells: ReactNode[] = useMemo(() => {
        const cellRows: ReactNode[][] = new Array(dimsInCol.length + 1).fill(0).map(() => []);
        renderTree(data, dimsInCol, 0, cellRows, measures.length);
        const totalChildrenSize = cellRows[cellRows.length - 1].length;
        cellRows.push(
            new Array(totalChildrenSize).fill(0).flatMap((_, idx) =>
                measures.map((m, mIdx) => (
                    <td
                        key={`${cellRows.length}-${m.fid}-${m.aggName}-${idx}-${mIdx}`}
                        className="bg-white dark:bg-zinc-800 whitespace-nowrap p-2 text-xs text-gray-500 dark:text-white m-1 border border-gray-300"
                    >
                        {m.aggName}({m.name})
                    </td>
                ))
            )
        );
        cellRows.shift();
        return cellRows;
    }, [data, dimsInCol, measures]);
    return (
        <thead className="border border-gray-300 bg-gray-50 border border-gray-300">
            {nodeCells.map((row, rIndex) => (
                <tr className="border border-gray-300" key={rIndex}>
                    {row}
                </tr>
            ))}
        </thead>
    );
};

export default TopTree;
