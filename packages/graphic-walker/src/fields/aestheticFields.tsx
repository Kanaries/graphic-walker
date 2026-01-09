import React, { useMemo } from 'react';
import { Droppable } from '@kanaries/react-beautiful-dnd';
import { DRAGGABLE_STATE_KEYS } from './fieldsContext';
import { AestheticFieldContainer } from './components';
import SingleEncodeEditor from './encodeFields/singleEncodeEditor';
import { observer } from 'mobx-react-lite';
import { useVizStore } from '../store';
import MultiEncodeEditor from './encodeFields/multiEncodeEditor';
import { GLOBAL_CONFIG } from '../config';
import type { AgentEncodingChannel } from '../interfaces';
import { buildEncodingChannelTargetId } from '../agent/targets';
import { useHoverEmitter } from '../agent/useHoverEmitter';

type aestheticFields = 'color' | 'opacity' | 'size' | 'shape' | 'details' | 'text';

const aestheticFields = DRAGGABLE_STATE_KEYS.filter((f) => ['color', 'opacity', 'size', 'shape', 'details', 'text'].includes(f.id)) as {
    id: aestheticFields;
    mode: 0 | 1;
}[];

const AestheticFields: React.FC = (props) => {
    const vizStore = useVizStore();
    const { config } = vizStore;
    const { geoms } = config;
    const emitHover = useHoverEmitter();
    const instanceId = vizStore.instanceID;
    const visId = vizStore.currentVis.visId;

    const channels = useMemo(() => {
        switch (geoms[0]) {
            case 'bar':
            case 'tick':
            case 'arc':
            case 'line':
            case 'area':
            case 'boxplot':
                return aestheticFields.filter((f) => f.id !== 'shape');
            case 'text':
                return aestheticFields.filter((f) => f.id === 'text' || f.id === 'color' || f.id === 'size' || f.id === 'opacity');
            case 'table':
                return [];
            case 'poi':
                return aestheticFields.filter((f) => f.id === 'color' || f.id === 'opacity' || f.id === 'size' || f.id === 'details');
            case 'choropleth':
                return aestheticFields.filter((f) => f.id === 'color' || f.id === 'opacity' || f.id === 'text' || f.id === 'details');
            default:
                return aestheticFields.filter((f) => f.id !== 'text');
        }
    }, [geoms[0]]);

    return (
        <div>
            {channels.map((dkey, i, { length }) => {
                const channelId = dkey.id as AgentEncodingChannel;
                const targetId = buildEncodingChannelTargetId(instanceId, visId, channelId);
                const channelMeta = { channel: dkey.id };
                if (GLOBAL_CONFIG.CHANNEL_LIMIT[dkey.id] === 1) {
                    return (
                        <AestheticFieldContainer
                            name={dkey.id}
                            key={dkey.id}
                            style={{ position: 'relative' }}
                            agentTargetId={targetId}
                            onPointerEnter={() => emitHover('enter', targetId, 'encoding-channel', channelMeta)}
                            onPointerLeave={() => emitHover('leave', targetId, 'encoding-channel', channelMeta)}
                        >
                            <Droppable droppableId={dkey.id} direction="horizontal">
                                {(provided, snapshot) => <SingleEncodeEditor dkey={dkey} provided={provided} snapshot={snapshot} />}
                            </Droppable>
                        </AestheticFieldContainer>
                    );
                } else {
                    return (
                        <AestheticFieldContainer
                            name={dkey.id}
                            key={dkey.id}
                            style={{ position: 'relative' }}
                            agentTargetId={targetId}
                            onPointerEnter={() => emitHover('enter', targetId, 'encoding-channel', channelMeta)}
                            onPointerLeave={() => emitHover('leave', targetId, 'encoding-channel', channelMeta)}
                        >
                            <Droppable droppableId={dkey.id} direction="vertical">
                                {(provided, snapshot) => <MultiEncodeEditor dkey={dkey} provided={provided} snapshot={snapshot} />}
                            </Droppable>
                        </AestheticFieldContainer>
                    );
                }
            })}
        </div>
    );
};

export default observer(AestheticFields);
