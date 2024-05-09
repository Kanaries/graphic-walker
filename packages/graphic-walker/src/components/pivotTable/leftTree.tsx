import React, { ReactNode, useMemo } from 'react';
import { INestNode } from './inteface';
import { IField } from '../../interfaces';
import { MinusCircleIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { formatDate } from '@/utils';
import { parsedOffsetDate } from '@/lib/op/offset';

function getChildCount(node: INestNode): number {
    if (node.isCollapsed || node.children.length === 0) {
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
function renderTree(
    node: INestNode,
    dimsInRow: IField[],
    depth: number,
    cellRows: ReactNode[][],
    meaNumber: number,
    onHeaderCollapse: (node: INestNode) => void,
    enableCollapse: boolean,
    displayOffset?: number
) {
    const childrenSize = getChildCount(node);
    const { isCollapsed } = node;
    if (depth > dimsInRow.length) {
        return;
    }
    const field = depth > 0 ? dimsInRow[depth - 1] : undefined;
    const formatter = field?.semanticType === 'temporal' ? (x) => formatDate(parsedOffsetDate(displayOffset, field.offset)(x)) : (x) => `${x}`;

    cellRows[cellRows.length - 1].push(
        <td
            key={`${depth}-${node.fieldKey}-${node.value}`}
            className={`bg-secondary text-secondary-foreground align-top whitespace-nowrap p-2 text-xs m-1 border`}
            colSpan={isCollapsed ? node.height + 1 : 1}
            rowSpan={isCollapsed ? Math.max(meaNumber, 1) : childrenSize * Math.max(meaNumber, 1)}
        >
            <div className="flex">
                <div>{formatter(node.value)}</div>
                {node.height > 0 && node.key !== '__total' && enableCollapse && (
                    <>
                        {isCollapsed && <PlusCircleIcon className="w-3 ml-1 self-center cursor-pointer" onClick={() => onHeaderCollapse(node)} />}
                        {!isCollapsed && <MinusCircleIcon className="w-3 ml-1 self-center cursor-pointer" onClick={() => onHeaderCollapse(node)} />}
                    </>
                )}
            </div>
        </td>
    );
    if (isCollapsed) return;
    for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        renderTree(child, dimsInRow, depth + 1, cellRows, meaNumber, onHeaderCollapse, enableCollapse);
        if (i < node.children.length - 1) {
            cellRows.push([]);
        }
    }
}

export interface TreeProps {
    data: INestNode;
    dimsInRow: IField[];
    measInRow: IField[];
    onHeaderCollapse: (node: INestNode) => void;
    enableCollapse: boolean;
    displayOffset?: number;
}
const LeftTree: React.FC<TreeProps> = (props) => {
    const { data, dimsInRow, measInRow, onHeaderCollapse } = props;
    const nodeCells: ReactNode[] = useMemo(() => {
        const cellRows: ReactNode[][] = [[]];
        renderTree(data, dimsInRow, 0, cellRows, measInRow.length, onHeaderCollapse, props.enableCollapse, props.displayOffset);
        cellRows[0].shift();
        if (measInRow.length > 0) {
            const ans: ReactNode[][] = [];
            for (let row of cellRows) {
                ans.push([
                    ...row,
                    <td
                        key={`0-${measInRow[0].fid}-${measInRow[0].aggName}`}
                        className="bg-secondary text-secondary-foreground whitespace-nowrap p-2 text-xs m-1 border"
                    >
                        {measInRow[0].aggName}({measInRow[0].name})
                    </td>,
                ]);
                for (let j = 1; j < measInRow.length; j++) {
                    ans.push([
                        <td
                            key={`${j}-${measInRow[j].fid}-${measInRow[j].aggName}`}
                            className="bg-secondary text-secondary-foreground whitespace-nowrap p-2 text-xs m-1 border"
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
        <thead className="bg-secondary border">
            {nodeCells.map((row, rIndex) => (
                <tr className="border" key={rIndex}>
                    {row}
                </tr>
            ))}
        </thead>
    );
};

export default LeftTree;
