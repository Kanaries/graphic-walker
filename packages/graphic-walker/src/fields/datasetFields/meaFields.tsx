import React, { useCallback, useRef } from "react";
import { observer } from "mobx-react-lite";
import { useGlobalStore } from "../../store";
import DataTypeIcon from "../../components/dataTypeIcon";
import DropdownContext, { IDropdownContextOption } from "../../components/dropdownContext";
import type { IViewField } from "../../interfaces";
import { useFieldDrag, useFieldDrop } from "../../utils/dnd.config";
import { FieldPill } from "./fieldPill";


const MEA_ACTION_OPTIONS: IDropdownContextOption[] = [
    {
        value: "bin",
        label: "Bin",
    },
    {
        value: "log10",
        label: "Log10",
    },
];

const MeaDraggable: React.FC<{ data: IViewField; index: number }> = ({ data: f, index }) => {
    const { vizStore } = useGlobalStore();
    const ref = useRef<HTMLDivElement>(null);

    const [{ isDragging }, drag] = useFieldDrag('measures', f.dragId, index, {
        enableSort: true,
        ref,
    });

    const fieldActionHandler = useCallback((selectedValue: any, opIndex: number, meaIndex: number) => {
        if (selectedValue === "bin") {
            vizStore.createBinField("measures", meaIndex);
        } else if (selectedValue === "log10") {
            vizStore.createLogField("measures", meaIndex);
        }
    }, [vizStore]);

    return (
        <div className="block">
            <DropdownContext
                disable={isDragging}
                options={MEA_ACTION_OPTIONS}
                onSelect={(v, opIndex) => {
                    fieldActionHandler(v, opIndex, index);
                }}
            >
                <FieldPill
                    className={`dark:text-white pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-purple-100 dark:hover:bg-purple-800 rounded-full truncate border border-transparent ${isDragging ? "bg-purple-100 dark:bg-purple-800" : ""
                        }`}
                    isDragging={isDragging}
                    ref={drag}
                >
                    <DataTypeIcon dataType={f.semanticType} analyticType={f.analyticType} />{" "}
                    {f.name}&nbsp;
                </FieldPill>
            </DropdownContext>
        </div>
    );
};

interface Props {}
const MeaFields: React.FC<Props> = () => {
    const { vizStore } = useGlobalStore();
    const measures = vizStore.draggableFieldState.measures;
    const [{}, drop] = useFieldDrop('measures');

    return (
        <div ref={drop} className="min-h-[120px]">
            {measures.map((f, index) => (
                <MeaDraggable key={f.dragId} index={index} data={f} />
            ))}
        </div>
    );
};

export default observer(MeaFields);
