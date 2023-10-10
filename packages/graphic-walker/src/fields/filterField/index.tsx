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


interface FieldContainerProps {
    provided: DroppableProvided;
}

const FilterItemContainer: React.FC<FieldContainerProps> = observer(({ provided }) => {
    const vizStore = useVizStore();
    const { viewFilters: filters } = vizStore;

    return (
        <FilterFieldsContainer
            {...provided.droppableProps}
            ref={provided.innerRef}
        >
            {filters.map((f, index) => (
                <Draggable key={f.dragId} draggableId={f.dragId} index={index}>
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