import React, { Fragment, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { useGlobalStore } from "../../store";
import DataTypeIcon from "../../components/dataTypeIcon";
import { useFieldDrag, useFieldDrop } from "../../utils/dnd.config";
import type { IViewField } from "../../interfaces";
import { PillPlaceholder } from "../components";
import { FieldPill } from "./fieldPill";


interface IDimDraggableProps {
    data: IViewField;
    index: number;
    onWillInsert?: (index: number | null) => void;
    onDragChange?: (index: number | null) => void;
}

const DimDraggable: React.FC<IDimDraggableProps> = ({ data: f, index, onWillInsert, onDragChange }) => {
    const ref = useRef<HTMLDivElement>(null)

    const [{ isDragging }] = useFieldDrag('dimensions', f.dragId, index, {
        enableSort: true,
        ref,
        onWillInsert,
    });

    useEffect(() => {
        onDragChange?.(isDragging ? index : null);
    }, [onDragChange, isDragging, index]);

    return (
        <FieldPill
            className="dark:text-white pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-blue-100 dark:hover:bg-blue-800 rounded-full truncate border border-transparent"
            ref={ref}
            isDragging={isDragging}
        >
            <DataTypeIcon dataType={f.semanticType} analyticType={f.analyticType} /> {f.name}
            &nbsp;
        </FieldPill>
    );
};

interface Props {}
const DimFields: React.FC<Props> = () => {
    const { vizStore } = useGlobalStore();
    const dimensions = vizStore.draggableFieldState.dimensions;
    const [{ isOver }, drop] = useFieldDrop('dimensions');
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [willInsertIdx, setWillInsertIdx] = useState<number | null>(null);

    const placeholderIdx = dragIndex !== null && willInsertIdx !== null && dragIndex !== willInsertIdx ? (
        willInsertIdx
    ) : null;

    useEffect(() => {
        if (!isOver) {
            setWillInsertIdx(null);
        }
    }, [isOver]);

    return (
        <div ref={drop} className="min-h-[100px]">
            {dimensions.map((f, index, arr) => {
                return (
                    <Fragment key={f.dragId}>
                        {index === placeholderIdx && <PillPlaceholder />}
                        <DimDraggable index={index} data={f} onWillInsert={setWillInsertIdx} onDragChange={setDragIndex} />
                        {index === arr.length - 1 && placeholderIdx === index + 1 && <PillPlaceholder />}
                    </Fragment>
                );
            })}
        </div>
    );
};

export default observer(DimFields);
