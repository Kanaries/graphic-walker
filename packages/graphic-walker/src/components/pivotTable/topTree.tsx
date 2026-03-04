import React, { ReactNode, useEffect, useMemo } from 'react';
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
 * @param dimsInCol
 * @param depth
 * @param cellRows
 * @returns
 */
function renderTree(
    node: INestNode,
    dimsInCol: IField[],
    depth: number,
    cellRows: ReactNode[][],
    meaNumber: number,
    onHeaderCollapse: (node: INestNode) => void,
    enableCollapse: boolean,
    displayOffset?: number
) {
    const childrenSize = getChildCount(node);
    const { isCollapsed } = node;
    if (depth > dimsInCol.length) {
        return;
    }
    const field = depth > 0 ? dimsInCol[depth - 1] : undefined;
    const formatter = field?.semanticType === 'temporal' ? (x) => formatDate(parsedOffsetDate(displayOffset, field.offset)(x)) : (x) => `${x}`;
    cellRows[depth].push(
        <td
            key={`${depth}-${node.fieldKey}-${node.value}-${cellRows[depth].length}`}
            className="bg-secondary text-secondary-foreground align-top whitespace-nowrap p-2 text-xs m-1 border"
            colSpan={isCollapsed ? Math.max(meaNumber, 1) : childrenSize * Math.max(meaNumber, 1)}
            rowSpan={isCollapsed ? node.height + 1 : 1}
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
        renderTree(child, dimsInCol, depth + 1, cellRows, meaNumber, onHeaderCollapse, enableCollapse, displayOffset);
    }
}

export interface TreeProps {
    data: INestNode;
    dimsInCol: IField[];
    measInCol: IField[];
    onHeaderCollapse: (node: INestNode) => void;
    onTopTreeHeaderRowNumChange: (num: number) => void;
    enableCollapse: boolean;
    displayOffset?: number;
}
const TopTree: React.FC<TreeProps> = (props) => {
    const { data, dimsInCol, measInCol, onHeaderCollapse, onTopTreeHeaderRowNumChange } = props;
    const nodeCells: ReactNode[][] = useMemo(() => {
        const cellRows: ReactNode[][] = new Array(dimsInCol.length + 1).fill(0).map(() => []);
        renderTree(data, dimsInCol, 0, cellRows, measInCol.length, onHeaderCollapse, props.enableCollapse, props.displayOffset);
        const totalChildrenSize = getChildCount(data);

        // if all children in one layer are collapsed, then we need to reset the rowSpan of all children to 1
        cellRows.forEach((row: ReactNode[], rowIdx: number) => {
            const rowSpanArr = row.map((child) => (React.isValidElement(child) ? (child.props as { rowSpan: number }).rowSpan : 0));
            if (rowSpanArr.length > 0 && rowSpanArr[0] > 1 && rowSpanArr.every((v) => v === rowSpanArr[0])) {
                row.forEach((childObj, childIdx) => {
                    if (React.isValidElement(childObj)) {
                        const newChild = React.cloneElement(childObj, { ...(childObj.props as any), rowSpan: 1 });
                        cellRows[rowIdx][childIdx] = newChild;
                    }
                });
            }
        });

        cellRows.push(
            new Array(totalChildrenSize).fill(0).flatMap((ele, idx) =>
                measInCol.map((m) => (
                    <td
                        key={`${cellRows.length}-${m.fid}-${m.aggName}-${idx}`}
                        className="bg-secondary text-secondary-foreground whitespace-nowrap p-2 text-xs m-1 border"
                    >
                        {m.aggName}({m.name})
                    </td>
                ))
            )
        );
        cellRows.shift();
        return cellRows;
    }, [data, dimsInCol, measInCol]);

    useEffect(() => {
        onTopTreeHeaderRowNumChange(nodeCells.filter((row) => row.length > 0).length);
    }, [nodeCells]);

    return (
        <thead className="border bg-secondary">
            {nodeCells.map((row, rIndex) => (
                <tr className={`${row?.length > 0 ? '' : 'hidden'} border`} key={rIndex}>
                    {row}
                </tr>
            ))}
        </thead>
    );
};

export default TopTree;
