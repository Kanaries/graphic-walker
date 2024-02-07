import React from 'react';
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import { Draggable, DroppableProvided } from '@kanaries/react-beautiful-dnd';
import { observer } from 'mobx-react-lite';
import { useVizStore } from '../../store';
import DataTypeIcon from '../../components/dataTypeIcon';
import ActionMenu from '../../components/actionMenu';
import { FieldPill } from './fieldPill';
import { useMenuActions } from './utils';
import { refMapper } from '../fieldsContext';

interface Props {
    provided: DroppableProvided;
}
const DimFields: React.FC<Props> = (props) => {
    const { provided } = props;
    const vizStore = useVizStore();
    const { dimensions } = vizStore;
    const menuActions = useMenuActions('dimensions');
    return (
        <div {...provided.droppableProps} ref={refMapper(provided.innerRef)}>
            {dimensions.map((f, index) => (
                <Draggable key={f.dragId} draggableId={f.dragId} index={index}>
                    {(provided, snapshot) => {
                        return (
                            <ActionMenu title={f.name || f.fid} menu={menuActions[index]} enableContextMenu disabled={snapshot.isDragging}>
                                <FieldPill
                                    className={`flex pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-dimension/20 transition-colors rounded-md truncate border border-transparent ${
                                        snapshot.isDragging ? 'bg-dimension/20' : ''
                                    }`}
                                    ref={refMapper(provided.innerRef)}
                                    isDragging={snapshot.isDragging}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                >
                                    <DataTypeIcon dataType={f.semanticType} analyticType={f.analyticType} />
                                    <span className="ml-0.5" title={f.name}>
                                        {f.name}
                                    </span>
                                    <ActionMenu.Button as="div">
                                        <EllipsisVerticalIcon className="w-4 h-4" />
                                    </ActionMenu.Button>
                                </FieldPill>
                                {
                                    <FieldPill
                                        className={`pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-dimension/20 rounded-full border border-dimension truncate ${
                                            snapshot.isDragging ? 'bg-dimension/20 flex' : 'hidden'
                                        }`}
                                        isDragging={snapshot.isDragging}
                                    >
                                        <DataTypeIcon dataType={f.semanticType} analyticType={f.analyticType} />
                                        <span className="ml-0.5" title={f.name}>
                                            {f.name}
                                        </span>
                                        <ActionMenu.Button as="div">
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
