import React, { useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { Droppable } from "@kanaries/react-beautiful-dnd";
import { useGlobalStore } from '../../store';
import { FieldListContainer } from "../components";
import { DRAGGABLE_STATE_KEYS } from '../fieldsContext';
import OBFieldContainer from '../obComponents/obFContainer';

const firstChannelStyle = {
    zIndex: 2,
};

const PosFields: React.FC = props => {
    const { vizStore } = useGlobalStore();
    const { visualConfig } = vizStore;
    const { geoms } = visualConfig;

    const channels = useMemo(() => {
        if (geoms[0] === 'arc') {
            return DRAGGABLE_STATE_KEYS.filter(f => f.id === 'radius' || f.id === 'theta');
        }
        return DRAGGABLE_STATE_KEYS.filter(f => f.id === 'columns' || f.id === 'rows');
    }, [geoms[0]])
    return <div>
        {
            channels.map((dkey, i) => <FieldListContainer name={dkey.id} key={dkey.id} style={i === 0 ? firstChannelStyle : undefined}>
                <Droppable droppableId={dkey.id} direction="horizontal">
                    {(provided, snapshot) => (
                        <OBFieldContainer dkey={dkey} provided={provided} />
                    )}
                </Droppable>
            </FieldListContainer>)
        }
    </div>
}

export default observer(PosFields);