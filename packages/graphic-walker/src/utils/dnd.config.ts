import { RefObject, useEffect, useMemo, useRef } from "react";
import { type ConnectDragPreview, type ConnectDragSource, useDrag, useDrop, type XYCoord } from "react-dnd";
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
    dropId: string;
    dragId: string;
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
    enableSort?: boolean;
    /** @default false */
    enableRemove?: boolean;
    /** @default 'vertical' */
    direction?: 'horizontal' | 'vertical';
}

export const EmptyItemId = 'empty-item';

export const useFieldDrag = (
    dropId: keyof DraggableFieldState,
    dragId: string,
    index: number,
    options?: Partial<IUseFieldDragOptions>,
): [IDragCollectedProps, ConnectDragSource | RefObject<HTMLDivElement>, ConnectDragPreview] => {
    const { ref: passedRef, enableSort = false, enableRemove = false, direction = 'vertical' } = options ?? {};
    const localRef = useRef<HTMLDivElement>(null);
    const ref = passedRef ?? localRef;
    const { vizStore } = useGlobalStore();

    const [droppableProps, drop] = useDrop<IDragObject, IDropResult, ICollectedProps>(() => ({
        accept: TargetType.Field,
        hover(item, monitor) {
            item.targetIndex = item.index;
            if (!ref.current) {
                return;
            }
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

            // Note: we're mutating the monitor item here!
            // Generally it's better to avoid mutations,
            // but it's good here for the sake of performance
            // to avoid expensive index searches.
            item.targetIndex = hoverIndex;
        },
    }), [index, vizStore, ref, direction]);

    const [props, drag, preview] = useDrag<IDragObject, IDropResult, IDragCollectedProps>(() => ({
        type: TargetType.Field,
        item: {
            index,
            dropId,
            dragId,
            targetIndex: undefined,
        },
        end(item, monitor) {
            const dropResult = monitor.getDropResult();
            if (!dropResult) {
                if (enableRemove) {
                    vizStore.removeField(dropId, item.index);
                }
                item.targetIndex = undefined;
                return;
            }
            if (item) {
                if (dropId === dropResult.dropId) {
                    if (enableSort && item.targetIndex !== undefined && item.targetIndex !== item.index) {
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
            item.targetIndex = undefined;
        },
        collect: monitor => ({
            isDragging: monitor.isDragging(),
            handlerId: monitor.getHandlerId() as string,
        }),
    }), [dropId, dragId, index, vizStore, enableRemove]);

    drag(drop(ref));

    const mergedProps = useMemo(() => ({
        ...droppableProps,
        ...props,
    }), [droppableProps, props]);

    useEffect(() => {
        drag(drop(ref));
        const e = ref.current;
        if (e) {
            e.setAttribute('data-we', 'true');
            return () => {
                e.removeAttribute('data-we');
            };
        }
    });

    return [mergedProps, ref, preview];
};

export interface IUseFieldDropOptions {
    /** @default false */
    multiple?: boolean;
    onWillInsert?: (target: { index: number; data: IDragObject } | null) => void;
    onWillReplace?: (target: IDragObject | null) => void;
    ref?: RefObject<HTMLDivElement>;
}

export const useFieldDrop = (
    dropId: keyof DraggableFieldState,
    options: IUseFieldDropOptions = {},
): [ICollectedProps, RefObject<HTMLDivElement>] => {
    const { multiple = false, onWillInsert, onWillReplace, ref: passedRef } = options;
    const localRef = useRef<HTMLDivElement>(null);
    const ref = passedRef ?? localRef;
    const onWillInsertRef = useRef(onWillInsert);
    onWillInsertRef.current = onWillInsert;
    const onWillReplaceRef = useRef(onWillReplace);
    onWillReplaceRef.current = onWillReplace;
    const [droppableProps, drop] = useDrop<IDragObject, IDropResult, ICollectedProps>(() => ({
        accept: TargetType.Field,
        drop: () => ({
            dropId,
        }),
        hover: (item, monitor) => {
            if (!ref.current || !monitor.canDrop()) {
                onWillInsertRef.current?.(null);
                onWillReplaceRef.current?.(null);
                return;
            }
            const sourceIndex = item.index;
            const targetIndex = item.targetIndex;
            const isSourceSelf = item.dropId === dropId;
            if (typeof targetIndex !== 'number' || ((sourceIndex === targetIndex || sourceIndex + 1 === targetIndex) && isSourceSelf)) {
                onWillInsertRef.current?.(null);
                onWillReplaceRef.current?.(null);
                return;
            }
            if (multiple) {
                onWillInsertRef.current?.({
                    index: targetIndex,
                    data: item,
                });
            } else {
                onWillReplaceRef.current?.(item);
            }
        },
        collect: monitor => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    }), [dropId, ref, multiple]);

    useEffect(() => {
        drop(ref);
    });
    
    const { isOver, canDrop } = droppableProps;

    useEffect(() => {
        if (!isOver || !canDrop) {
            onWillInsertRef.current?.(null);
            onWillReplaceRef.current?.(null);
        }
    }, [isOver, canDrop]);

    return [droppableProps, ref];
};
