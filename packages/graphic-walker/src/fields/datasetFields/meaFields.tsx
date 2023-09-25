import React from 'react';
import { Draggable, DroppableProvided } from '@kanaries/react-beautiful-dnd';
import { observer } from 'mobx-react-lite';
import { useGlobalStore } from '../../store';
import DataTypeIcon from '../../components/dataTypeIcon';
import { FieldPill } from './fieldPill';
import ActionMenu from '../../components/actionMenu';
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import { useMenuActions } from './utils';

interface Props {
    provided: DroppableProvided;
}
const MeaFields: React.FC<Props> = (props) => {
    const { provided } = props;
    const { vizStore } = useGlobalStore();
    const measures = vizStore.draggableFieldState.measures;

    const menuActions = useMenuActions('measures');

    return (
        <div {...provided.droppableProps} ref={provided.innerRef}>
            {measures.map((f, index) => (
                <Draggable key={f.dragId} draggableId={f.dragId} index={index}>
                    {(provided, snapshot) => {
                        return (
                            <div className="block">
                                <ActionMenu title={f.name || f.fid} menu={menuActions[index]} enableContextMenu disabled={snapshot.isDragging}>
                                    <FieldPill
                                        className={`flex dark:text-white pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-purple-100 dark:hover:bg-purple-800 rounded-full truncate border border-transparent ${
                                            snapshot.isDragging ? 'bg-purple-100 dark:bg-purple-800' : ''
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
                                    {
                                        <FieldPill
                                            className={`dark:text-white pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-purple-100 dark:hover:bg-purple-800 rounded-full border-purple-400 border truncate ${
                                                snapshot.isDragging ? 'bg-purple-100 dark:bg-purple-800 flex' : 'hidden'
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
