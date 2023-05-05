import React, { useMemo } from 'react';
import { Droppable } from "@kanaries/react-beautiful-dnd";
import { DRAGGABLE_STATE_KEYS } from './fieldsContext';
import { AestheticFieldContainer } from './components'
import SingleEncodeEditor from './encodeFields/singleEncodeEditor';
import { observer } from 'mobx-react-lite';
import { useGlobalStore } from '../store';

const aestheticFields = DRAGGABLE_STATE_KEYS.filter(f => ['color', 'opacity', 'size', 'shape', 'details'].includes(f.id));

const AestheticFields: React.FC = props => {
    const { vizStore } = useGlobalStore();
    const { visualConfig } = vizStore;
    const { geoms } = visualConfig;

    const channels = useMemo(() => {
        if (geoms[0] === 'arc') {
            return aestheticFields.filter(f => f.id !== 'shape');
        }
        if (geoms[0] === 'table') {
            return []
        }
        return aestheticFields
    }, [geoms[0]])
    return <div>
        {
            channels.map(dkey => <AestheticFieldContainer name={dkey.id} key={dkey.id}>
                <Droppable droppableId={dkey.id} direction="horizontal">
                    {(provided, snapshot) => (
                        // <OBFieldContainer dkey={dkey} provided={provided} />
                        <SingleEncodeEditor dkey={dkey} provided={provided} snapshot={snapshot} />
                    )}
                </Droppable>
            </AestheticFieldContainer>)
        }
    </div>
}

export default observer(AestheticFields);