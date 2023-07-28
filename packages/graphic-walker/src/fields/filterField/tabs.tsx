import { observer } from 'mobx-react-lite';
import React, { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import type { IFilterField, IFilterRule } from '../../interfaces';
import { useGlobalStore } from '../../store';
import Slider from './slider';

export type RuleFormProps = {
    field: IFilterField;
    onChange: (rule: IFilterRule) => void;
};

const Container = styled.div`
    margin-block: 1em;

    > .btn-grp {
        display: flex;
        flex-direction: row;
        margin-block: 1em;

        > * {
            margin-inline-start: 0.6em;

            &:first-child: {
                margin-inline-start: 0;
            },
        },
    },
`;

export const Button = styled.button`
    :hover: {
        background-color: rgba(243, 244, 246, 0.5);
    };
    color: rgb(55, 65, 81);
    border: 1px solid rgb(226 232 240);
    border-radius: 0.5em;
    padding-block: 0.4em;
    padding-inline: 1em;
    user-select: none;
    font-weight: bold;
    cursor: pointer;
`;

const Table = styled.div`
    display: grid;
    grid-template-columns: 4em auto max-content;
    max-height: 30vh;
    overflow-y: scroll;
    
    & > * {
        padding-block: 0.6em;
        padding-inline: 0.2em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        user-select: none;
        border-bottom: 0.8px solid rgb(226 232 240);
    }

    & > input,
    & > *[for] {
        cursor: pointer;
    }
`;

const TabsContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: stretch;
`;

const CalendarInputContainer = styled.div`
    display: flex;
    padding-block: 1em;
    width: 100%;

    > .calendar-input {
        width: 100%;
    }

    > .calendar-input:first-child {
        margin-right: 0.5em;
    }

    > .calendar-input:last-child {
        margin-left: 0.5em;
    }
`;

const TabPanel = styled.div``;

const TabItem = styled.div``;

const StatusCheckbox: React.FC<{currentNum: number; totalNum: number; onChange: () => void}> = props => {
    const { currentNum, totalNum, onChange } = props;
    const checkboxRef = useRef(null);

    React.useEffect(() => {
        if (!checkboxRef.current) return;
        const checkboxRefDOM = (checkboxRef.current as HTMLInputElement)
        if (currentNum === totalNum) {
            checkboxRefDOM.checked = true;
            checkboxRefDOM.indeterminate = false;
        } else if (currentNum < totalNum && currentNum > 0) {
            checkboxRefDOM.indeterminate = true;
        } else if (currentNum === 0) {
            checkboxRefDOM.checked = false;
            checkboxRefDOM.indeterminate = false;
        }
    }, [currentNum, totalNum])

    return (
        <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
            ref={checkboxRef}
            onChange={() => onChange()}
        />
    )
}

export const FilterOneOfRule: React.FC<RuleFormProps & { active: boolean }> = observer(({
    active,
    field,
    onChange,
}) => {
    const { commonStore } = useGlobalStore();
    const { currentDataset: { dataSource } } = commonStore;

    const count = React.useMemo(() => {
        return dataSource.reduce<Map<string | number, number>>((tmp, d) => {
            const val = d[field.fid];

            tmp.set(val, (tmp.get(val) ?? 0) + 1);
            
            return tmp;
        }, new Map<string | number, number>());
    }, [dataSource, field]);

    const { t } = useTranslation('translation');

    React.useEffect(() => {
        if (active && field.rule?.type !== 'one of') {
            onChange({
                type: 'one of',
                value: new Set<string | number>(count.keys()),
            });
        }
    }, [active, onChange, field, count]);

    const handleToggleFullOrEmptySet = () => {
        if (!field.rule || field.rule.type !== 'one of') return;
        const curSet = field.rule.value;
        onChange({
            type: 'one of',
            value: new Set<number | string>(
                curSet.size === count.size
                    ? []
                    : count.keys()
            ),
        });
    }
    const handleToggleReverseSet = () => {
        if (!field.rule || field.rule.type !== 'one of') return;
        const curSet = field.rule.value;
        onChange({
            type: 'one of',
            value: new Set<number | string>(
                [...count.keys()].filter(key => !curSet.has(key))
            ),
        });    
    }
    const handleSelectValue = (value, checked) => {
        if (!field.rule || field.rule?.type !== 'one of') return;
        const rule: IFilterRule = {
            type: 'one of',
            value: new Set(field.rule.value)
        };
        if (checked) {
            rule.value.add(value);
        } else {
            rule.value.delete(value);
        }
        onChange(rule);
    }
    
    const selectedValueSum = useMemo(() => {
        if (!field.rule) return 0;
        return [...field.rule.value].reduce<number>((sum, key) => {
            const s = dataSource.filter(which => which[field.fid] === key).length;
            return sum + s;
        }, 0)
    }, [field.rule?.value])

    return field.rule?.type === 'one of' ? (
        <Container>
            <div>{t('constant.filter_type.one_of')}</div>
            <div className="text-gray-500">{t('constant.filter_type.one_of_desc')}</div>
            <div className="btn-grp">
                <Button
                    onClick={() => handleToggleFullOrEmptySet()}
                >
                    {
                        field.rule.value.size === count.size
                            ? t('filters.btn.unselect_all')
                            : t('filters.btn.select_all')
                    }
                </Button>
                <Button
                    onClick={() => handleToggleReverseSet()}
                >
                    {t('filters.btn.reverse')}
                </Button>
            </div>
            <Table className="bg-slate-50">
                <div className="flex justify-center items-center">
                    <StatusCheckbox
                        currentNum={field.rule.value.size}
                        totalNum={count.size}
                        onChange={handleToggleFullOrEmptySet}
                    />
                </div>
                <label className="header text-gray-500">
                    {t('filters.header.value')}
                </label>
                <label className="header text-gray-500">
                    {t('filters.header.count')}
                </label>
            </Table>
            {/* <hr /> */}
            <Table>
                {
                    [...count.entries()].map(([value, count], idx) => {
                        const id = `rule_checkbox_${idx}`;

                        return (
                            <React.Fragment key={idx}>
                                <div className="flex justify-center items-center">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                        checked={field.rule?.type === 'one of' && field.rule.value.has(value)}
                                        id={id}
                                        aria-describedby={`${id}_label`}
                                        title={String(value)}
                                        onChange={({ target: { checked } }) => handleSelectValue(value, checked)}
                                    />
                                </div>
                                <label
                                    id={`${id}_label`}
                                    htmlFor={id}
                                    title={String(value)}
                                >
                                    {value}
                                </label>
                                <label
                                    htmlFor={id}
                                >
                                    {count}
                                </label>
                            </React.Fragment>
                        );
                    })
                }
            </Table>
            <Table className="text-gray-600">
                <label></label>
                <label>
                    {t('filters.selected_keys', { count: field.rule.value.size })}
                </label>
                <label>
                    {selectedValueSum}
                </label>
            </Table>
        </Container>
    ) : null;
});

interface CalendarInputProps {
    min: number;
    max: number;
    value: number;
    onChange: (value: number) => void;
}

const CalendarInput: React.FC<CalendarInputProps> = props => {
    const { min, max, value, onChange } = props;
    const dateStringFormatter = (timestamp: number) => {
        return new Date(timestamp).toISOString().slice(0, 19);
    }
    const handleSubmitDate = (value) => {
        if (new Date(value).getTime() <= max && new Date(value).getTime() >= min) {
            onChange(new Date(value).getTime())
        }
    }
    return (
        <input
            className="block w-full rounded-md border-0 py-1 px-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
            type="datetime-local" 
            min={dateStringFormatter(min)}
            max={dateStringFormatter(max)}
            defaultValue={dateStringFormatter(value)}
            onChange={(e) => handleSubmitDate(e.target.value)}
        />
    )
}

export const FilterTemporalRangeRule: React.FC<RuleFormProps & { active: boolean }> = observer(({
    active,
    field,
    onChange,
}) => {
    const { commonStore } = useGlobalStore();
    const { currentDataset: { dataSource } } = commonStore;

    const { t } = useTranslation('translation');

    const sorted = React.useMemo(() => {
        return dataSource.reduce<number[]>((list, d) => {
            try {
                const time = new Date(d[field.fid]).getTime();

                list.push(time);
            } catch (error) {
                
            }
            return list;
        }, []).sort((a, b) => a - b);
    }, [dataSource, field]);

    const [min, max] = React.useMemo(() => {
        return [sorted[0] ?? 0, Math.max(sorted[sorted.length - 1] ?? 0, sorted[0] ?? 0)];
    }, [sorted]);

    React.useEffect(() => {
        if (active && field.rule?.type !== 'temporal range') {
            onChange({
                type: 'temporal range',
                value: [sorted[0] ?? 0, Math.max(sorted[sorted.length - 1] ?? 0, sorted[0] ?? 0)],
            });
        }
    }, [onChange, field, sorted, active]);

    const handleChange = React.useCallback((value: readonly [number, number]) => {
        onChange({
            type: 'temporal range',
            value,
        });
    }, []);

    return field.rule?.type === 'temporal range' ? (
        <Container className="overflow-visible">
            <div>{t('constant.filter_type.temporal_range')}</div>
            <div className="text-gray-500">{t('constant.filter_type.temporal_range_desc')}</div>
            <CalendarInputContainer>
                <div className="calendar-input">
                    <div className="my-1">{t('filters.range.start_value')}</div>
                    <CalendarInput
                        min={min}
                        max={field.rule.value[1]}
                        value={field.rule.value[0]}
                        onChange={(value) => handleChange([value, field.rule?.value[1]])}
                    />
                </div>
                <div className="calendar-input">
                    <div className="my-1">{t('filters.range.end_value')}</div>
                    <CalendarInput
                        min={field.rule.value[0]}
                        max={max}
                        value={field.rule.value[1]}
                        onChange={(value) => handleChange([field.rule?.value[0], value])}
                    />
                </div>
            </CalendarInputContainer>
        </Container>
    ) : null;
});

export const FilterRangeRule: React.FC<RuleFormProps & { active: boolean }> = observer(({
    active,
    field,
    onChange,
}) => {
    const { commonStore } = useGlobalStore();
    const { currentDataset: { dataSource } } = commonStore;

    const { t } = useTranslation('translation', { keyPrefix: 'constant.filter_type' });

    const sorted = React.useMemo(() => {
        return dataSource.map(d => d[field.fid]).sort((a, b) => a - b);
    }, [dataSource, field]);

    const [min, max] = React.useMemo(() => {
        return [sorted[0] ?? 0, Math.max(sorted[sorted.length - 1] ?? 0, sorted[0] ?? 0)];
    }, [sorted]);

    React.useEffect(() => {
        if (active && field.rule?.type !== 'range') {
            onChange({
                type: 'range',
                value: [min, max],
            });
        }
    }, [onChange, field, min, max, active]);

    const handleChange = React.useCallback((value: readonly [number, number]) => {
        onChange({
            type: 'range',
            value,
        });
    }, []);

    return field.rule?.type === 'range' ? (
        <Container>
            <div>{t('range')}</div>
            <div className="text-gray-500">{t('range_desc')}</div>
            <Slider
                min={min}
                max={max}
                value={field.rule.value}
                onChange={handleChange}
            />
        </Container>
    ) : null;
});

const filterTabs: Record<IFilterRule['type'], React.FC<RuleFormProps & { active: boolean }>> = {
    'one of': FilterOneOfRule,
    'range': FilterRangeRule,
    'temporal range': FilterTemporalRangeRule,
};

const tabOptionDict = {
    "one of": {
        key: "one_of",
        descKey: "one_of_desc"
    },
    "range": {
        key: "range",
        descKey: "range_desc"
    },
    "temporal range": {
        key: "temporal_range",
        descKey: "temporal_range_desc"
    }
};

export interface TabsProps extends RuleFormProps {
    tabs: IFilterRule['type'][];
}

const Tabs: React.FC<TabsProps> = observer(({ field, onChange, tabs }) => {
    const { vizStore } = useGlobalStore();
    const { draggableFieldState } = vizStore;

    const { t } = useTranslation('translation', { keyPrefix: 'constant.filter_type' });

    const [which, setWhich] = React.useState(field.rule?.type ?? tabs[0]!);
    React.useEffect(() => {
        if (!tabs.includes(which)) setWhich(tabs[0]);
    }, [tabs])
    
    return (
        <TabsContainer>
            <div>
                {
                    tabs.map((option) => {
                        return (
                            <div className="flex my-2" key={option}>
                                <div className="align-top">
                                    <input 
                                        type="radio"
                                        className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                        id={option}
                                        checked={option === which}
                                        onChange={e => setWhich((e.target as HTMLInputElement).value as typeof which)}
                                        name="filter_type" 
                                        value={option}
                                    />
                                </div>
                                <div className="ml-3">
                                    <label htmlFor={option}>
                                        {t(tabOptionDict[option].key)}
                                    </label>
                                    <div className="text-gray-500">
                                        {t(tabOptionDict[option].descKey)}
                                    </div>
                                </div>
                            </div>
                        )
                    })
                }
            </div>
            <hr className="my-0.5"/>
            <TabPanel>
                {
                    tabs.map((tab, i) => {
                        const Component = filterTabs[tab];

                        return draggableFieldState === null ? null : (
                            <TabItem
                                key={i}
                                id={`filter-panel-${tabOptionDict[tab]}`}
                                aria-labelledby={`filter-tab-${tabOptionDict[tab]}`}
                                role="tabpanel"
                                hidden={which !== tab}
                                tabIndex={0}
                            >
                                <Component
                                    field={field}
                                    onChange={onChange}
                                    active={which === tab}
                                />
                            </TabItem>
                        );
                    })
                }
            </TabPanel>
        </TabsContainer>
    );
});


export default Tabs;
