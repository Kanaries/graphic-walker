import { observer } from 'mobx-react-lite';
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styled, { createGlobalStyle } from 'styled-components';

import type { IFilterField, IFilterRule } from '../../interfaces';
import { useGlobalStore } from '../../store';
import PureTabs from '../../components/tabs/defaultTab';
import Slider from './slider';

import { format } from 'date-fns';

export type RuleFormProps = {
    field: IFilterField;
    onChange: (rule: IFilterRule) => void;
};

const Container = styled.div({
    marginBlock: '1em',

    '> .btn-grp': {
        display: 'flex',
        flexDirection: 'row',
        marginBlock: '1em',

        '> *': {
            marginInlineStart: '0.6em',

            '&:first-child': {
                marginInlineStart: 0,
            },
        },
    },
});

export const Button = styled.button({
    '&:hover': {
        backgroundColor: 'rgba(243, 244, 246, 0.5)',
    },
    color: 'rgb(55, 65, 81)',
    // boxShadow: '1px 1px 2px #0002, inset 2px 2px 4px #0001',
    border: '1px solid rgb(226 232 240)',
    borderRadius: '0.5em',
    paddingBlock: '0.4em',
    paddingInline: '1em',
    userSelect: 'none',
    fontWeight: 'bold',
    cursor: 'pointer',
});

const Table = styled.div({
    display: 'grid',
    gridTemplateColumns: '4em auto max-content',
    maxHeight: '30vh',
    overflowY: 'scroll',
    '& > *': {
        paddingBlock: '0.6em',
        paddingInline: '0.2em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        userSelect: 'none',
        borderBottom: '0.8px solid rgb(226 232 240)',
    },
    '& > input, & > *[for]': {
        cursor: 'pointer',
    },
});

const TabsContainer = styled.div({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'stretch',
});

const CalendarInputContainer = styled.div({
    display: 'flex',
    paddingBlock: '1em',
    width: '100%',

    '> .calendar-input': {
        width: '100%'
    },
    '> .calendar-input:first-child': {
        marginRight: '0.5em'
    },
    '> .calendar-input:last-child': {
        marginLeft: '0.5em'
    }
});

const TabPanel = styled.div({});

const TabItem = styled.div({});

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

    const { t } = useTranslation('translation', { keyPrefix: 'filters' });
    const { t: t_filter_type } = useTranslation('translation', { keyPrefix: 'constant.filter_type' });

    const headerCheckboxRef = useRef(null);

    React.useEffect(() => {
        if (active && field.rule?.type !== 'one of') {
            onChange({
                type: 'one of',
                value: new Set<string | number>(count.keys()),
            });
        }
    }, [active, onChange, field, count]);

    React.useEffect(() => {
        if (!headerCheckboxRef.current || field.rule?.type !== 'one of') return;
        const headerCheckboxRefDOM = (headerCheckboxRef.current as HTMLInputElement)
        if (field?.rule?.value.size === count.size) {
            headerCheckboxRefDOM.checked = true;
            headerCheckboxRefDOM.indeterminate = false;
        } else if (field?.rule?.value.size < count.size && field?.rule?.value.size > 0) {
            headerCheckboxRefDOM.indeterminate = true;
        } else if (field?.rule?.value.size === 0) {
            headerCheckboxRefDOM.checked = false;
            headerCheckboxRefDOM.indeterminate = false;
        }
    }, [field?.rule?.value])

    return field.rule?.type === 'one of' ? (
        <Container>
            <div>{t_filter_type('one_of')}</div>
            <div className="text-gray-500">{t_filter_type('one_of_desc')}</div>
            <div className="btn-grp">
                <Button
                    onClick={() => {
                        if (field.rule?.type === 'one of') {
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
                    }}
                >
                    {
                        field.rule.value.size === count.size
                            ? t('btn.unselect_all')
                            : t('btn.select_all')
                    }
                </Button>
                <Button
                    onClick={() => {
                        if (field.rule?.type === 'one of') {
                            const curSet = field.rule.value;

                            onChange({
                                type: 'one of',
                                value: new Set<number | string>(
                                    [...count.keys()].filter(key => !curSet.has(key))
                                ),
                            });
                        }
                    }}
                >
                    {t('btn.reverse')}
                </Button>
            </div>
            <Table className="bg-slate-50">
                <div className="flex justify-center items-center">
                    <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                        ref={headerCheckboxRef}
                        onChange={(e) => {
                            if (field.rule?.type === 'one of') {
                                const curSet = field.rule.value;
                                onChange({
                                    type: 'one of',
                                    value: new Set<number | string>(
                                        !e.target.checked
                                            ? []
                                            : count.keys()
                                    ),
                                });
                            }
                        }}
                    />
                </div>
                <label className="header text-gray-500">
                    {t('header.value')}
                </label>
                <label className="header text-gray-500">
                    {t('header.count')}
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
                                        onChange={({ target: { checked } }) => {
                                            if (field.rule?.type !== 'one of') {
                                                return;
                                            }
                                            
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
                                        }}
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
                    {t('selected_keys', { count: field.rule.value.size })}
                </label>
                <label>
                    {[...field.rule.value].reduce<number>((sum, key) => {
                        const s = dataSource.filter(which => which[field.fid] === key).length;

                        return sum + s;
                    }, 0)}
                </label>
            </Table>
        </Container>
    ) : null;
});

export const FilterTemporalRangeRule: React.FC<RuleFormProps & { active: boolean }> = observer(({
    active,
    field,
    onChange,
}) => {
    const { commonStore } = useGlobalStore();
    const { currentDataset: { dataSource } } = commonStore;

    const { t } = useTranslation('translation', { keyPrefix: 'filters' });
    const { t: t_filter_type } = useTranslation('translation', { keyPrefix: 'constant.filter_type' });

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

    const dateStringFormatter = (timestamp: number) => {
        return format(new Date(timestamp), "yyyy-MM-dd'T'HH:mm:ss")
    }

    return field.rule?.type === 'temporal range' ? (
        <Container className="overflow-visible">
            <div>{t_filter_type('temporal_range')}</div>
            <div className="text-gray-500">{t_filter_type('temporal_range_desc')}</div>
            <CalendarInputContainer>
                <div className="calendar-input">
                    <div className="my-1">{t('range.start_value')}</div>
                    <input
                        className="block w-full rounded-md border-0 py-1 px-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        type="datetime-local" 
                        id="birthdaytime" 
                        name="birthdaytime"
                        min={dateStringFormatter(min)}
                        max={dateStringFormatter(max)}
                        defaultValue={field.rule.value[0] ? dateStringFormatter(field.rule.value[0]) : dateStringFormatter(min)}
                        onChange={(e) => {
                            if (new Date(e.target.value).getTime() <= max && new Date(e.target.value).getTime() >= min) {
                                handleChange([new Date(e.target.value).getTime(), field.rule?.value[1]])
                            }
                        }}
                    />
                </div>
                <div className="calendar-input">
                    <div className="my-1">{t('range.end_value')}</div>
                    <input
                        className="block w-full rounded-md border-0 py-1 px-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        type="datetime-local" 
                        id="birthdaytime" 
                        name="birthdaytime"
                        min={dateStringFormatter(min)}
                        max={dateStringFormatter(max)}
                        defaultValue={field.rule.value[1] ? dateStringFormatter(field.rule.value[1]) : dateStringFormatter(max)}
                        onChange={(e) => {
                            if (new Date(e.target.value).getTime() <= max && new Date(e.target.value).getTime() >= min) {
                                handleChange([field.rule?.value[0], new Date(e.target.value).getTime()])
                            }
                        }}
                    />
                </div>
            </CalendarInputContainer>

                {/* <CalendarSelect 
                    mode="single"
                    max={max}
                    min={min}
                    today={min}
                    value={field.rule.value[0]}
                    onChange={(value) => handleChange([value, field?.rule?.value[1]])}
                />
                <CalendarSelect 
                    mode="single"
                    max={max}
                    min={min}
                    today={max}
                    value={field.rule.value[1]}
                    onChange={(value) => handleChange([field?.rule?.value[0], value])}
                /> */}
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

export interface TabsProps extends RuleFormProps {
    tabs: IFilterRule['type'][];
}

const Tabs: React.FC<TabsProps> = observer(({ field, onChange, tabs }) => {
    const { vizStore } = useGlobalStore();
    const { draggableFieldState } = vizStore;

    const { t } = useTranslation('translation', { keyPrefix: 'constant.filter_type' });

    const [which, setWhich] = React.useState(field.rule?.type ?? tabs[0]!);
    React.useEffect(() => {
        setWhich(field.rule?.type ?? tabs[0]!);
    }, [field.fid])
    
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
                                        {t(option.replaceAll(/ /g, '_'))}
                                    </label>
                                    <div className="text-gray-500">
                                        {t(`${option.replaceAll(/ /g, '_')}_desc`)}
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
                                id={`filter-panel-${tab.replaceAll(/ /g, '_')}`}
                                aria-labelledby={`filter-tab-${tab.replaceAll(/ /g, '_')}`}
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
