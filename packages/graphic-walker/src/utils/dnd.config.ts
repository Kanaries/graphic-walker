import { RefObject, useMemo, useState } from "react";
import { type ConnectDragPreview, type ConnectDragSource, useDrag, useDrop, type XYCoord, type ConnectDropTarget } from "react-dnd";
import type { DraggableFieldState, IDraggableStateKey } from "../interfaces";
import { useGlobalStore } from "../store";


export const DRAGGABLE_STATE_KEYS: Readonly<IDraggableStateKey[]> = [
    { id: 'fields', mode: 0 },
    { id: 'columns', mode: 0 },
    { id: 'rows', mode: 0 },
    { id: 'color', mode: 1 },
    { id: 'opacity', mode: 1 },
    { id: 'size', mode: 1 },
    { id: 'shape', mode: 1},
    { id: 'theta', mode: 1 },
    { id: 'radius', mode: 1 },
    { id: 'filters', mode: 1 },
] as const;

export const AGGREGATOR_LIST: Readonly<string[]> = [
    'sum',
    'mean',
    'median',
    'count',
    'min',
    'max',
    'variance',
    'stdev'
] as const;

export enum TargetType {
    Field = 'field',
}

export type DropType = keyof DraggableFieldState;

export interface IDragObject {
    draggableId: string;
    index: number;
    targetIndex?: number | undefined;
}

export interface IDropResult {
    dropId: DropType;
}

export interface ICollectedProps {
    isOver: boolean;
    canDrop: boolean;
}

export interface IDragCollectedProps {
    isDragging: boolean;
    handlerId: string;
}

export interface IUseFieldDragOptions {
    ref?: RefObject<HTMLDivElement>;
    /**
     * requires `ref`
     * @default false
     */
    enableSort?: boolean;
    /** @default false */
    enableRemove?: boolean;
    /** @default 'vertical' */
    direction?: 'horizontal' | 'vertical';
    onWillInsert?: (index: number | null) => void;
}

export const EmptyItemId = 'empty-item';

export const useFieldDrag = (
    dropId: keyof DraggableFieldState,
    dragId: string,
    index: number,
    options?: Partial<IUseFieldDragOptions>,
): [IDragCollectedProps, ConnectDragSource | RefObject<HTMLDivElement>, ConnectDragPreview] => {
    const { ref, enableSort = false, enableRemove = false, onWillInsert, direction = 'vertical' } = options ?? {};
    const { vizStore } = useGlobalStore();

    const [droppableProps, drop] = useDrop<IDragObject, IDropResult, ICollectedProps>(() => ({
        accept: TargetType.Field,
        hover(item, monitor) {
            item.targetIndex = item.index;
            if (!ref?.current) {
                return;
            }
            const dragIndex = item.index;
            let hoverIndex = index;

            // Determine rectangle on screen
            const hoverBoundingRect = ref.current?.getBoundingClientRect();

            // Get align middle
            const hoverMiddle = (
                hoverBoundingRect[direction === 'vertical' ? 'bottom' : 'right']
                - hoverBoundingRect[direction === 'vertical' ? 'top' : 'left']
            ) / 2;

            // Determine mouse position
            const clientOffset = monitor.getClientOffset();

            // Get pixels to the top
            const hoverClientPos = (clientOffset as XYCoord)[
                direction === 'vertical' ? 'y' : 'x'
            ] - hoverBoundingRect[direction === 'vertical' ? 'top' : 'left'];

            if (hoverClientPos >= hoverMiddle) {
                hoverIndex += 1;
            }

            // Don't replace items with themselves
            if (dragIndex === hoverIndex) {
                onWillInsert?.(null);
                return;
            }

            // Note: we're mutating the monitor item here!
            // Generally it's better to avoid mutations,
            // but it's good here for the sake of performance
            // to avoid expensive index searches.
            item.targetIndex = hoverIndex;
            onWillInsert?.(hoverIndex);
        },
    }), [index, vizStore, ref, onWillInsert, direction]);

    const [props, drag, preview] = useDrag<IDragObject, IDropResult, IDragCollectedProps>(() => ({
        type: TargetType.Field,
        item: {
            index,
            draggableId: dragId,
            targetIndex: undefined,
        },
        end(item, monitor) {
            onWillInsert?.(null);
            const dropResult = monitor.getDropResult();
            if (!dropResult) {
                if (enableRemove) {
                    vizStore.removeField(dropId, item.index);
                }
                return;
            }
            if (item) {
                if (dropId === dropResult.dropId) {
                    if (item.targetIndex !== undefined && item.targetIndex !== item.index) {
                        if (item.targetIndex > item.index) {
                            // skip the current item
                            vizStore.reorderField(dropId, item.index, item.targetIndex - 1);
                        } else {
                            vizStore.reorderField(dropId, item.index, item.targetIndex);
                        }
                    }
                } else {
                    const target = vizStore.draggableFieldState[dropResult.dropId];
                    vizStore.moveField(dropId, item.index, dropResult.dropId, item.targetIndex ?? target.length);
                }
            }
        },
        collect: monitor => ({
            isDragging: monitor.isDragging(),
            handlerId: monitor.getHandlerId() as string,
        }),
    }), [dropId, dragId, index, vizStore, enableSort, enableRemove, onWillInsert]);

    const shouldApplyDrop = enableSort && ref;

    if (shouldApplyDrop) {
        drag(drop(ref));
    }

    const providerRef = shouldApplyDrop ? ref : drag;

    const mergedProps = useMemo(() => ({
        ...droppableProps,
        ...props,
    }), [droppableProps, props]);

    return [mergedProps, providerRef, preview];
};

export const useFieldDrop = (dropId: keyof DraggableFieldState): [ICollectedProps, ConnectDropTarget] => {
    return useDrop<IDragObject, IDropResult, ICollectedProps>(() => ({
        accept: TargetType.Field,
        drop: () => ({
            dropId,
        }),
        collect: monitor => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    }), [dropId]);
};
