import React, { ReactElement, ReactNode, useMemo } from 'react';
import { INestNode } from './inteface';
import { IField } from '../../interfaces';
import { nanoid } from 'nanoid';

function getChildCount (node: INestNode): number {
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
        <td key={nanoid()} className="whitespace-nowrap p-2 text-xs text-gray-500 m-1 border border-gray-300" colSpan={childrenSize * Math.max(meaNumber, 1)}>
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
    measInCol: IField[];
}
const TopTree: React.FC<TreeProps> = (props) => {
    const { data, dimsInCol, measInCol } = props;
    const nodeCells: ReactNode[] = useMemo(() => {
        const cellRows: ReactNode[][] = new Array(dimsInCol.length + 1).fill(0).map(() => []);
        renderTree(data, dimsInCol, 0, cellRows, measInCol.length);
        const totalChildrenSize = cellRows[cellRows.length - 1].length;
        cellRows.push(new Array(totalChildrenSize).fill(0).flatMap(() => measInCol.map((m) => <td key={nanoid()} className="whitespace-nowrap p-2 text-xs text-gray-500 m-1 border border-gray-300">{m.name}</td>)));
        cellRows.shift();
        return cellRows;
    }, [data, dimsInCol, measInCol]);
    return (
            <thead className='border border-gray-300 bg-gray-50 border border-gray-300'>
                {nodeCells.map((row, rIndex) => (
                    <tr className="border border-gray-300" key={rIndex}>{row}</tr>
                ))}
            </thead>
    );
};

export default TopTree;
