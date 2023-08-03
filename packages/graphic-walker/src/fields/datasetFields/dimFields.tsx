import React from "react";
import { Draggable, DroppableProvided } from "@kanaries/react-beautiful-dnd";
import { observer } from "mobx-react-lite";
import { useGlobalStore } from "../../store";
import DataTypeIcon from "../../components/dataTypeIcon";
import { FieldPill } from "./fieldPill";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";

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
                        return (
                            <>
                                <FieldPill
                                    className={`dark:text-white pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-blue-100 dark:hover:bg-blue-800 rounded-full truncate border border-transparent ${
                                        snapshot.isDragging ? "bg-blue-100 dark:bg-blue-800" : ""
                                    }`}
                                    ref={provided.innerRef} 
                                    isDragging={snapshot.isDragging}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                >
                                <div className="flex justify-between">
                                    <div>
                                    <DataTypeIcon dataType={f.semanticType} analyticType={f.analyticType} /> {f.name}
                                    &nbsp;
                                    </div>
                                    {(f.semanticType ===  'temporal'|| f.semanticType === 'quantitative' ) && <div className="rounded-full w-[20] hover:bg-blue-500 hover:bg-opacity-30">
                                            <EllipsisVerticalIcon 
                                            width={20}
                                            onClick={e => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                commonStore.setShowFieldScalePanel(true);
                                                commonStore.fieldScaleIndex = index;
                                                commonStore.fieldScaleType = f.analyticType;
                                                // commonStore.updateTempFields([f]);
                                            }}
                                            />
                                        </div>}
                                        </div>
                                </FieldPill>
                                {
                                    <FieldPill
                                        className={`dark:text-white pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-blue-100 dark:hover:bg-blue-800 rounded-full border-blue-400 border truncate ${
                                            snapshot.isDragging ? "bg-blue-100 dark:bg-blue-800" : "hidden"
                                        }`}
                                        isDragging={snapshot.isDragging}
                                    >                                        <DataTypeIcon dataType={f.semanticType} analyticType={f.analyticType} />{" "}
                                        {f.name}&nbsp;
                                        
                                    </FieldPill>
                                }
                            </>
                        );
                    }}
                </Draggable>
            ))}
        </div>
    );
};

export default observer(DimFields);
