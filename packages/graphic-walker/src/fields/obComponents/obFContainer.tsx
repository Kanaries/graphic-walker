import React, { Fragment, useState } from 'react';
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
    const [placeholderIdx, setPlaceholderIdx] = useState<number | null>(null);
    const [{}, drop] = useFieldDrop(dkey.id, {
        multiple: true,
        onWillInsert(target) {
            setPlaceholderIdx(target?.index ?? null);
        },
    });

    return <FieldsContainer ref={drop}>
        {/* {provided.placeholder} */}
        {draggableFieldState[dkey.id].map((f, index, arr) => {
            return (
                <Fragment key={f.dragId}>
                    {index === placeholderIdx && <PillPlaceholder />}
                    <OBPill dkey={dkey} fIndex={index} />
                    {index === arr.length - 1 && placeholderIdx === index + 1 && <PillPlaceholder />}
                </Fragment>
            );
        })}
    </FieldsContainer>
}

export default observer(OBFieldContainer);
