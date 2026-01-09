import { observer } from 'mobx-react-lite';
import React from 'react';
import {
    Draggable,
    Droppable, DroppableProvided,
} from "@kanaries/react-beautiful-dnd";

import { useVizStore } from '../../store';
import { FilterFieldContainer, FilterFieldsContainer } from '../components';
import FilterPill from './filterPill';
import FilterEditDialog from './filterEditDialog';
import { refMapper } from '../fieldsContext';
import { getFieldIdentifier } from '@/utils';
import { buildFilterChannelTargetId } from '../../agent/targets';
import { useHoverEmitter } from '../../agent/useHoverEmitter';


interface FieldContainerProps {
    provided: DroppableProvided;
}

const FilterItemContainer: React.FC<FieldContainerProps> = observer(({ provided }) => {
    const vizStore = useVizStore();
    const { viewFilters: filters } = vizStore;
    const emitHover = useHoverEmitter();
    const instanceId = vizStore.instanceID;
    const visId = vizStore.currentVis.visId;
    const channelTargetId = buildFilterChannelTargetId(instanceId, visId);
    const channelMeta = { channel: 'filters' };

    return (
        <FilterFieldsContainer
            className='touch-none'
            data-gw-target={channelTargetId}
            onPointerEnter={() => emitHover('enter', channelTargetId, 'filter-channel', channelMeta)}
            onPointerLeave={() => emitHover('leave', channelTargetId, 'filter-channel', channelMeta)}
            {...provided.droppableProps}
            ref={refMapper(provided.innerRef)}
        >
            {filters.map((f, index) => (
                <Draggable key={`filters_${index}_${getFieldIdentifier(f)}`} draggableId={`filters_${index}_${getFieldIdentifier(f)}`} index={index}>
                    {(provided, snapshot) => {
                        return (
                            <FilterPill
                                fIndex={index}
                                provided={provided}
                            />
                        );
                    }}
                </Draggable>
            ))}
            {provided.placeholder}
            <FilterEditDialog />
        </FilterFieldsContainer>
    );
});

const FilterField: React.FC = () => {
    return (
        <div>
            <FilterFieldContainer>
                <Droppable droppableId="filters" direction="vertical">
                    {(provided, snapshot) => (
                        <FilterItemContainer
                            provided={provided}
                        />
                    )}
                </Droppable>
            </FilterFieldContainer>
        </div>
    );
};

export default FilterField;