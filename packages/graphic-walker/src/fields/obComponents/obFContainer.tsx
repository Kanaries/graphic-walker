import React from 'react';
import { observer } from 'mobx-react-lite';
import { FieldsContainer } from '../components';
import { useVizStore } from '../../store';
import { Draggable, DroppableProvided } from '@kanaries/react-beautiful-dnd';
import { IDraggableViewStateKey } from '../../interfaces';
import OBPill from './obPill';
import { refMapper } from '../fieldsContext';
import { getFieldIdentifier } from '@/utils';

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
        <FieldsContainer {...provided.droppableProps} ref={refMapper(provided.innerRef)}>
            {/* {provided.placeholder} */}
            {allEncodings[dkey.id].map((f, index) => (
                <Draggable key={`encode_${dkey.id}_${index}_${getFieldIdentifier(f)}`} draggableId={`encode_${dkey.id}_${index}_${getFieldIdentifier(f)}`} index={index}>
                    {(provided, snapshot) => {
                        return <OBPill dkey={dkey} fIndex={index} provided={provided} />;
                    }}
                </Draggable>
            ))}
        </FieldsContainer>
    );
};

export default observer(OBFieldContainer);
