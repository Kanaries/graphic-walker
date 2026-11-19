import React, { ReactNode, useMemo } from 'react';
import { INestNode } from './interface';
import { IViewField } from '../../interfaces';
import { MinusCircleIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { formatDate, getMeaAggName } from '@/utils';
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
    dimsInCol: IViewField[],
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
    const formatter =
        node.kind === 'value' && field?.semanticType === 'temporal'
            ? (x) => formatDate(parsedOffsetDate(displayOffset, field.offset)(x))
            : (x) => `${x}`;
    cellRows[depth].push(
        <th
            key={`${depth}-${node.uniqueKey}-${cellRows[depth].length}`}
            scope="col"
            className="bg-secondary text-secondary-foreground align-top whitespace-nowrap p-2 text-xs m-1 border font-normal text-left"
            colSpan={isCollapsed ? Math.max(meaNumber, 1) : childrenSize * Math.max(meaNumber, 1)}
            rowSpan={isCollapsed ? node.height + 1 : 1}
        >
            <div className="flex">
                <div>{formatter(node.value)}</div>
                {node.kind === 'value' && node.height > 0 && enableCollapse && (
                    <button
                        type="button"
                        className="ml-1 self-center cursor-pointer"
                        aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${formatter(node.value)}`}
                        aria-expanded={!isCollapsed}
                        onClick={() => onHeaderCollapse(node)}
                    >
                        {isCollapsed ? <PlusCircleIcon className="w-3" /> : <MinusCircleIcon className="w-3" />}
                    </button>
                )}
            </div>
        </th>
    );
    if (isCollapsed) return;
    for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        renderTree(child, dimsInCol, depth + 1, cellRows, meaNumber, onHeaderCollapse, enableCollapse, displayOffset);
    }
}

export interface TreeProps {
    data: INestNode;
    dimsInCol: IViewField[];
    measInCol: IViewField[];
    dimsInRow: IViewField[];
    measInRow: IViewField[];
    onHeaderCollapse: (node: INestNode) => void;
    enableCollapse: boolean;
    defaultAggregated: boolean;
    displayOffset?: number;
}
const TopTree: React.FC<TreeProps> = (props) => {
    const { data, dimsInCol, measInCol, dimsInRow, measInRow, onHeaderCollapse } = props;
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
                    <th
                        key={`${cellRows.length}-${m.fid}-${m.aggName}-${idx}`}
                        scope="col"
                        className="bg-secondary text-secondary-foreground whitespace-nowrap p-2 text-xs m-1 border font-normal text-left"
                    >
                        {m.titleOverride || (props.defaultAggregated ? getMeaAggName(m.name, m.aggName, m.windowAgg) : m.name)}
                    </th>
                ))
            )
        );
        cellRows.shift();
        const visibleRows = cellRows.filter((row) => row.length > 0);
        if (visibleRows.length === 0) {
            visibleRows.push([
                <th key="value" scope="col" className="bg-secondary text-secondary-foreground p-2 text-xs border font-normal text-left">
                    Value
                </th>,
            ]);
        }
        const rowHeaderColumnCount = dimsInRow.length + (measInRow.length > 0 ? 1 : 0);
        return visibleRows.map((row, rowIndex) => {
            if (rowHeaderColumnCount === 0) {
                return row;
            }
            if (rowIndex < visibleRows.length - 1) {
                return [
                    <th key={`corner-${rowIndex}`} aria-hidden="true" colSpan={rowHeaderColumnCount} className="bg-secondary p-2 text-xs border" />,
                    ...row,
                ];
            }
            return [
                ...dimsInRow.map((field) => (
                    <th
                        key={`row-field-${field.fid}`}
                        scope="col"
                        className="bg-secondary text-secondary-foreground p-2 text-xs border whitespace-nowrap font-normal text-left"
                    >
                        {field.titleOverride || field.name}
                    </th>
                )),
                ...(measInRow.length > 0
                    ? [
                          <th
                              key="row-measure"
                              scope="col"
                              className="bg-secondary text-secondary-foreground p-2 text-xs border font-normal text-left"
                          >
                              Measure
                          </th>,
                      ]
                    : []),
                ...row,
            ];
        });
    }, [data, dimsInCol, measInCol, dimsInRow, measInRow, onHeaderCollapse, props.defaultAggregated, props.enableCollapse, props.displayOffset]);

    return (
        <thead className="border bg-secondary">
            {nodeCells.map((row, rIndex) => (
                <tr className="border" key={rIndex}>
                    {row}
                </tr>
            ))}
        </thead>
    );
};

export default TopTree;
