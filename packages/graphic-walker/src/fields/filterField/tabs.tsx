import { observer } from 'mobx-react-lite';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import type { IFilterField, IFilterRule, IRow, DataSet, IFieldStats, IField, IViewField, IFieldReadStats, FilterSortConfig } from '../../interfaces';
import { useGlobalStore } from '../../store';
import LoadingLayer from '../../components/loadingLayer';
import { useComputationFunc, useRenderer } from '../../renderer/hooks';
import { fieldRangeStatsServer, fieldReadRawServer, fieldStatServer, fieldTotalServer } from '../../computation/serverComputation';
import Slider from './slider';
import {
    ChevronDownIcon,
    ChevronUpIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../../components/dataTable/pagination';
import FilterPagination from './filterPagination';
import { toJS } from 'mobx';
import { useFieldReadStats, useFieldTotal } from './utils';
import { StatusCheckbox } from './statusCheckBox';

export type RuleFormProps = {
    dataset: DataSet;
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
interface CalendarInputProps {
    min: number;
    max: number;
    value: number;
    onChange: (value: number) => void;
}

const CalendarInput: React.FC<CalendarInputProps> = props => {
    const { min, max, value, onChange } = props;
    const dateStringFormatter = (timestamp: number) => {
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return '';
        return date.toISOString().slice(0, 19);
    }
    const handleSubmitDate = (value: string) => {
        if (new Date(value).getTime() <= max && new Date(value).getTime() >= min) {
            onChange(new Date(value).getTime())
        }
    }
    return (
        <input
            className="block w-full rounded-md border-0 py-1 px-2 text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 dark:bg-zinc-900 dark:border-gray-700 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
            type="datetime-local"
            min={dateStringFormatter(min)}
            max={dateStringFormatter(max)}
            defaultValue={dateStringFormatter(value)}
            onChange={(e) => handleSubmitDate(e.target.value)}
        />
    )
}

const emptyFilters = [] as const;

export const FilterOneOfRule: React.FC<RuleFormProps & { active: boolean }> = observer(({
    active,
    field,
    onChange,
  }) => {
    const [sortConfig, setSortConfig] = useState<FilterSortConfig>({
        key: "count",
        order: "ascending"
    });
    const [localSet,setLocalSet] = useState<Set<string | number>>(new Set(field.rule?.value));
    const [localSetSum, setLocalSetSum] = useState<number>(0);
    const [selectMode,setSelectMode] = useState<boolean>(true);
    const [pageIndex,setPageIndex] = useState(0);

    useEffect(()=>{
        setLocalSet(new Set(field.rule?.value));
        setSelectMode(true);
        setLocalSetSum(0);
    },[field.fid])

    const { t } = useTranslation('translation');
    const res = useFieldTotal(field);
    const total = res?.total?res.total:0;
    const size = 10;
    const from = pageIndex * size;
    const to = Math.min((pageIndex + 1) * size - 1, total - 1);

    const statsValue = useFieldReadStats(field,sortConfig,size,pageIndex);

    useEffect(() => {
        if (field && active && !(field.rule?.type === 'one of' || field.rule?.type === 'not in')) {
            onChange({
                type: selectMode?'not in':'one of',
                value: new Set<string | number>(localSet),
            });
        }
    }, [active, field.fid]);   
    
    const handleToggleFullOrEmptySet = () => {
        setSelectMode(!selectMode);
        setLocalSet(new Set());
        setLocalSetSum(0);
    }
    const handleToggleReverseSet = () => {
        setSelectMode(!selectMode);
    }
    const handleSelectValue = (isDelete: boolean,value:string|number,count:number) => {
        if(isDelete){
            localSet.delete(value);
            onChange({
                type: selectMode?'not in':'one of',
                value: localSet
            });
            setLocalSetSum(localSetSum - count);
        }else{
            localSet.add(value);
            onChange({
                type: selectMode?'not in':'one of',
                value: localSet
            });            
            setLocalSetSum(localSetSum + count);
        }
    }
 
    const SortButton: React.FC<{ currentKey: FilterSortConfig["key"] }> = ({ currentKey }) => {
        const isCurrentKey = sortConfig.key === currentKey;
        const nextOrder = sortConfig.order === 'ascending'? 'descending':'ascending';
        return (
            <span
                className={`ml-2 flex-none rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer ${isCurrentKey ? "text-indigo-600" : "text-gray-500"}`}
                onClick={() => setSortConfig({ key: currentKey, order: nextOrder})}
            >
                {isCurrentKey && sortConfig.order === 'descending'
                    ? <ChevronDownIcon className="h-4 w-4" />
                    : <ChevronUpIcon className="h-4 w-4" />
                }
            </span>
        );
    }

    return (field.rule?.type === 'one of' || field.rule?.type === 'not in') ? (
        <Container>
            <div>{t('constant.filter_type.one_of')}</div>
            <div className="text-gray-500 dark:text-gray-300">{t('constant.filter_type.one_of_desc')}</div>
            <div className="btn-grp">
                <Button
                    className="dark:bg-zinc-900 dark:text-gray-200 dark:hover:bg-gray-800"
                    onClick={() => handleToggleFullOrEmptySet()}
                    disabled={!res}
                >
                    {
                        (selectMode && localSet.size === res?.total) || (!selectMode && localSet.size === 0)
                            ?t('filters.btn.select_all')
                            :t('filters.btn.unselect_all')
                    }
                </Button>
                <Button
                    className="dark:bg-zinc-900 dark:text-gray-200 dark:hover:bg-gray-800"
                    onClick={() => handleToggleReverseSet()}
                >
                    {t('filters.btn.reverse')}
                </Button>
            </div>
      
            <Table className="bg-slate-50 dark:bg-gray-800">
                <div className="flex justify-center items-center">
                    <StatusCheckbox
                        selectMode={selectMode}
                        currentNum={localSet.size}
                        totalNum={total}
                        onChange={handleToggleFullOrEmptySet}
                    />
                </div>
                <label className="header text-gray-500 dark:text-gray-300 flex items-center">
                    {t('filters.header.value')}
                    <SortButton currentKey="label" />
                </label>
                <label className="header text-gray-500 dark:text-gray-300 flex items-center">
                    {t('filters.header.count')}
                    <SortButton currentKey="count" />
                </label>
            </Table>  
  
            <hr />
            <Table>
                {
                    statsValue?.map(({ value, count }, idx) => {
                        const id = `rule_checkbox_${idx}`;
                        return (
                            <React.Fragment key={idx}>
                                <div className="flex justify-center items-center">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                        checked={ ( selectMode && !localSet.has(value)) || ( !selectMode && localSet.has(value)) }
                                        id={id}
                                        aria-describedby={`${id}_label`}
                                        title={String(value)}
                                        onChange={() => {
                                            handleSelectValue(localSet.has(value),value,count);
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
                <FilterPagination 
                    total={total}
                    from={from + 1}
                    to={to + 1}
                    onNext={() => {
                        setPageIndex(Math.min(Math.ceil(total / size) - 1, pageIndex + 1));
                    }}
                    onPrev={() => {
                        setPageIndex(Math.max(0, pageIndex - 1));
                    }}
                />
                <label></label>
            </Table>
            <Table className="text-gray-600">
                <label></label>
                <label>
                    {res && selectMode && t('filters.selected_keys', { count: res.total - localSet.size })}
                    {res && !selectMode && t('filters.selected_keys', { count:  localSet.size })}
                </label>
                <label>
                    {res && selectMode && t('filters.selected_keys', { count: res.sum - localSetSum })}
                    {res && !selectMode && t('filters.selected_keys', { count:  localSetSum })}
                </label>
            </Table>
        </Container>
    ) : null;
  });

export const FilterTemporalRangeRule: React.FC<RuleFormProps & { active: boolean }> = observer(({
    dataset,
    active,
    field,
    onChange,
}) => {
    const { rawFields } = dataset;

    const { t } = useTranslation('translation');

    const fields = useMemo(() => {
        return rawFields.map<Omit<IViewField, 'dragId'>>(f => ({
            ...f,
            name: f.name || f.fid,
        }));
    }, [rawFields]);

    const viewDimensions = useMemo(() => {
        return field.analyticType === 'dimension' ? [field] : [];
    }, [field]);

    const viewMeasures = useMemo(() => {
        return field.analyticType === 'measure' ? [field] : [];
    }, [field]);

    const computationFunction = useComputationFunc();

    const { viewData, loading } = useRenderer({
        allFields: fields,
        viewDimensions,
        viewMeasures,
        filters: emptyFilters,
        defaultAggregated: false,
        computationFunction,
        limit: 1000,
        sort: 'none',
    });

    const sorted = React.useMemo(() => {
        return viewData.reduce<number[]>((list, d) => {
            try {
                const time = new Date(d[field.fid]).getTime();
                list.push(time);
            } catch (error) {

            }
            return list;
        }, []).sort((a, b) => a - b);
    }, [viewData, field.fid]);

    const [min, max, loaded] = React.useMemo<[min: number, max: number, loaded: boolean]>(() => {
        if (!sorted.length) return [0, 0, false];
        return [sorted[0] ?? 0, Math.max(sorted[sorted.length - 1] ?? 0, sorted[0] ?? 0), true];
    }, [sorted]);

    React.useEffect(() => {
        if (active && field.rule?.type !== 'temporal range') {
            onChange({
                type: 'temporal range',
                value: [min, max],
            });
        }
    }, [onChange, field, min, max, active]);

    React.useEffect(() => {
        if (active && loaded && field.rule?.type === 'temporal range' && field.rule.value[0] !== min && field.rule.value[1] !== max) {
            onChange({
                type: 'temporal range',
                value: [min, max],
            });
        }
    }, [field.rule, min, max, active, loaded]);

    const handleChange = React.useCallback((value: readonly [number, number]) => {
        onChange({
            type: 'temporal range',
            value,
        });
    }, []);

    if (loading) {
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

const useFieldRangeStats = (field: IField): [number,number]|null => {
    const { fid } = field;
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState<[number,number] | null>(null)
    const computationFunction = useComputationFunc();
    
    React.useEffect(() => {
      setLoading(true);
      let isCanceled = false;
      fieldRangeStatsServer(computationFunction, fid).then( range => {
        if(isCanceled){
          return;
        }
        setRange(range);
        setLoading(false);
      }).catch(err => {
        console.warn(err);
        if(isCanceled) {
          return;
        }
        setRange(null);
        setLoading(false);
      });
      return () => {
        isCanceled = true;
      }
    }, [fid, computationFunction])
  
    return loading ?  null : range;
  }

export const FilterRangeRule: React.FC<RuleFormProps & { active: boolean }> = observer(({
    active,
    field,
    onChange,
}) => {
    const { t } = useTranslation('translation', { keyPrefix: 'constant.filter_type' });
    const range = useFieldRangeStats(field);

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
            <Slider
                min={range[0]}
                max={range[1]}
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
    'not in': FilterOneOfRule
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
    const { vizStore, commonStore } = useGlobalStore();
    const { draggableFieldState } = vizStore;
    const { currentDataset } = commonStore;

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
            <hr className="my-0.5" />
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
                                    dataset={currentDataset}
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
