import React, { useRef } from "react";
import { observer } from "mobx-react-lite";
import { useGlobalStore } from "../../store";
import DataTypeIcon from "../../components/dataTypeIcon";
import { useFieldDrag, useFieldDrop } from "../../utils/dnd.config";
import type { IViewField } from "../../interfaces";
import { FieldPill } from "./fieldPill";


interface IDimDraggableProps {
    data: IViewField;
    index: number;
}

const DimDraggable: React.FC<IDimDraggableProps> = ({ data: f, index }) => {
    const ref = useRef<HTMLDivElement>(null)

    const [{ isDragging }] = useFieldDrag('dimensions', f.dragId, index, {
        enableSort: true,
        ref,
    });

    return (
        <FieldPill
            className={`${isDragging ? 'cursor-grabbing' : 'cursor-grab'} dark:text-white pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-blue-100 dark:hover:bg-blue-800 rounded-full truncate border border-transparent ${isDragging ? "bg-blue-100 dark:bg-blue-800" : ""
                }`}
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
    const [{}, drop] = useFieldDrop('dimensions');

    return (
        <div ref={drop} className="min-h-[100px]">
            {dimensions.map((f, index) => (
                <DimDraggable key={f.dragId} index={index} data={f} />
            ))}
        </div>
    );
};

export default observer(DimFields);
