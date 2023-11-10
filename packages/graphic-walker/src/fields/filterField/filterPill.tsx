import { observer } from 'mobx-react-lite';
import React from 'react';
import { DraggableProvided } from '@kanaries/react-beautiful-dnd';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import { PencilSquareIcon } from '@heroicons/react/24/solid';
import { useVizStore } from '../../store';
import { refMapper } from '../fieldsContext';

interface FilterPillProps {
    provided: DraggableProvided;
    fIndex: number;
}

const Pill = styled.div`
    user-select: none;
    align-items: stretch;
    border-style: solid;
    border-width: 1px;
    box-sizing: border-box;
    cursor: default;
    display: flex;
    flex-direction: column;
    font-size: 12px;
    min-width: 150px;
    overflow-y: hidden;
    padding: 0;

    > * {
        flex-grow: 1;
        padding-block: 0.2em;
        padding-inline: 0.5em;
    }

    > header {
        height: 20px;
        border-bottom-width: 1px;
    }

    > div.output {
        min-height: 20px;

        > span {
            overflow-y: hidden;
            max-height: 4em;
        }

        .icon {
            display: none;

            &:hover {
                display: unset;
            }
        }
    }
`;

const FilterPill: React.FC<FilterPillProps> = observer((props) => {
    const { provided, fIndex } = props;
    const vizStore = useVizStore();
    const { viewFilters } = vizStore;

    const field = viewFilters[fIndex];

    const { t } = useTranslation('translation', { keyPrefix: 'filters' });

    const fieldName = field.enableAgg ? `${field.aggName}(${field.name})` : field.name;

    return (
        <Pill className="text-gray-900" ref={refMapper(provided.innerRef)} {...provided.draggableProps} {...provided.dragHandleProps}>
            <header className="bg-indigo-50">{fieldName}</header>
            <div
                className="bg-white dark:bg-zinc-900  text-gray-500 hover:bg-gray-100 flex flex-row output"
                onClick={() => vizStore.setFilterEditing(fIndex)}
                style={{ cursor: 'pointer' }}
                title={t('to_edit')}
            >
                {field.rule ? (
                    <span className="flex-1">
                        {field.rule.type === 'one of'
                            ? `oneOf: [${[...field.rule.value].map((d) => JSON.stringify(d)).join(', ')}]`
                            : field.rule.type === 'range'
                            ? `range: [${field.rule.value[0]}, ${field.rule.value[1]}]`
                            : field.rule.type === 'temporal range'
                            ? `range: [${new Date(field.rule.value[0])}, ${new Date(field.rule.value[1])}]`
                            : field.rule.type === 'not in'
                            ? `notIn: [${[...field.rule.value].map((d) => JSON.stringify(d)).join(', ')}]`
                            : null}
                    </span>
                ) : (
                    <span className="text-gray-600 flex-1">{t('empty_rule')}</span>
                )}
                <PencilSquareIcon
                    className="icon flex-grow-0 flex-shrink-0 pointer-events-none text-gray-500"
                    role="presentation"
                    aria-hidden
                    width="1.4em"
                    height="1.4em"
                />
            </div>
        </Pill>
    );
});

export default FilterPill;
