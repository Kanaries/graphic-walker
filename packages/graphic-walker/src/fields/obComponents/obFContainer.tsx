import React, { Fragment, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite'
import { FieldsContainer, PillPlaceholder } from '../components';
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
    const [{ isOver }, drop] = useFieldDrop(dkey.id);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [willInsertIdx, setWillInsertIdx] = useState<number | null>(null);

    const placeholderIdx = dragIndex !== null && willInsertIdx !== null && dragIndex !== willInsertIdx ? (
        willInsertIdx
    ) : null;

    useEffect(() => {
        if (!isOver) {
            setWillInsertIdx(null);
        }
    }, [isOver]);

    return <FieldsContainer ref={drop}>
        {/* {provided.placeholder} */}
        {draggableFieldState[dkey.id].map((f, index, arr) => {
            return (
                <Fragment key={f.dragId}>
                    {index === placeholderIdx && <PillPlaceholder />}
                    <OBPill dkey={dkey} fIndex={index} onWillInsert={setWillInsertIdx} onDragChange={setDragIndex} />
                    {index === arr.length - 1 && placeholderIdx === index + 1 && <PillPlaceholder />}
                </Fragment>
            );
        })}
    </FieldsContainer>
}

export default observer(OBFieldContainer);
