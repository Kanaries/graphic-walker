import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

import type { IFilterField, IFilterRule, IFieldStats, IMutField, IComputationFunction } from '../../interfaces';
import { useCompututaion } from '../../store';
import LoadingLayer from '../../components/loadingLayer';
import { fieldStat, getTemporalRange, withComputedField } from '../../computation';
import Slider from './slider';
import { getFilterMeaAggKey, formatDate } from '../../utils';
import { useVirtualizer } from '@tanstack/react-virtual';
import { newOffsetDate } from '../../lib/op/offset';

export type RuleFormProps = {
    rawFields: IMutField[];
    field: IFilterField;
    onChange: (rule: IFilterRule) => void;
    displayOffset?: number;
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
    display: flex;
    flex-direction: column;
    max-height: 30vh;
    overflow-y: scroll;
`;

const TableRow = styled.div`
    display: flex;
    & > input,
    & > *[for] {
        cursor: pointer;
    }
    & > * {
        padding-block: 0.6em;
        padding-inline: 0.2em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        user-select: none;
        border-bottom: 0.8px solid rgb(226 232 240);
        flex-shink: 0;
    }
    & > *:first-child {
        width: 4em;
    }
    & > *:last-child {
        width: max-content;
    }
    & > *:first-child + * {
        flex: 1;
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

const useFieldStats = (
    field: IFilterField,
    attributes: { values: boolean; range: boolean; valuesMeta?: boolean; selectedCount?: Set<string | number>; displayOffset: number | undefined },
    sortBy: 'value' | 'value_dsc' | 'count' | 'count_dsc' | 'none',
    computation: IComputationFunction,
    allFields: IMutField[]
): IFieldStats | null => {
    const { values, range, valuesMeta, selectedCount, displayOffset } = attributes;
    const { fid } = field;
    const [loading, setLoading] = React.useState(true);
    const [stats, setStats] = React.useState<IFieldStats | null>(null);

    const fieldStatKey = getFilterMeaAggKey(field);

    React.useEffect(() => {
        setLoading(true);
        let isCancelled = false;
        fieldStat(computation, field, { values, range, valuesMeta, sortBy, selectedCount, timezoneDisplayOffset: displayOffset }, allFields)
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
    }, [fieldStatKey, computation, values, range, valuesMeta, sortBy, selectedCount]);

    return loading ? null : stats;
};

const PAGE_SIZE = 20;
const emptyArray = [];
type RowCount = {
    value: string | number;
    count: number;
};

function putDataInArray<T>(arr: T[], dataToPut: T[], fromIndex: number, emptyFill: T) {
    const putin = (array: T[]) =>
        array.map((x, i) => {
            const targetIndex = i - fromIndex;
            if (targetIndex >= 0 && targetIndex < dataToPut.length) {
                return dataToPut[targetIndex];
            }
            return x;
        });

    const requiredLength = dataToPut.length + fromIndex;
    if (arr.length >= requiredLength) {
        return putin(arr);
    }
    const filledArray = arr.concat(new Array<T>(requiredLength - arr.length).fill(emptyFill));
    return putin(filledArray);
}

const useVisualCount = (
    field: IFilterField,
    sortBy: 'value' | 'value_dsc' | 'count' | 'count_dsc' | 'none',
    computation: IComputationFunction,
    onChange: (rule: IFilterRule) => void,
    allFields: IMutField[],
    displayOffset: number | undefined
) => {
    // fetch metaData of filter field, only fetch once per fid.
    const initRuleValue = useMemo(
        () => (field.rule?.type === 'not in' || field.rule?.type === 'one of' ? field.rule.value : new Set<string | number>()),
        [field.fid, computation]
    );
    const metaData = useFieldStats(
        field,
        { values: false, range: false, selectedCount: initRuleValue, valuesMeta: true, displayOffset },
        'none',
        computation,
        allFields
    );
    // sum of count of rule.
    const [selectedValueSum, setSelectedValueSum] = useState(0);
    useEffect(() => {
        if (metaData) {
            setSelectedValueSum(metaData.selectedCount);
        }
    }, [metaData]);

    // unfetched RowCount will be null
    const [loadedPageData, setLoadedPageDataRaw] = useState<(RowCount | null)[]>(emptyArray);
    const loadedRef = useRef(loadedPageData);
    const setLoadedPageData = useCallback((data: (RowCount | null)[] | ((prev: (RowCount | null)[]) => (RowCount | null)[])) => {
        if (typeof data === 'function') {
            loadedRef.current = data(loadedRef.current);
        } else {
            loadedRef.current = data;
        }
        setLoadedPageDataRaw(loadedRef.current);
    }, []);

    const loadingRef = useRef<Record<number, Promise<any>>>({});
    // load actual RowCount when encounter null in data, fetch by its page.
    const loadData = useCallback(
        (index: number) => {
            const page = Math.floor(index / PAGE_SIZE);
            if (loadedRef.current.length <= index || loadedRef.current[index] === null) {
                if (loadingRef.current[page] === undefined) {
                    const promise = fieldStat(
                        computation,
                        field,
                        {
                            range: false,
                            values: true,
                            valuesMeta: false,
                            sortBy,
                            valuesLimit: PAGE_SIZE,
                            valuesOffset: PAGE_SIZE * page,
                            timezoneDisplayOffset: displayOffset,
                        },
                        allFields
                    );
                    loadingRef.current[page] = promise;
                    promise.then((stats) => {
                        // check that the list is not cleared
                        if (loadingRef.current[page] === promise) {
                            const { values } = stats;
                            setLoadedPageData((data) => putDataInArray(data, values, page * PAGE_SIZE, null));
                        }
                    });
                }
                // already fetching, skip
            }
        },
        [computation, sortBy, allFields]
    );
    // clear data when field or sort changes
    useEffect(() => {
        loadingRef.current = {};
        setLoadedPageData(emptyArray);
    }, [field.fid, computation, sortBy]);

    useEffect(() => {
        loadData(0);
    }, []);

    const data = useMemo(() => {
        if (!metaData?.valuesMeta.distinctTotal) return [];
        return loadedPageData.concat(new Array<null>(Math.max(metaData.valuesMeta.distinctTotal - loadedPageData.length, 0)).fill(null));
    }, [loadedPageData, metaData?.valuesMeta.distinctTotal]);

    const currentCount =
        field.rule?.type === 'one of'
            ? field.rule.value.size
            : metaData && field.rule?.type === 'not in'
            ? metaData.valuesMeta.distinctTotal - field.rule.value.size
            : 0;

    const currentSum =
        field.rule?.type === 'one of' ? selectedValueSum : metaData && field.rule?.type === 'not in' ? metaData.valuesMeta.total - selectedValueSum : 0;

    const handleToggleFullOrEmptySet = useCallback(() => {
        if (!field.rule || (field.rule.type !== 'one of' && field.rule.type !== 'not in') || !metaData) return;
        setSelectedValueSum(0);
        onChange({
            type: currentCount === metaData.valuesMeta.distinctTotal ? 'one of' : 'not in',
            value: new Set(),
        });
    }, [field.rule, onChange, metaData]);
    const handleToggleReverseSet = useCallback(() => {
        if (!field.rule || (field.rule.type !== 'one of' && field.rule.type !== 'not in') || !metaData) return;
        onChange({
            type: field.rule.type === 'one of' ? 'not in' : 'one of',
            value: field.rule.value,
        });
    }, [field.rule, onChange, metaData]);
    const handleSelect = useCallback(
        (value: string | number, checked: boolean, itemNum: number) => {
            if (!field.rule || (field.rule.type !== 'one of' && field.rule.type !== 'not in')) return;
            const newValue = new Set(field.rule.value);
            if (checked === (field.rule.type === 'one of')) {
                setSelectedValueSum((x) => x + itemNum);
                newValue.add(value);
            } else {
                setSelectedValueSum((x) => x - itemNum);
                newValue.delete(value);
            }
            onChange({
                type: field.rule.type,
                value: newValue,
            });
        },
        [field.rule, onChange]
    );

    return {
        total: metaData?.valuesMeta.total,
        distinctTotal: metaData?.valuesMeta.distinctTotal,
        currentCount,
        currentSum,
        handleToggleFullOrEmptySet,
        handleToggleReverseSet,
        handleSelect,
        data,
        loadData,
        loading: !metaData,
    };
};

const Effecter = (props: { effect: () => void; effectId: any }) => {
    useEffect(() => {
        props.effect();
    }, [props.effectId]);
    return null;
};

export const FilterOneOfRule: React.FC<RuleFormProps & { active: boolean }> = ({ active, field, onChange, rawFields, displayOffset }) => {
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

    React.useEffect(() => {
        if (active && field.rule?.type !== 'one of' && field.rule?.type !== 'not in') {
            onChange({
                type: 'not in',
                value: new Set(),
            });
        }
    }, [active, onChange, field]);

    const { currentCount, currentSum, data, distinctTotal, handleSelect, handleToggleFullOrEmptySet, handleToggleReverseSet, loadData, loading } =
        useVisualCount(field, `${sortConfig.key}${sortConfig.ascending ? '' : '_dsc'}`, computation, onChange, rawFields, displayOffset);

    const parentRef = React.useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: distinctTotal ?? 0,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 32,
        overscan: 10,
    });

    if (loading) {
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

    return field.rule?.type === 'one of' || field.rule?.type === 'not in' ? (
        <Container>
            <div>{t('constant.filter_type.one_of')}</div>
            <div className="text-gray-500 dark:text-gray-300">{t('constant.filter_type.one_of_desc')}</div>
            <div className="btn-grp">
                <Button className="dark:bg-zinc-900 dark:text-gray-200 dark:hover:bg-gray-800" onClick={() => handleToggleFullOrEmptySet()}>
                    {currentCount === distinctTotal ? t('filters.btn.unselect_all') : t('filters.btn.select_all')}
                </Button>
                <Button className="dark:bg-zinc-900 dark:text-gray-200 dark:hover:bg-gray-800" onClick={() => handleToggleReverseSet()}>
                    {t('filters.btn.reverse')}
                </Button>
            </div>
            <Table className="bg-slate-50 dark:bg-gray-800">
                <TableRow>
                    <div className="flex justify-center items-center">
                        <StatusCheckbox currentNum={currentCount} totalNum={distinctTotal ?? 0} onChange={handleToggleFullOrEmptySet} />
                    </div>
                    <label className="header text-gray-500 dark:text-gray-300 flex items-center">
                        {t('filters.header.value')}
                        <SortButton currentKey="value" />
                    </label>
                    <label className="header text-gray-500 dark:text-gray-300 flex items-center">
                        {t('filters.header.count')}
                        <SortButton currentKey="count" />
                    </label>
                </TableRow>
            </Table>
            {/* <hr /> */}
            <Table ref={parentRef}>
                <div
                    style={{
                        paddingBottom: `${rowVirtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}
                >
                    {rowVirtualizer.getVirtualItems().map((vItem) => {
                        const idx = vItem.index;
                        const item = data?.[idx];
                        if (!item) {
                            return (
                                <TableRow
                                    key={idx}
                                    className="animate-pulse"
                                    style={{
                                        height: `${vItem.size}px`,
                                        transform: `translateY(${vItem.start}px)`,
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                    }}
                                >
                                    <div className="flex justify-center items-center">
                                        <div className="h-4 w-4 bg-slate-200 rounded"></div>
                                    </div>
                                    <div className="flex justify-left items-center">
                                        <div className="h-3 w-20 bg-slate-200 rounded"></div>
                                    </div>
                                    <div className="flex justify-right items-center">
                                        <div className="h-3 w-6 bg-slate-200 rounded"></div>
                                    </div>
                                    <Effecter
                                        effect={() => loadData(idx)}
                                        effectId={`${field.fid}_${sortConfig.key}${sortConfig.ascending ? '' : '_dsc'}_${idx}`}
                                    />
                                </TableRow>
                            );
                        }
                        const { value, count } = item;
                        const id = `rule_checkbox_${idx}`;
                        const checked =
                            (field.rule?.type === 'one of' && field.rule.value.has(value)) || (field.rule?.type === 'not in' && !field.rule.value.has(value));
                        const displayValue =
                            field.semanticType === 'temporal' ? formatDate(newOffsetDate(displayOffset)(newOffsetDate(field.offset)(value))) : `${value}`;
                        return (
                            <TableRow
                                key={idx}
                                style={{
                                    height: `${vItem.size}px`,
                                    transform: `translateY(${vItem.start}px)`,
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                }}
                            >
                                <div className="flex justify-center items-center">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                        checked={checked}
                                        id={id}
                                        aria-describedby={`${id}_label`}
                                        title={displayValue}
                                        onChange={({ target: { checked } }) => handleSelect(value, checked, count)}
                                    />
                                </div>
                                <label id={`${id}_label`} htmlFor={id} title={displayValue}>
                                    {displayValue}
                                </label>
                                <label htmlFor={id}>{count}</label>
                            </TableRow>
                        );
                    })}
                </div>
            </Table>
            <Table className="text-gray-600">
                <TableRow>
                    <label></label>
                    <label>{t('filters.selected_keys', { count: currentCount })}</label>
                    <label>{currentSum}</label>
                </TableRow>
            </Table>
        </Container>
    ) : null;
};

interface CalendarInputProps {
    min: number;
    max: number;
    displayOffset?: number;
    value: number;
    onChange: (value: number) => void;
}

export const CalendarInput: React.FC<CalendarInputProps> = (props) => {
    const { min, max, value, onChange, displayOffset } = props;
    const dateStringFormatter = (timestamp: number) => {
        const date = newOffsetDate(displayOffset)(timestamp);
        if (Number.isNaN(date.getTime())) return '';
        return formatDate(date);
    };
    const handleSubmitDate = (value: string) => {
        const timestamp = newOffsetDate(displayOffset)(value).getTime();
        if (timestamp <= max && timestamp >= min) {
            onChange(timestamp);
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

export const FilterTemporalRangeRule: React.FC<RuleFormProps & { active: boolean }> = ({ active, field, rawFields, onChange, displayOffset }) => {
    const { t } = useTranslation('translation');

    const computationFunction = useCompututaion();

    const [res, setRes] = useState<[number, number, string, boolean]>(() => [0, 0, '', false]);

    React.useEffect(() => {
        withComputedField(field, rawFields, computationFunction, { timezoneDisplayOffset: displayOffset })((service) =>
            getTemporalRange(service, field.fid, field.offset)
        ).then(([min, max, format]) => setRes([min, max, format, true]));
    }, [field.fid]);

    const [min, max, format, loaded] = res;

    const offset = field.offset ?? new Date().getTimezoneOffset();

    React.useEffect(() => {
        if (active && field.rule?.type !== 'temporal range' && loaded) {
            onChange({
                type: 'temporal range',
                value: [min, max],
                format,
                offset,
            });
        }
    }, [onChange, field, min, max, format, offset, active]);

    const handleChange = React.useCallback(
        (value: readonly [number, number]) => {
            onChange({
                type: 'temporal range',
                value,
                format,
                offset,
            });
        },
        [format, offset]
    );

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
                        displayOffset={displayOffset}
                        min={min}
                        max={field.rule.value[1]}
                        value={field.rule.value[0]}
                        onChange={(value) => handleChange([value, field.rule?.value[1]])}
                    />
                </div>
                <div className="calendar-input">
                    <div className="my-1">{t('filters.range.end_value')}</div>
                    <CalendarInput
                        displayOffset={displayOffset}
                        min={field.rule.value[0]}
                        max={max}
                        value={field.rule.value[1]}
                        onChange={(value) => handleChange([field.rule?.value[0], value])}
                    />
                </div>
            </CalendarInputContainer>
        </Container>
    ) : null;
};

export const FilterRangeRule: React.FC<RuleFormProps & { active: boolean }> = ({ active, field, onChange, rawFields, displayOffset }) => {
    const { t } = useTranslation('translation', { keyPrefix: 'constant.filter_type' });
    const computation = useCompututaion();

    const stats = useFieldStats(field, { values: false, range: true, valuesMeta: false, displayOffset }, 'none', computation, rawFields);
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
};

const filterTabs: Record<IFilterRule['type'], React.FC<RuleFormProps & { active: boolean }>> = {
    'one of': FilterOneOfRule,
    'not in': FilterOneOfRule,
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

const getType = (type?: 'range' | 'temporal range' | 'one of' | 'not in') => {
    if (type === 'not in') {
        return 'one of';
    }
    return type;
};

const Tabs: React.FC<TabsProps> = ({ rawFields, field, onChange, tabs, displayOffset }) => {
    const { t } = useTranslation('translation', { keyPrefix: 'constant.filter_type' });

    const [which, setWhich] = React.useState(getType(field.rule?.type) ?? tabs[0]!);
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
                            <Component displayOffset={displayOffset} field={field} onChange={onChange} active={which === tab} rawFields={rawFields} />
                        </TabItem>
                    );
                })}
            </TabPanel>
        </TabsContainer>
    );
};

export default Tabs;
