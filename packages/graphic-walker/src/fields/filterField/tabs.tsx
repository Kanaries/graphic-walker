import { observer } from 'mobx-react-lite';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

import type { IFilterField, IFilterRule, IFieldStats, IField, IViewField, IMutField, IComputationFunction } from '../../interfaces';
import { useCompututaion, useVizStore } from '../../store';
import LoadingLayer from '../../components/loadingLayer';
import { fieldStat, getTemporalRange } from '../../computation';
import Slider from './slider';
import { formatDate, parseCmpFunction } from '../../utils';

export type RuleFormProps = {
    rawFields: IMutField[];
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

            &:first-child {
                margin-inline-start: 0;
            }
        }
    }
`;

export const Button = styled.button`
    :hover {
        background-color: rgba(243, 244, 246, 0.5);
    }
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

const StatusCheckbox: React.FC<{ currentNum: number; totalNum: number; onChange: () => void }> = (props) => {
    const { currentNum, totalNum, onChange } = props;
    const checkboxRef = useRef(null);

    React.useEffect(() => {
        if (!checkboxRef.current) return;
        const checkboxRefDOM = checkboxRef.current as HTMLInputElement;
        if (currentNum === totalNum) {
            checkboxRefDOM.checked = true;
            checkboxRefDOM.indeterminate = false;
        } else if (currentNum < totalNum && currentNum > 0) {
            checkboxRefDOM.indeterminate = true;
        } else if (currentNum === 0) {
            checkboxRefDOM.checked = false;
            checkboxRefDOM.indeterminate = false;
        }
    }, [currentNum, totalNum]);

    return (
        <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
            ref={checkboxRef}
            onChange={() => onChange()}
        />
    );
};

type FieldDistributionEntry = IFieldStats['values'][number];

const countCmp = (a: FieldDistributionEntry, b: FieldDistributionEntry) => {
    return a.count - b.count;
};

const useFieldStats = (
    field: IField,
    attributes: { values: boolean; range: boolean },
    sortBy: 'value' | 'value_dsc' | 'count' | 'count_dsc' | 'none',
    computation: IComputationFunction
): IFieldStats | null => {
    const { values, range } = attributes;
    const { fid, cmp: cmpRaw } = field;
    const cmp = parseCmpFunction(cmpRaw);
    const valueCmp = React.useCallback<typeof countCmp>(
        (a, b) => {
            return cmp(a.value, b.value);
        },
        [cmp]
    );
    const comparator = sortBy === 'none' ? null : sortBy.startsWith('value') ? valueCmp : countCmp;
    const sortMulti = sortBy.endsWith('dsc') ? -1 : 1;
    const [loading, setLoading] = React.useState(true);
    const [stats, setStats] = React.useState<IFieldStats | null>(null);

    React.useEffect(() => {
        setLoading(true);
        let isCancelled = false;
        fieldStat(computation, field, { values, range })
            .then((stats) => {
                if (isCancelled) {
                    return;
                }
                setStats(stats);
                setLoading(false);
            })
            .catch((reason) => {
                console.warn(reason);
                if (isCancelled) {
                    return;
                }
                setStats(null);
                setLoading(false);
            });
        return () => {
            isCancelled = true;
        };
    }, [fid, computation, values, range]);

    const sortedStats = React.useMemo<typeof stats>(() => {
        if (!stats || !comparator) {
            return stats;
        }
        const copy = { ...stats };
        copy.values = copy.values.slice().sort((a, b) => sortMulti * comparator(a, b));
        return copy;
    }, [stats, comparator, sortMulti]);

    return loading ? null : sortedStats;
};

export const FilterOneOfRule: React.FC<RuleFormProps & { active: boolean }> = observer(({ active, field, onChange }) => {
    interface SortConfig {
        key: 'value' | 'count';
        ascending: boolean;
    }
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        key: 'count',
        ascending: true,
    });

    const { t } = useTranslation('translation');

    const computation = useCompututaion();

    const stats = useFieldStats(field, { values: true, range: false }, `${sortConfig.key}${sortConfig.ascending ? '' : '_dsc'}`, computation);
    const count = stats?.values;

    React.useEffect(() => {
        if (count && active && field.rule?.type !== 'one of') {
            onChange({
                type: 'one of',
                value: new Set<string | number>(count.map((item) => item.value)),
            });
        }
    }, [active, onChange, field, count]);

    const handleToggleFullOrEmptySet = () => {
        if (!field.rule || field.rule.type !== 'one of' || !count) return;
        const curSet = field.rule.value;
        onChange({
            type: 'one of',
            value: new Set<number | string>(curSet.size === count.length ? [] : count.map((c) => c.value)),
        });
    };
    const handleToggleReverseSet = () => {
        if (!field.rule || field.rule.type !== 'one of' || !count) return;
        const curSet = field.rule.value;
        onChange({
            type: 'one of',
            value: new Set<number | string>(count.map((c) => c.value).filter((key) => !curSet.has(key))),
        });
    };
    const handleSelectValue = (value: any, checked: boolean) => {
        if (!field.rule || field.rule?.type !== 'one of') return;
        const rule: IFilterRule = {
            type: 'one of',
            value: new Set(field.rule.value),
        };
        if (checked) {
            rule.value.add(value);
        } else {
            rule.value.delete(value);
        }
        onChange(rule);
    };

    const selectedValueSum = useMemo(() => {
        if (!field.rule?.value || !count) return 0;
        return [...field.rule.value].reduce<number>((sum, key) => {
            const s = count.find((c) => c.value === key)?.count || 0;
            return sum + s;
        }, 0);
    }, [field.rule?.value, count, field.fid]);

    if (!stats) {
        return (
            <div className="h-24 w-full relative">
                <LoadingLayer />
            </div>
        );
    }

    const SortButton: React.FC<{ currentKey: SortConfig['key'] }> = ({ currentKey }) => {
        const isCurrentKey = sortConfig.key === currentKey;
        return (
            <span
                className={`ml-2 flex-none rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer ${
                    isCurrentKey ? 'text-indigo-600' : 'text-gray-500'
                }`}
                onClick={() => setSortConfig({ key: currentKey, ascending: isCurrentKey ? !sortConfig.ascending : true })}
            >
                {isCurrentKey && !sortConfig.ascending ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronUpIcon className="h-4 w-4" />}
            </span>
        );
    };

    return field.rule?.type === 'one of' ? (
        <Container>
            <div>{t('constant.filter_type.one_of')}</div>
            <div className="text-gray-500 dark:text-gray-300">{t('constant.filter_type.one_of_desc')}</div>
            <div className="btn-grp">
                <Button className="dark:bg-zinc-900 dark:text-gray-200 dark:hover:bg-gray-800" onClick={() => handleToggleFullOrEmptySet()} disabled={!count}>
                    {field.rule.value.size === count?.length ? t('filters.btn.unselect_all') : t('filters.btn.select_all')}
                </Button>
                <Button className="dark:bg-zinc-900 dark:text-gray-200 dark:hover:bg-gray-800" onClick={() => handleToggleReverseSet()}>
                    {t('filters.btn.reverse')}
                </Button>
            </div>
            <Table className="bg-slate-50 dark:bg-gray-800">
                <div className="flex justify-center items-center">
                    <StatusCheckbox currentNum={field.rule.value.size} totalNum={count?.length ?? 0} onChange={handleToggleFullOrEmptySet} />
                </div>
                <label className="header text-gray-500 dark:text-gray-300 flex items-center">
                    {t('filters.header.value')}
                    <SortButton currentKey="value" />
                </label>
                <label className="header text-gray-500 dark:text-gray-300 flex items-center">
                    {t('filters.header.count')}
                    <SortButton currentKey="count" />
                </label>
            </Table>
            {/* <hr /> */}
            <Table>
                {count?.map(({ value, count }, idx) => {
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
                            <label id={`${id}_label`} htmlFor={id} title={String(value)}>
                                {`${value}`}
                            </label>
                            <label htmlFor={id}>{count}</label>
                        </React.Fragment>
                    );
                })}
            </Table>
            <Table className="text-gray-600">
                <label></label>
                <label>{t('filters.selected_keys', { count: field.rule.value.size })}</label>
                <label>{selectedValueSum}</label>
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

export const CalendarInput: React.FC<CalendarInputProps> = (props) => {
    const { min, max, value, onChange } = props;
    const dateStringFormatter = (timestamp: number) => {
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return '';
        return formatDate(date);
    };  
    const handleSubmitDate = (value: string) => {
        if (new Date(value).getTime() <= max && new Date(value).getTime() >= min) {
            onChange(new Date(value).getTime());
        }
    };
    return (
        <input
            className="block w-full rounded-md border-0 py-1 px-2 text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 dark:bg-zinc-900 dark:border-gray-700 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
            type="datetime-local"
            min={dateStringFormatter(min)}
            max={dateStringFormatter(max)}
            defaultValue={dateStringFormatter(value)}
            onChange={(e) => handleSubmitDate(e.target.value)}
        />
    );
};

export const FilterTemporalRangeRule: React.FC<RuleFormProps & { active: boolean }> = observer(({ active, field, onChange }) => {
    const { t } = useTranslation('translation');

    const computationFunction = useCompututaion();

    const [res, setRes] = useState<[number, number, boolean]>(() => [0, 0, false]);

    React.useEffect(() => {
        getTemporalRange(computationFunction, field.fid).then(([min, max]) => setRes([min, max, true]));
    }, [field.fid]);

    const [min, max, loaded] = res;

    React.useEffect(() => {
        if (active && field.rule?.type !== 'temporal range' && loaded) {
            onChange({
                type: 'temporal range',
                value: [min, max],
            });
        }
    }, [onChange, field, min, max, active]);

    const handleChange = React.useCallback((value: readonly [number, number]) => {
        onChange({
            type: 'temporal range',
            value,
        });
    }, []);

    if (!loaded) {
        return (
            <div className="h-24 w-full relative">
                <LoadingLayer />
            </div>
        );
    }

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

export const FilterRangeRule: React.FC<RuleFormProps & { active: boolean }> = observer(({ active, field, onChange }) => {
    const { t } = useTranslation('translation', { keyPrefix: 'constant.filter_type' });
    const computation = useCompututaion();

    const stats = useFieldStats(field, { values: false, range: true }, 'none', computation);
    const range = stats?.range;

    React.useEffect(() => {
        if (range && active && field.rule?.type !== 'range') {
            onChange({
                type: 'range',
                value: range,
            });
        }
    }, [onChange, field, range, active]);

    const handleChange = React.useCallback((value: readonly [number, number]) => {
        onChange({
            type: 'range',
            value,
        });
    }, []);

    if (!range) {
        return (
            <div className="h-24 w-full relative">
                <LoadingLayer />
            </div>
        );
    }

    return field.rule?.type === 'range' ? (
        <Container>
            <div>{t('range')}</div>
            <div className="text-gray-500">{t('range_desc')}</div>
            <Slider min={range[0]} max={range[1]} value={field.rule.value} onChange={handleChange} />
        </Container>
    ) : null;
});

const filterTabs: Record<IFilterRule['type'], React.FC<RuleFormProps & { active: boolean }>> = {
    'one of': FilterOneOfRule,
    range: FilterRangeRule,
    'temporal range': FilterTemporalRangeRule,
};

const tabOptionDict = {
    'one of': {
        key: 'one_of',
        descKey: 'one_of_desc',
    },
    range: {
        key: 'range',
        descKey: 'range_desc',
    },
    'temporal range': {
        key: 'temporal_range',
        descKey: 'temporal_range_desc',
    },
};

export interface TabsProps extends RuleFormProps {
    tabs: IFilterRule['type'][];
}

const Tabs: React.FC<TabsProps> = observer(({ field, onChange, tabs }) => {
    const vizStore = useVizStore();
    const { meta } = vizStore;

    const { t } = useTranslation('translation', { keyPrefix: 'constant.filter_type' });

    const [which, setWhich] = React.useState(field.rule?.type ?? tabs[0]!);
    React.useEffect(() => {
        if (!tabs.includes(which)) setWhich(tabs[0]);
    }, [tabs]);

    return (
        <TabsContainer>
            <div>
                {tabs.map((option) => {
                    return (
                        <div className="flex my-2" key={option}>
                            <div className="align-top">
                                <input
                                    type="radio"
                                    className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                    id={option}
                                    checked={option === which}
                                    onChange={(e) => setWhich((e.target as HTMLInputElement).value as typeof which)}
                                    name="filter_type"
                                    value={option}
                                />
                            </div>
                            <div className="ml-3">
                                <label htmlFor={option}>{t(tabOptionDict[option].key)}</label>
                                <div className="text-gray-500">{t(tabOptionDict[option].descKey)}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <hr className="my-0.5" />
            <TabPanel>
                {tabs.map((tab, i) => {
                    const Component = filterTabs[tab];

                    return (
                        <TabItem
                            key={i}
                            id={`filter-panel-${tabOptionDict[tab]}`}
                            aria-labelledby={`filter-tab-${tabOptionDict[tab]}`}
                            role="tabpanel"
                            hidden={which !== tab}
                            tabIndex={0}
                        >
                            <Component field={field} onChange={onChange} active={which === tab} rawFields={meta} />
                        </TabItem>
                    );
                })}
            </TabPanel>
        </TabsContainer>
    );
});

export default Tabs;
