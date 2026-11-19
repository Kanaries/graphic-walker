import React, { ReactNode } from 'react';
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
 * @param dimsInRow
 * @param depth
 * @param cellRows
 * @returns
 */
function renderTree(
    node: INestNode,
    dimsInRow: IViewField[],
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
    const formatter =
        node.kind === 'value' && field?.semanticType === 'temporal'
            ? (x) => formatDate(parsedOffsetDate(displayOffset, field.offset)(x))
            : (x) => `${x}`;

    cellRows[cellRows.length - 1].push(
        <th
            key={`${depth}-${node.uniqueKey}`}
            scope="row"
            className="bg-secondary text-secondary-foreground align-top whitespace-nowrap p-2 text-xs m-1 border font-normal text-left"
            colSpan={isCollapsed ? node.height + 1 : 1}
            rowSpan={isCollapsed ? Math.max(meaNumber, 1) : childrenSize * Math.max(meaNumber, 1)}
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
        renderTree(child, dimsInRow, depth + 1, cellRows, meaNumber, onHeaderCollapse, enableCollapse, displayOffset);
        if (i < node.children.length - 1) {
            cellRows.push([]);
        }
    }
}

export interface TreeProps {
    data: INestNode;
    dimsInRow: IViewField[];
    measInRow: IViewField[];
    onHeaderCollapse: (node: INestNode) => void;
    enableCollapse: boolean;
    defaultAggregated: boolean;
    displayOffset?: number;
}
export function buildLeftTreeRows(props: TreeProps): ReactNode[][] {
    const { data, dimsInRow, measInRow, onHeaderCollapse } = props;
    const cellRows: ReactNode[][] = [[]];
    renderTree(data, dimsInRow, 0, cellRows, measInRow.length, onHeaderCollapse, props.enableCollapse, props.displayOffset);
    cellRows[0].shift();
    if (measInRow.length > 0) {
        const result: ReactNode[][] = [];
        for (const row of cellRows) {
            for (let index = 0; index < measInRow.length; index++) {
                const measure = measInRow[index];
                result.push([
                    ...(index === 0 ? row : []),
                    <th
                        key={`${index}-${measure.fid}-${measure.aggName}`}
                        scope="row"
                        className="bg-secondary text-secondary-foreground whitespace-nowrap p-2 text-xs m-1 border font-normal text-left"
                    >
                        {measure.titleOverride || (props.defaultAggregated ? getMeaAggName(measure.name, measure.aggName, measure.windowAgg) : measure.name)}
                    </th>,
                ]);
            }
        }
        return result;
    }
    return cellRows;
}

export default buildLeftTreeRows;
