import React, { useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { Droppable } from '@kanaries/react-beautiful-dnd';
import { useVizStore } from '../../store';
import { FieldListContainer } from '../components';
import { DRAGGABLE_STATE_KEYS } from '../fieldsContext';
import OBFieldContainer from '../obComponents/obFContainer';

import type { AgentEncodingChannel, IDraggableViewStateKey } from '../../interfaces';
import { buildEncodingChannelTargetId } from '../../agent/targets';
import { useHoverEmitter } from '../../agent/useHoverEmitter';

const PosFields: React.FC = (props) => {
    const vizStore = useVizStore();
    const { config } = vizStore;
    const { geoms, coordSystem = 'generic' } = config;
    const emitHover = useHoverEmitter();
    const instanceId = vizStore.instanceID;
    const visId = vizStore.currentVis.visId;

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
            {channels.map((dkey, i) => {
                const channelId = dkey.id as AgentEncodingChannel;
                const targetId = buildEncodingChannelTargetId(instanceId, visId, channelId);
                const channelMeta = { channel: dkey.id };
                return (
                    <FieldListContainer
                        name={dkey.id}
                        key={dkey.id}
                        agentTargetId={targetId}
                        channelName={dkey.id}
                        onPointerEnter={() => emitHover('enter', targetId, 'encoding-channel', channelMeta)}
                        onPointerLeave={() => emitHover('leave', targetId, 'encoding-channel', channelMeta)}
                    >
                        <Droppable droppableId={dkey.id} direction="horizontal">
                            {(provided, snapshot) => <OBFieldContainer dkey={dkey} provided={provided} />}
                        </Droppable>
                    </FieldListContainer>
                );
            })}
        </div>
    );
};

export default observer(PosFields);
