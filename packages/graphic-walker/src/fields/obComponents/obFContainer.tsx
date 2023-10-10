import React from 'react';
import { observer } from 'mobx-react-lite';
import { FieldsContainer } from '../components';
import { useVizStore } from '../../store';
import { Draggable, DroppableProvided } from '@kanaries/react-beautiful-dnd';
import { IDraggableViewStateKey } from '../../interfaces';
import OBPill from './obPill';

interface FieldContainerProps {
    provided: DroppableProvided;
    /**
     * draggable Field Id
     */
    dkey: IDraggableViewStateKey;
}
const OBFieldContainer: React.FC<FieldContainerProps> = (props) => {
    const { provided, dkey } = props;
    const vizStore = useVizStore();
    const { allEncodings } = vizStore;
    return (
        <FieldsContainer {...provided.droppableProps} ref={provided.innerRef}>
            {/* {provided.placeholder} */}
            {allEncodings[dkey.id].map((f, index) => (
                <Draggable key={f.dragId} draggableId={f.dragId} index={index}>
                    {(provided, snapshot) => {
                        return <OBPill dkey={dkey} fIndex={index} provided={provided} />;
                    }}
                </Draggable>
            ))}
        </FieldsContainer>
    );
};

export default observer(OBFieldContainer);
