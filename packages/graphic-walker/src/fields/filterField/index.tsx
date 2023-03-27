import { observer } from 'mobx-react-lite';
import React from 'react';
import { useGlobalStore } from '../../store';
import { FilterFieldContainer, FilterFieldsContainer } from '../components';
import { useFieldDrop } from '../../utils/dnd.config';
import FilterPill from './filterPill';
import FilterEditDialog from './filterEditDialog';


interface FieldContainerProps {}

const FilterItemContainer: React.FC<FieldContainerProps> = observer(() => {
    const { vizStore } = useGlobalStore();
    const { draggableFieldState: { filters } } = vizStore;

    const [{}, drop] = useFieldDrop('filters');

    return (
        <FilterFieldsContainer
            ref={drop}
        >
            {filters.map((f, index) => (
                <FilterPill
                    key={f.dragId}
                    fIndex={index}
                />
            ))}
            <FilterEditDialog />
        </FilterFieldsContainer>
    );
});

const FilterField: React.FC = () => {
    return (
        <FilterFieldContainer>
            <FilterItemContainer />
        </FilterFieldContainer>
    );
};

export default FilterField;