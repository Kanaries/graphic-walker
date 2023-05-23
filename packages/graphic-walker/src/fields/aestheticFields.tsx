import React, { useMemo } from 'react';
import { Droppable } from "@kanaries/react-beautiful-dnd";
import { DRAGGABLE_STATE_KEYS } from './fieldsContext';
import { AestheticFieldContainer } from './components'
import SingleEncodeEditor from './encodeFields/singleEncodeEditor';
import { observer } from 'mobx-react-lite';
import { useGlobalStore } from '../store';

const aestheticFields = DRAGGABLE_STATE_KEYS.filter(f => ['color', 'opacity', 'size', 'shape', 'details', 'text'].includes(f.id));

const AestheticFields: React.FC = props => {
    const { vizStore } = useGlobalStore();
    const { visualConfig } = vizStore;
    const { geoms } = visualConfig;

    const channels = useMemo(() => {
        switch (geoms[0]) {
            case 'arc':
            case 'line':
            case 'area':
            case 'boxplot':
                return aestheticFields.filter(f => f.id !== 'shape');
            case 'text':
                return aestheticFields.filter(f => f.id === 'text' || f.id === 'color' || f.id === 'size' || f.id === 'opacity');
            case 'table':
                return aestheticFields.filter(f => f.id === 'color' || f.id === 'opacity' || f.id === 'size');
            default:
                return aestheticFields.filter(f => f.id !== 'text');
        }
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