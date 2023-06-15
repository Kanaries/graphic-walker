import { observer } from 'mobx-react-lite';
import React from 'react';
import {
    Draggable,
    Droppable, DroppableProvided,
} from "@kanaries/react-beautiful-dnd";

import { useGlobalStore } from '../../store';
import { FilterFieldContainer, FilterFieldsContainer } from '../components';
import type { IGWDataLoader } from '../../dataLoader';
import FilterPill from './filterPill';
import FilterEditDialog from './filterEditDialog';


interface FieldContainerProps {
    provided: DroppableProvided;
    dataLoader: IGWDataLoader;
}

const FilterItemContainer: React.FC<FieldContainerProps> = observer(({ provided, dataLoader }) => {
    const { vizStore } = useGlobalStore();
    const { draggableFieldState: { filters } } = vizStore;

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
            <FilterEditDialog dataLoader={dataLoader} />
        </FilterFieldsContainer>
    );
});

const FilterField: React.FC<{ dataLoader: IGWDataLoader }> = ({ dataLoader }) => {
    return (
        <div>
            <FilterFieldContainer>
                <Droppable droppableId="filters" direction="vertical">
                    {(provided, snapshot) => (
                        <FilterItemContainer
                            provided={provided}
                            dataLoader={dataLoader}
                        />
                    )}
                </Droppable>
            </FilterFieldContainer>
        </div>
    );
};

export default FilterField;