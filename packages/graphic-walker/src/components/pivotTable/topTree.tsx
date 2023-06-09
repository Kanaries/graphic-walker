import React, { ReactNode, useEffect, useMemo } from 'react';
import { INestNode } from './inteface';
import { IField } from '../../interfaces';
import { MinusCircleIcon, PlusCircleIcon } from "@heroicons/react/24/outline";

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
function renderTree(node: INestNode, dimsInCol: IField[], depth: number, cellRows: ReactNode[][], meaNumber: number, onHeaderCollapse: (node: INestNode) => void) {
    const childrenSize = getChildCount(node);
    const { isCollapsed } = node;
    if (depth > dimsInCol.length) {
        return;
    }
    cellRows[depth].push(
        <td
            key={`${depth}-${node.fieldKey}-${node.value}-${cellRows[depth].length}`}
            className="whitespace-nowrap p-2 text-xs text-gray-500 m-1 border border-gray-300"
            colSpan={isCollapsed ? Math.max(meaNumber, 1) : childrenSize * Math.max(meaNumber, 1)}
            rowSpan={isCollapsed ? node.height + 1 : 1}
        >
            <div className="flex">
                <div>{node.value}</div>
                {node.height > 0 && (
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
        renderTree(child, dimsInCol, depth + 1, cellRows, meaNumber, onHeaderCollapse);
    }
}

export interface TreeProps {
    data: INestNode;
    dimsInCol: IField[];
    measInCol: IField[];
    onHeaderCollapse: (node: INestNode) => void;
    onTopTreeHeaderRowNumChange: (num: number) => void;
}
const TopTree: React.FC<TreeProps> = (props) => {
    const { data, dimsInCol, measInCol, onHeaderCollapse, onTopTreeHeaderRowNumChange } = props;
    const nodeCells: ReactNode[][] = useMemo(() => {
        const cellRows: ReactNode[][] = new Array(dimsInCol.length + 1).fill(0).map(() => []);
        renderTree(data, dimsInCol, 0, cellRows, measInCol.length, onHeaderCollapse);
        const totalChildrenSize = getChildCount(data);

        // if all children in one layer are collapsed, then we need to reset the rowSpan of all children to 1
        cellRows.forEach((row: ReactNode[], rowIdx: number) => {
            const rowSpanArr = row.map(child => React.isValidElement(child) ? child.props.rowSpan : 0)
            if (rowSpanArr.length > 0 && rowSpanArr[0] > 1 && rowSpanArr.every(v => v === rowSpanArr[0])) {
                row.forEach((childObj, childIdx) => {
                    if (React.isValidElement(childObj)) {
                        const newChild = React.cloneElement(childObj, {...childObj.props, rowSpan: 1});
                        cellRows[rowIdx][childIdx] = newChild;
                    }
                })
            }
        });

        cellRows.push(
            new Array(totalChildrenSize).fill(0).flatMap((ele, idx) =>
                measInCol.map((m) => (
                    <td
                        key={`${cellRows.length}-${m.fid}-${m.aggName}-${idx}`}
                        className="whitespace-nowrap p-2 text-xs text-gray-500 m-1 border border-gray-300"
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
        <thead className="border border-gray-300 bg-gray-50">
            {nodeCells.map((row, rIndex) => (
                <tr className={`${row?.length > 0 ? "" : "hidden"} border border-gray-300`} key={rIndex}>
                    {row}
                </tr>
            ))}
        </thead>
    );
};

export default TopTree;
