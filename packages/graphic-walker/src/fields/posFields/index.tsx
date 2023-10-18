import React, { useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { Droppable } from '@kanaries/react-beautiful-dnd';
import { useVizStore } from '../../store';
import { FieldListContainer } from '../components';
import { DRAGGABLE_STATE_KEYS } from '../fieldsContext';
import OBFieldContainer from '../obComponents/obFContainer';

import { IDraggableViewStateKey } from '../../interfaces';

const PosFields: React.FC = (props) => {
    const vizStore = useVizStore();
    const { config } = vizStore;
    const { geoms, coordSystem = 'generic' } = config;

    const channels = useMemo(() => {
        if (coordSystem === 'geographic') {
            if (geoms[0] === 'choropleth') {
                return DRAGGABLE_STATE_KEYS.filter((f) => f.id === 'geoId') as IDraggableViewStateKey[];
            }
            return DRAGGABLE_STATE_KEYS.filter((f) => f.id === 'longitude' || f.id === 'latitude') as IDraggableViewStateKey[];
        }
        if (geoms[0] === 'arc') {
            return DRAGGABLE_STATE_KEYS.filter((f) => f.id === 'radius' || f.id === 'theta') as IDraggableViewStateKey[];
        }
        return DRAGGABLE_STATE_KEYS.filter((f) => f.id === 'columns' || f.id === 'rows') as IDraggableViewStateKey[];
    }, [geoms[0], coordSystem]);
    return (
        <div>
            {channels.map((dkey, i) => (
                <FieldListContainer name={dkey.id} key={dkey.id}>
                    <Droppable droppableId={dkey.id} direction="horizontal">
                        {(provided, snapshot) => <OBFieldContainer dkey={dkey} provided={provided} />}
                    </Droppable>
                </FieldListContainer>
            ))}
        </div>
    );
};

export default observer(PosFields);
