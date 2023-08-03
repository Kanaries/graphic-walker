import React from "react";
import { Draggable, DroppableProvided } from "@kanaries/react-beautiful-dnd";
import { observer } from "mobx-react-lite";
import { useGlobalStore } from "../../store";
import DataTypeIcon from "../../components/dataTypeIcon";
import ActionMenu from "../../components/actionMenu";
import { FieldPill } from "./fieldPill";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import { CommonStore } from "../../store/commonStore";
import { IActionMenuItem } from "../../components/actionMenu/list";

interface Props {
    provided: DroppableProvided;
}


const DimFields: React.FC<Props> = (props) => {
    const { provided } = props;
    const { vizStore, commonStore } = useGlobalStore();
    const dimensions = vizStore.draggableFieldState.dimensions;

    return (
        <div {...provided.droppableProps} ref={provided.innerRef}>
            {dimensions.map((f, index) => (
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
                            <ActionMenu
                                menu= {menu}
                                enableContextMenu
                                disabled={snapshot.isDragging}
                            >
                                <FieldPill
                                    className={`dark:text-white pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-blue-100 dark:hover:bg-blue-800 rounded-full truncate border border-transparent ${
                                        snapshot.isDragging ? "bg-blue-100 dark:bg-blue-800" : ""
                                    }`}
                                    ref={provided.innerRef} 
                                    isDragging={snapshot.isDragging}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                >
                                    <DataTypeIcon dataType={f.semanticType} analyticType={f.analyticType} />
                                    <span>{f.name}</span>
                                    <ActionMenu.Button>
                                        <EllipsisVerticalIcon className="w-4 h-4" />
                                    </ActionMenu.Button>
                                </FieldPill>
                                {
                                    <FieldPill
                                        className={`dark:text-white pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-blue-100 dark:hover:bg-blue-800 rounded-full border-blue-400 border truncate ${
                                            snapshot.isDragging ? "bg-blue-100 dark:bg-blue-800" : "hidden"
                                        }`}
                                        isDragging={snapshot.isDragging}
                                    >
                                        <DataTypeIcon dataType={f.semanticType} analyticType={f.analyticType} />
                                        <span>{f.name}</span>
                                        <ActionMenu.Button>
                                            <EllipsisVerticalIcon className="w-4 h-4" />
                                        </ActionMenu.Button>
                                    </FieldPill>
                                }
                            </ActionMenu>
                        );
                    }}
                </Draggable>
            ))}
        </div>
    );
};

export default observer(DimFields);
