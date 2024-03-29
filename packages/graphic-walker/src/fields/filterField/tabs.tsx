import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

import type { IFilterField, IFilterRule, IFieldStats, IMutField, IComputationFunction, IKeyWord } from '../../interfaces';
import { useCompututaion } from '../../store';
import LoadingLayer from '../../components/loadingLayer';
import { fieldStat, getTemporalRange, withComputedField } from '../../computation';
import Slider from './slider';
import { getFilterMeaAggKey, formatDate, classNames, isNotEmpty, _unstable_encodeRuleValue } from '../../utils';
import { useVirtualizer } from '@tanstack/react-virtual';
import { newOffsetDate, parsedOffsetDate } from '../../lib/op/offset';
import { createStreamedValueHook } from '../../hooks';
import { debounce } from 'lodash-es';
import { GLOBAL_CONFIG } from '../../config';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import Tooltip from '@/components/tooltip';

export type RuleFormProps = {
    allFields: IMutField[];
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
        border-bottom: 0.8px solid hsl(var(--border));
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

const StatusCheckbox: React.FC<{ currentNum: number; totalNum: number; onChange: () => void; disabled?: boolean }> = (props) => {
    const { currentNum, totalNum, onChange } = props;

    let checked: boolean | 'indeterminate';
    if (currentNum === totalNum) {
        checked = true;
    } else if (currentNum < totalNum && currentNum > 0) {
        checked = 'indeterminate';
    } else {
        checked = false;
    }

    return <Checkbox checked={checked} disabled={props.disabled} onCheckedChange={() => onChange()} />;
};

// TODO: refactor this function
export const useFieldStats = (
    field: IFilterField,
    attributes: {
        values: boolean;
        range: boolean;
        valuesMeta?: boolean;
        selectedCount?: any[];
        displayOffset?: number;
        keyword?: IKeyWord;
    },
    sortBy: 'value' | 'value_dsc' | 'count' | 'count_dsc' | 'none',
    computation: IComputationFunction,
    allFields: IMutField[]
): [IFieldStats | null, IFieldStats | null] => {
    const { values, range, valuesMeta, selectedCount, displayOffset, keyword } = attributes;
    const [loading, setLoading] = React.useState(true);
    const [stats, setStats] = React.useState<IFieldStats | null>(null);

    const fieldStatKey = getFilterMeaAggKey(field);

    React.useEffect(() => {
        setLoading(true);
        let isCancelled = false;
        fieldStat(computation, field, { values, range, valuesMeta, sortBy, selectedCount, timezoneDisplayOffset: displayOffset, keyword }, allFields)
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
    }, [fieldStatKey, computation, values, range, valuesMeta, sortBy, selectedCount, keyword, displayOffset]);

    return [loading ? null : stats, stats];
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

export const useVisualCount = (
    field: IFilterField,
    sortBy: 'value' | 'value_dsc' | 'count' | 'count_dsc' | 'none',
    computation: IComputationFunction,
    onChange: (rule: IFilterRule) => void,
    allFields: IMutField[],
    options: {
        displayOffset: number | undefined;
        keyword?: IKeyWord;
    }
) => {
    // fetch metaData of filter field, only fetch once per fid.
    const initRuleValue = useMemo(() => (field.rule?.type === 'not in' || field.rule?.type === 'one of' ? field.rule.value : []), [field.fid, computation]);
    const [metaData] = useFieldStats(
        field,
        { values: false, range: false, selectedCount: initRuleValue, valuesMeta: true, displayOffset: options.displayOffset },
        'none',
        computation,
        allFields
    );
    const [currentMeta, lastCurrentMeta] = useFieldStats(
        field,
        { values: false, range: false, valuesMeta: true, keyword: options.keyword },
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
                            timezoneDisplayOffset: options.displayOffset,
                            keyword: options.keyword,
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
        [computation, field.fid, sortBy, allFields, options.displayOffset, options.keyword]
    );
    // clear data when field or sort changes
    useEffect(() => {
        loadingRef.current = {};
        setLoadedPageData(emptyArray);
        loadData(0);
    }, [loadData]);

    const loadingPageData = loadedPageData === emptyArray || !currentMeta;

    const data = useMemo(() => {
        if (!currentMeta?.valuesMeta.distinctTotal) return [];
        return loadedPageData.concat(new Array<null>(Math.max(currentMeta.valuesMeta.distinctTotal - loadedPageData.length, 0)).fill(null));
    }, [loadedPageData, currentMeta?.valuesMeta.distinctTotal]);

    const currentCount =
        field.rule?.type === 'one of'
            ? field.rule.value.length
            : metaData && field.rule?.type === 'not in'
            ? metaData.valuesMeta.distinctTotal - field.rule.value.length
            : 0;

    const currentSum =
        field.rule?.type === 'one of' ? selectedValueSum : metaData && field.rule?.type === 'not in' ? metaData.valuesMeta.total - selectedValueSum : 0;

    const handleToggleFullOrEmptySet = useCallback(() => {
        if (!field.rule || (field.rule.type !== 'one of' && field.rule.type !== 'not in') || !metaData) return;
        setSelectedValueSum(0);
        onChange({
            type: currentCount === metaData.valuesMeta.distinctTotal ? 'one of' : 'not in',
            value: [],
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
                value: Array.from(newValue),
            });
        },
        [field.rule, onChange]
    );

    return {
        total: metaData?.valuesMeta.total,
        distinctTotal: metaData?.valuesMeta.distinctTotal,
        currentRows: lastCurrentMeta?.valuesMeta.distinctTotal,
        currentCount,
        currentSum,
        handleToggleFullOrEmptySet,
        handleToggleReverseSet,
        handleSelect,
        data,
        loadData,
        loading: !metaData,
        loadingPageData,
    };
};

const Effecter = (props: { effect: () => void; effectId: any }) => {
    useEffect(() => {
        props.effect();
    }, [props.effectId]);
    return null;
};

interface SortConfig {
    key: 'value' | 'count';
    ascending: boolean;
}

function Toggle(props: { children?: React.ReactNode; value: boolean; onChange?: (v: boolean) => void; label?: string }) {
    return (
        <Tooltip content={props.label}>
            <div
                onClick={() => {
                    props.onChange?.(!props.value);
                }}
                className={classNames(
                    props.value ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                    'rounded cursor-pointer p-1 w-6 h-6 flex items-center justify-center'
                )}
            >
                {props.children}
            </div>
        </Tooltip>
    );
}

const SortButton: React.FC<{ id: string; config: SortConfig; currentKey: SortConfig['key']; setSortConfig: (value: SortConfig) => void }> = ({
    config: { key, ascending },
    currentKey,
    setSortConfig,
    id,
}) => {
    const isCurrentKey = key === currentKey;
    return (
        <Button
            id={id}
            variant={isCurrentKey ? 'secondary' : 'ghost'}
            size="icon-xs"
            className={classNames('ml-2')}
            onClick={(e) => {
                e.preventDefault();
                setSortConfig({ key: currentKey, ascending: isCurrentKey ? !ascending : true });
            }}
        >
            {isCurrentKey && !ascending ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronUpIcon className="h-4 w-4" />}
        </Button>
    );
};

export const FilterOneOfRule: React.FC<RuleFormProps & { active: boolean }> = ({ active, field, onChange, allFields, displayOffset }) => {
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
                value: [],
            });
        }
    }, [active, onChange, field]);

    const [keywordValue, setKeyword] = useState('');
    const [isCaseSenstive, setIsCaseSenstive] = useState(false);
    const [isWord, setIsWord] = useState(false);
    const [isRegexp, setIsRegexp] = useState(false);
    const keyword = useMemo<IKeyWord | undefined>(
        () =>
            keywordValue
                ? {
                      value: keywordValue,
                      caseSenstive: isCaseSenstive,
                      word: isWord,
                      regexp: isRegexp,
                  }
                : undefined,
        [keywordValue, isCaseSenstive, isWord, isRegexp]
    );

    const debouncer = useMemo(() => {
        const { timeout, ...options } = GLOBAL_CONFIG.KEYWORD_DEBOUNCE_SETTING;
        return function <T extends (...args: any) => any>(f: T) {
            return debounce(f, timeout, options);
        };
    }, []);

    const debouncedKeyword = createStreamedValueHook(debouncer)(keyword);

    const enableKeyword = field.semanticType === 'nominal';

    const searchKeyword = enableKeyword ? debouncedKeyword : undefined;

    const {
        currentCount,
        currentSum,
        distinctTotal,
        data,
        currentRows,
        handleSelect,
        handleToggleFullOrEmptySet,
        handleToggleReverseSet,
        loadData,
        loading,
        loadingPageData,
    } = useVisualCount(field, `${sortConfig.key}${sortConfig.ascending ? '' : '_dsc'}`, computation, onChange, allFields, {
        displayOffset,
        keyword: searchKeyword,
    });

    const showLoadingList = loadingPageData || keyword !== debouncedKeyword;

    const parentRef = React.useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: currentRows ?? 0,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 32,
        overscan: 10,
    });

    const ruleSet = useMemo(
        () =>
            field.rule && (field.rule.type === 'not in' || field.rule?.type === 'one of')
                ? new Set(field.rule.value.map((x) => _unstable_encodeRuleValue(x)))
                : null,
        [field]
    );

    return field.rule?.type === 'one of' || field.rule?.type === 'not in' ? (
        <Container>
            <div>{t('constant.filter_type.one_of')}</div>
            <div className="text-muted-foreground">{t('constant.filter_type.one_of_desc')}</div>
            <div className="btn-grp">
                <Button variant="outline" size="sm" onClick={() => handleToggleFullOrEmptySet()}>
                    {currentCount === distinctTotal ? t('filters.btn.unselect_all') : t('filters.btn.select_all')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleToggleReverseSet()}>
                    {t('filters.btn.reverse')}
                </Button>
            </div>
            {enableKeyword && (
                <div className="relative">
                    <Input
                        className="mb-2 pr-[88px]"
                        type="search"
                        value={keywordValue}
                        placeholder="Search Value..."
                        onChange={(e) => {
                            setKeyword(e.target.value);
                        }}
                    />
                    <div className="absolute flex space-x-1 items-center inset-y-0 right-2">
                        <Toggle label="Match Case" value={isCaseSenstive} onChange={setIsCaseSenstive}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
                                <path
                                    fill="currentColor"
                                    d="M8.854 11.702h-1l-.816-2.159H3.772l-.768 2.16H2L4.954 4h.935zm-2.111-2.97L5.534 5.45a3.142 3.142 0 0 1-.118-.515h-.021c-.036.218-.077.39-.124.515L4.073 8.732zm7.013 2.97h-.88v-.86h-.022c-.383.66-.947.99-1.692.99c-.548 0-.978-.146-1.29-.436c-.307-.29-.461-.675-.461-1.155c0-1.027.605-1.625 1.815-1.794l1.65-.23c0-.935-.379-1.403-1.134-1.403c-.663 0-1.26.226-1.794.677V6.59c.54-.344 1.164-.516 1.87-.516c1.292 0 1.938.684 1.938 2.052zm-.88-2.782l-1.327.183c-.409.057-.717.159-.924.306c-.208.143-.312.399-.312.768c0 .268.095.489.285.66c.193.169.45.253.768.253a1.41 1.41 0 0 0 1.08-.457c.286-.308.43-.696.43-1.165z"
                                />
                            </svg>
                        </Toggle>
                        <Toggle label="Match Whole Word" value={isWord} onChange={setIsWord}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
                                <g fill="currentColor">
                                    <path fillRule="evenodd" d="M0 11h1v2h14v-2h1v3H0z" clipRule="evenodd" />
                                    <path d="M6.84 11h-.88v-.86h-.022c-.383.66-.947.989-1.692.989c-.548 0-.977-.145-1.289-.435c-.308-.29-.462-.675-.462-1.155c0-1.028.605-1.626 1.816-1.794l1.649-.23c0-.935-.378-1.403-1.134-1.403c-.662 0-1.26.226-1.794.677v-.902c.541-.344 1.164-.516 1.87-.516c1.292 0 1.938.684 1.938 2.052zm-.88-2.782L4.633 8.4c-.408.058-.716.16-.924.307c-.208.143-.311.399-.311.768c0 .268.095.488.284.66c.194.168.45.253.768.253a1.41 1.41 0 0 0 1.08-.457c.286-.308.43-.696.43-1.165zm3.388 1.987h-.022V11h-.88V2.857h.88v3.61h.021c.434-.73 1.068-1.096 1.902-1.096c.705 0 1.257.247 1.654.741c.401.49.602 1.15.602 1.977c0 .92-.224 1.658-.672 2.213c-.447.551-1.06.827-1.837.827c-.726 0-1.276-.308-1.649-.924m-.022-2.218v.768c0 .455.147.841.44 1.16c.298.315.674.473 1.128.473c.534 0 .951-.204 1.252-.613c.304-.408.456-.975.456-1.702c0-.613-.141-1.092-.424-1.44c-.283-.347-.666-.52-1.15-.52c-.511 0-.923.178-1.235.536c-.311.355-.467.8-.467 1.338" />
                                </g>
                            </svg>
                        </Toggle>
                        <Toggle label="Use Regular Expression" value={isRegexp} onChange={setIsRegexp}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
                                <path
                                    fill="currentColor"
                                    fillRule="evenodd"
                                    d="M10.012 2h.976v3.113l2.56-1.557l.486.885L11.47 6l2.564 1.559l-.485.885l-2.561-1.557V10h-.976V6.887l-2.56 1.557l-.486-.885L9.53 6L6.966 4.441l.485-.885l2.561 1.557zM2 10h4v4H2z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </Toggle>
                    </div>
                </div>
            )}
            <div className="relative">
                <Table>
                    <TableRow>
                        <div className="flex justify-center items-center">
                            <StatusCheckbox
                                disabled={!!searchKeyword}
                                currentNum={currentCount}
                                totalNum={distinctTotal ?? 0}
                                onChange={handleToggleFullOrEmptySet}
                            />
                        </div>
                        <div className="header text-muted-foreground flex items-center">
                            <label htmlFor="value_sort">{t('filters.header.value')}</label>
                            <SortButton id="value_sort" currentKey="value" setSortConfig={setSortConfig} config={sortConfig} />
                        </div>
                        <div className="header text-muted-foreground flex items-center">
                            <label htmlFor="count_sort">{t('filters.header.count')}</label>
                            <SortButton id="count_sort" currentKey="count" setSortConfig={setSortConfig} config={sortConfig} />
                        </div>
                    </TableRow>
                </Table>
                {loading && (
                    <div className="h-24 w-full relative">
                        <LoadingLayer />
                    </div>
                )}
                {/* <hr /> */}
                {!loading && (
                    <Table ref={parentRef}>
                        {showLoadingList && rowVirtualizer.getTotalSize() === 0 && <LoadingLayer />}
                        {showLoadingList && (
                            <div
                                style={{
                                    paddingBottom: `${rowVirtualizer.getTotalSize()}px`,
                                    width: '100%',
                                    position: 'relative',
                                }}
                            >
                                {rowVirtualizer.getVirtualItems().map((vItem) => (
                                    <TableRow
                                        key={vItem.index}
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
                                            <Skeleton className="h-4 w-4" />
                                        </div>
                                        <div className="flex justify-left items-center">
                                            <Skeleton className="h-3 w-20" />
                                        </div>
                                        <div className="flex justify-right items-center">
                                            <Skeleton className="h-3 w-6" />
                                        </div>
                                    </TableRow>
                                ))}
                            </div>
                        )}
                        {!showLoadingList && (
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
                                                    <Skeleton className="h-4 w-4" />
                                                </div>
                                                <div className="flex justify-left items-center">
                                                    <Skeleton className="h-3 w-20" />
                                                </div>
                                                <div className="flex justify-right items-center">
                                                    <Skeleton className="h-3 w-6" />
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
                                        (!!ruleSet && field.rule?.type === 'one of' && ruleSet.has(_unstable_encodeRuleValue(value))) ||
                                        (!!ruleSet && field.rule?.type === 'not in' && !ruleSet.has(_unstable_encodeRuleValue(value)));
                                    const displayValue =
                                        field.semanticType === 'temporal' ? formatDate(parsedOffsetDate(displayOffset, field.offset)(value)) : `${value}`;
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
                                                <Checkbox
                                                    className="h-4 w-4"
                                                    checked={checked}
                                                    id={id}
                                                    aria-describedby={`${id}_label`}
                                                    title={displayValue}
                                                    onCheckedChange={(checked) => handleSelect(value, !!checked, count)}
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
                        )}
                    </Table>
                )}
                {isNotEmpty(distinctTotal) && (
                    <Table className="text-muted-foreground">
                        <TableRow>
                            <label></label>
                            <label>{t('filters.selected_keys', { count: currentCount })}</label>
                            <label>{currentSum}</label>
                        </TableRow>
                    </Table>
                )}
            </div>
        </Container>
    ) : null;
};

interface CalendarInputProps {
    min: number;
    max: number;
    displayOffset?: number;
    value: number;
    onChange: (value: number) => void;
    className?: string;
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
            className={classNames(
                'dark:[color-scheme:dark] flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                props.className ?? ''
            )}
            type="datetime-local"
            min={dateStringFormatter(min)}
            max={dateStringFormatter(max)}
            defaultValue={dateStringFormatter(value)}
            onChange={(e) => handleSubmitDate(e.target.value)}
        />
    );
};

export const FilterTemporalRangeRule: React.FC<RuleFormProps & { active: boolean }> = ({ active, field, allFields, onChange, displayOffset }) => {
    const { t } = useTranslation('translation');

    const computationFunction = useCompututaion();

    const [res, setRes] = useState<[number, number, string, boolean]>(() => [0, 0, '', false]);

    React.useEffect(() => {
        withComputedField(field, allFields, computationFunction, { timezoneDisplayOffset: displayOffset })((service) =>
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
        (value: [number, number]) => {
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
            <div className="text-muted-foreground">{t('constant.filter_type.temporal_range_desc')}</div>
            <CalendarInputContainer>
                <div className="calendar-input">
                    <div className="my-1">{t('filters.range.start_value')}</div>
                    <CalendarInput
                        displayOffset={displayOffset}
                        min={min}
                        max={field.rule.value[1] ?? max}
                        value={field.rule.value[0] ?? min}
                        onChange={(value) => handleChange([value, field.rule?.value[1]])}
                    />
                </div>
                <div className="calendar-input">
                    <div className="my-1">{t('filters.range.end_value')}</div>
                    <CalendarInput
                        displayOffset={displayOffset}
                        min={field.rule.value[0] ?? min}
                        max={max}
                        value={field.rule.value[1] ?? max}
                        onChange={(value) => handleChange([field.rule?.value[0], value])}
                    />
                </div>
            </CalendarInputContainer>
        </Container>
    ) : null;
};

export const FilterRangeRule: React.FC<RuleFormProps & { active: boolean }> = ({ active, field, onChange, allFields, displayOffset }) => {
    const { t } = useTranslation('translation', { keyPrefix: 'constant.filter_type' });
    const computation = useCompututaion();

    const [stats] = useFieldStats(field, { values: false, range: true, valuesMeta: false, displayOffset }, 'none', computation, allFields);
    const range = stats?.range;

    React.useEffect(() => {
        if (range && active && field.rule?.type !== 'range') {
            onChange({
                type: 'range',
                value: range,
            });
        }
    }, [onChange, field, range, active]);

    const handleChange = React.useCallback((value: [number, number]) => {
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
            <div className="text-muted-foreground">{t('range_desc')}</div>
            <Slider min={range[0]} max={range[1]} value={field.rule.value} onChange={handleChange} />
        </Container>
    ) : null;
};

const filterTabs: Partial<Record<IFilterRule['type'], React.FC<RuleFormProps & { active: boolean }>>> = {
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

const getType = (type?: 'range' | 'temporal range' | 'one of' | 'not in' | 'regexp') => {
    if (type === 'not in') {
        return 'one of';
    }
    return type;
};

const Tabs: React.FC<TabsProps> = ({ allFields, field, onChange, tabs, displayOffset }) => {
    const { t } = useTranslation('translation', { keyPrefix: 'constant.filter_type' });

    const [which, setWhich] = React.useState(getType(field.rule?.type) ?? tabs[0]!);
    React.useEffect(() => {
        if (!tabs.includes(which)) setWhich(tabs[0]);
    }, [tabs]);

    return (
        <TabsContainer>
            <RadioGroup value={which} onValueChange={(s) => setWhich(s as (typeof tabs)[number])}>
                {tabs.map((option) => {
                    return (
                        <div className="flex my-2" key={option}>
                            <div className="align-top">
                                <RadioGroupItem id={option} value={option} />
                            </div>
                            <div className="ml-3">
                                <Label htmlFor={option}>{t(tabOptionDict[option].key)}</Label>
                                <div className="text-muted-foreground">{t(tabOptionDict[option].descKey)}</div>
                            </div>
                        </div>
                    );
                })}
            </RadioGroup>
            <hr className="my-0.5" />
            <TabPanel>
                {tabs.map((tab, i) => {
                    const Component = filterTabs[tab];
                    if (!Component) return null;

                    return (
                        <TabItem
                            key={i}
                            id={`filter-panel-${tabOptionDict[tab]}`}
                            aria-labelledby={`filter-tab-${tabOptionDict[tab]}`}
                            role="tabpanel"
                            hidden={which !== tab}
                            tabIndex={0}
                        >
                            <Component displayOffset={displayOffset} field={field} onChange={onChange} active={which === tab} allFields={allFields} />
                        </TabItem>
                    );
                })}
            </TabPanel>
        </TabsContainer>
    );
};

export default Tabs;
