import React, { useCallback, useMemo } from "react";
import { Draggable, DroppableProvided } from "@kanaries/react-beautiful-dnd";
import { observer } from "mobx-react-lite";
import { useGlobalStore } from "../../store";
import DataTypeIcon from "../../components/dataTypeIcon";
import { FieldPill } from "./fieldPill";
import DropdownContext, { IDropdownContextOption } from "../../components/dropdownContext";
import ActionMenu from "../../components/actionMenu";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import { IActionMenuItem } from "../../components/actionMenu/list";

interface Props {
    provided: DroppableProvided;
}
const MeaFields: React.FC<Props> = (props) => {
    const { vizStore, commonStore } = useGlobalStore();
    const { provided } = props;

    const measures = vizStore.draggableFieldState.measures;

    const MEA_ACTION_OPTIONS = useMemo<IDropdownContextOption[]>(() => {
        return [
            {
                value: "bin",
                label: "Bin",
            },
            {
                value: 'binCount',
                label: 'Bin Count'
            },
            {
                value: "log10",
                label: "Log10",
            },
            {
                value: "log2",
                label: "Log2",
            },
        ];
    }, []);

    const fieldActionHandler = useCallback((selectedValue: any, opIndex: number, meaIndex: number) => {
        if (selectedValue === "bin" || selectedValue === 'binCount') {
            vizStore.createBinField("measures", meaIndex, selectedValue);
        } else if (selectedValue === "log10" || selectedValue === "log2") {
            vizStore.createLogField("measures", meaIndex, selectedValue);
        }
    }, []);

    return (
        <div {...provided.droppableProps} ref={provided.innerRef}>
            {measures.map((f, index) => (
                <Draggable key={f.dragId} draggableId={f.dragId} index={index}>
                    {(provided, snapshot) => {
                        let menu:IActionMenuItem[] | undefined = []

                        if(f.semanticType === 'temporal' || f.semanticType === 'quantitative'){
                            menu = [
                                {
                                    label: 'Domain',
                                    onPress: () => {
                                        commonStore.setShowFieldScalePanel(true);
                                        commonStore.fieldScaleIndex = index;
                                        commonStore.fieldScaleType = f.analyticType;
                                    }
                                }
                            ]
                        }
                        return (
                            <div className="block">
                                <ActionMenu
                                    menu={menu}
                                    enableContextMenu
                                    disabled={snapshot.isDragging}
                                >

                                    <DropdownContext
                                        disable={snapshot.isDragging}
                                        options={MEA_ACTION_OPTIONS}
                                        onSelect={(v, opIndex) => {
                                            fieldActionHandler(v, opIndex, index);
                                        }}
                                    >
                                        <FieldPill
                                            className={`dark:text-white pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-purple-100 dark:hover:bg-purple-800 rounded-full truncate border border-transparent ${snapshot.isDragging ? "bg-purple-100 dark:bg-purple-800" : ""
                                                }`}
                                            isDragging={snapshot.isDragging}
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                        >
                                            <DataTypeIcon dataType={f.semanticType} analyticType={f.analyticType} />
                                            <span>{f.name}</span>
                                            <ActionMenu.Button as="div">
                                                <EllipsisVerticalIcon className="w-4 h-4" />
                                            </ActionMenu.Button>
                                        </FieldPill>
                                    </DropdownContext>
                                    {
                                        <FieldPill
                                            className={`dark:text-white pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-purple-100 dark:hover:bg-purple-800 rounded-full border-purple-400 border truncate ${snapshot.isDragging ? "bg-purple-100 dark:bg-purple-800" : "hidden"
                                                }`}
                                            isDragging={snapshot.isDragging}
                                        >
                                            <DataTypeIcon dataType={f.semanticType} analyticType={f.analyticType} />
                                            <span>{f.name}</span>
                                            <ActionMenu.Button as="div">
                                                <EllipsisVerticalIcon className="w-4 h-4" />
                                            </ActionMenu.Button>
                                        </FieldPill>
                                    }
                                </ActionMenu>
                            </div>
                        );
                    }}
                </Draggable>
            ))}
        </div>
    );
};

export default observer(MeaFields);
