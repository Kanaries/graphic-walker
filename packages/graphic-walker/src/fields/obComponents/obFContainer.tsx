import React from 'react';
import { observer } from 'mobx-react-lite'
import { FieldsContainer } from '../components';
import { useGlobalStore } from '../../store';
import { IDraggableStateKey } from '../../interfaces';
import { useFieldDrop } from '../../utils/dnd.config';
import OBPill from './obPill';

interface FieldContainerProps {
    /**
     * draggable Field Id
     */
    dkey: IDraggableStateKey;
}
const OBFieldContainer: React.FC<FieldContainerProps> = props => {
    const { dkey } = props;
    const { vizStore} = useGlobalStore();
    const { draggableFieldState } = vizStore;
    const [{}, drop] = useFieldDrop(dkey.id);

    return <FieldsContainer ref={drop}>
        {/* {provided.placeholder} */}
        {draggableFieldState[dkey.id].map((f, index) => (
            <OBPill key={f.dragId} dkey={dkey} fIndex={index} />
        ))}
    </FieldsContainer>
}

export default observer(OBFieldContainer);
