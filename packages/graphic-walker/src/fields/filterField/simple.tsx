import { observer } from 'mobx-react-lite';
import { CalendarInput, RuleFormProps, useFieldStats, useVisualCount } from './tabs';
import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useCompututaion } from '../../store';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Popover, Transition } from '@headlessui/react';
import { classNames, formatDate } from '../../utils';
import { parsedOffsetDate } from '../../lib/op/offset';
import styled from 'styled-components';
import LoadingLayer from '../../components/loadingLayer';
import { IFilterField, IKeyWord } from '../../interfaces';
import { ArrowRightIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline';
import { getTemporalRange, withComputedField } from '../../computation';
import Slider from '../../components/slider';
import { useKeyWord } from '../../hooks';

const sortConfig = {
    key: 'value',
    ascending: true,
} as const;

export const SimpleSearcher = observer(function SimpleSearcher({ field, onChange }: RuleFormProps) {
    if (field.rule?.type !== 'regexp') return null;
    const { value, caseSensitive } = field.rule;
    return (
        <div className="flex flex-col space-y-2 p-2">
            <label>{field.name}:</label>
            <div className="relative">
                <input
                    type="search"
                    className="block w-full text-gray-700 dark:text-gray-200 rounded-md border-0 py-1 px-2 pr-9 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-900 "
                    value={value}
                    placeholder="Input Regular Expression..."
                    onChange={(e) => {
                        onChange({
                            type: 'regexp',
                            value: e.target.value,
                            caseSensitive: !!caseSensitive,
                        });
                    }}
                />
                <div className="absolute flex space-x-1 items-center inset-y-0 right-2">
                    <Toggle
                        label="Match Case"
                        value={!!caseSensitive}
                        onChange={(v) => {
                            onChange({
                                type: 'regexp',
                                value: value,
                                caseSensitive: v,
                            });
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
                            <path
                                fill="currentColor"
                                d="M8.854 11.702h-1l-.816-2.159H3.772l-.768 2.16H2L4.954 4h.935zm-2.111-2.97L5.534 5.45a3.142 3.142 0 0 1-.118-.515h-.021c-.036.218-.077.39-.124.515L4.073 8.732zm7.013 2.97h-.88v-.86h-.022c-.383.66-.947.99-1.692.99c-.548 0-.978-.146-1.29-.436c-.307-.29-.461-.675-.461-1.155c0-1.027.605-1.625 1.815-1.794l1.65-.23c0-.935-.379-1.403-1.134-1.403c-.663 0-1.26.226-1.794.677V6.59c.54-.344 1.164-.516 1.87-.516c1.292 0 1.938.684 1.938 2.052zm-.88-2.782l-1.327.183c-.409.057-.717.159-.924.306c-.208.143-.312.399-.312.768c0 .268.095.489.285.66c.193.169.45.253.768.253a1.41 1.41 0 0 0 1.08-.457c.286-.308.43-.696.43-1.165z"
                            />
                        </svg>
                    </Toggle>
                </div>
            </div>
        </div>
    );
});

const TableRow = styled.div`
    display: flex;
    & > input,
    & > *[for] {
        cursor: pointer;
    }
    & > * {
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

function Toggle(props: { children?: React.ReactNode; value: boolean; onChange?: (v: boolean) => void; label?: string }) {
    return (
        <div
            title={props.label}
            onClick={() => {
                props.onChange?.(!props.value);
            }}
            className={classNames(
                props.value ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800',
                'rounded cursor-pointer p-1 w-6 h-6 flex items-center justify-center'
            )}
        >
            {props.children}
        </div>
    );
}

export const SimpleOneOfSelector = observer(function SimpleOneOfSelector({ field, onChange, rawFields, displayOffset }: RuleFormProps) {
    const computation = useCompututaion();

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

    const debouncedKeyword = useKeyWord(keyword);

    const enableKeyword = field.semanticType === 'nominal';

    const searchKeyword = enableKeyword ? debouncedKeyword : undefined;

    const { data, currentRows, handleSelect, loadData, loading } = useVisualCount(
        field,
        `${sortConfig.key}${sortConfig.ascending ? '' : '_dsc'}`,
        computation,
        onChange,
        rawFields,
        {
            displayOffset,
            keyword: searchKeyword,
        }
    );

    if (field.rule?.type !== 'one of' && field.rule?.type !== 'not in') return null;
    return (
        <div className="flex flex-col space-y-2 p-2 relative">
            <label>{field.name}:</label>
            <Popover className="w-full">
                <Popover.Button className="flex items-center h-8 space-x-2 p-2 rounded border w-full text-left">
                    <div className="flex-1">
                        {field.rule.value.size > 0 && (
                            <>
                                {field.rule.type === 'not in' ? 'exclude: ' : ''}
                                {Array.from(field.rule.value).slice(0, 3).join(', ') + (field.rule.value.size > 3 ? ` +${field.rule.value.size - 3}` : '')}
                            </>
                        )}
                        {field.rule.value.size === 0 && (
                            <span className="text-gray-400">{field.rule.type === 'one of' ? 'Select Values...' : 'Select Values to Exclude...'}</span>
                        )}
                    </div>
                    <span>
                        <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </span>
                </Popover.Button>
                <Transition
                    as={Fragment}
                    enter="transition ease-out duration-200"
                    enterFrom="opacity-0 translate-y-1"
                    enterTo="opacity-100 translate-y-0"
                    leave="transition ease-in duration-150"
                    leaveFrom="opacity-100 translate-y-0"
                    leaveTo="opacity-0 translate-y-1"
                >
                    <Popover.Panel className="absolute mt-2 z-10 border rounded-md p-3 inset-x-2 bg-white dark:bg-zinc-800">
                        <div className="flex flex-col w-full">
                            {enableKeyword && (
                                <div className="relative mb-2">
                                    <input
                                        type="search"
                                        className="block py-1 px-2 pr-24 w-full text-gray-700 dark:text-gray-200 rounded-md border-0 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-900 "
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
                                                    <path fill-rule="evenodd" d="M0 11h1v2h14v-2h1v3H0z" clip-rule="evenodd" />
                                                    <path d="M6.84 11h-.88v-.86h-.022c-.383.66-.947.989-1.692.989c-.548 0-.977-.145-1.289-.435c-.308-.29-.462-.675-.462-1.155c0-1.028.605-1.626 1.816-1.794l1.649-.23c0-.935-.378-1.403-1.134-1.403c-.662 0-1.26.226-1.794.677v-.902c.541-.344 1.164-.516 1.87-.516c1.292 0 1.938.684 1.938 2.052zm-.88-2.782L4.633 8.4c-.408.058-.716.16-.924.307c-.208.143-.311.399-.311.768c0 .268.095.488.284.66c.194.168.45.253.768.253a1.41 1.41 0 0 0 1.08-.457c.286-.308.43-.696.43-1.165zm3.388 1.987h-.022V11h-.88V2.857h.88v3.61h.021c.434-.73 1.068-1.096 1.902-1.096c.705 0 1.257.247 1.654.741c.401.49.602 1.15.602 1.977c0 .92-.224 1.658-.672 2.213c-.447.551-1.06.827-1.837.827c-.726 0-1.276-.308-1.649-.924m-.022-2.218v.768c0 .455.147.841.44 1.16c.298.315.674.473 1.128.473c.534 0 .951-.204 1.252-.613c.304-.408.456-.975.456-1.702c0-.613-.141-1.092-.424-1.44c-.283-.347-.666-.52-1.15-.52c-.511 0-.923.178-1.235.536c-.311.355-.467.8-.467 1.338" />
                                                </g>
                                            </svg>
                                        </Toggle>
                                        <Toggle label="Use Regular Expression" value={isRegexp} onChange={setIsRegexp}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
                                                <path
                                                    fill="currentColor"
                                                    fill-rule="evenodd"
                                                    d="M10.012 2h.976v3.113l2.56-1.557l.486.885L11.47 6l2.564 1.559l-.485.885l-2.561-1.557V10h-.976V6.887l-2.56 1.557l-.486-.885L9.53 6L6.966 4.441l.485-.885l2.561 1.557zM2 10h4v4H2z"
                                                    clip-rule="evenodd"
                                                />
                                            </svg>
                                        </Toggle>
                                    </div>
                                </div>
                            )}
                            {loading && (
                                <div className="h-24 w-full relative">
                                    <LoadingLayer />
                                </div>
                            )}
                            {!loading && (
                                <VirtualList
                                    field={field}
                                    data={data}
                                    distinctTotal={currentRows}
                                    handleSelect={handleSelect}
                                    loadData={loadData}
                                    displayOffset={displayOffset}
                                />
                            )}
                        </div>
                    </Popover.Panel>
                </Transition>
            </Popover>
        </div>
    );
});

function VirtualList({
    field,
    distinctTotal,
    data,
    handleSelect,
    loadData,
    displayOffset,
}: {
    field: IFilterField;
    distinctTotal?: number;
    data: ({ value: string | number; count: number } | null)[];
    handleSelect: (value: string | number, checked: boolean, itemNum: number) => void;
    loadData: (index: number) => void;
    displayOffset?: number;
}) {
    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: distinctTotal ?? 0,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 32,
        overscan: 10,
    });

    return (
        <div className="overflow-y-auto w-full flex flex-col max-h-64" ref={parentRef}>
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
                    const displayValue = field.semanticType === 'temporal' ? formatDate(parsedOffsetDate(displayOffset, field.offset)(value)) : `${value}`;
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
                            <label id={`${id}_label`} htmlFor={id} className="flex items-center" title={displayValue}>
                                {displayValue}
                            </label>
                        </TableRow>
                    );
                })}
            </div>
        </div>
    );
}

const Effecter = (props: { effect: () => void; effectId: any }) => {
    useEffect(() => {
        props.effect();
    }, [props.effectId]);
    return null;
};

export const SimpleTemporalRange: React.FC<RuleFormProps> = ({ field, rawFields, onChange, displayOffset }) => {
    const computationFunction = useCompututaion();

    const [res, setRes] = useState<[number, number, string, boolean]>(() => [0, 0, '', false]);

    React.useEffect(() => {
        withComputedField(field, rawFields, computationFunction, { timezoneDisplayOffset: displayOffset })((service) =>
            getTemporalRange(service, field.fid, field.offset)
        ).then(([min, max, format]) => setRes([min, max, format, true]));
    }, [field.fid]);

    const [min, max, format, loaded] = res;

    const offset = field.offset ?? new Date().getTimezoneOffset();

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
    if (field.rule?.type !== 'temporal range') return null;

    if (!loaded) {
        return (
            <div className="flex items-center">
                <div className="h-12 w-full relative">
                    <LoadingLayer />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col space-y-2 p-2">
            <label>{field.name}:</label>
            <div className="flex space-x-2 items-center h-8">
                <div className="flex-1">
                    <CalendarInput
                        displayOffset={displayOffset}
                        min={min}
                        max={field.rule.value[1]}
                        value={field.rule.value[0]}
                        onChange={(value) => handleChange([value, field.rule?.value[1]])}
                    />
                </div>
                <div className="flex-shrink-0">
                    <ArrowRightIcon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                    <CalendarInput
                        displayOffset={displayOffset}
                        min={field.rule.value[0]}
                        max={max}
                        value={field.rule.value[1]}
                        onChange={(value) => handleChange([field.rule?.value[0], value])}
                    />
                </div>
            </div>
        </div>
    );
};

export const SimpleRange: React.FC<RuleFormProps> = ({ field, onChange, rawFields, displayOffset }) => {
    const computation = useCompututaion();

    const [stats] = useFieldStats(field, { values: false, range: true, valuesMeta: false, displayOffset }, 'none', computation, rawFields);
    const range = stats?.range;

    const handleChange = React.useCallback((value: readonly [number, number]) => {
        onChange({
            type: 'range',
            value,
        });
    }, []);
    if (field.rule?.type !== 'range') return null;

    if (!range) {
        return (
            <div className="h-12 w-full relative">
                <LoadingLayer />
            </div>
        );
    }
    return (
        <div className="flex flex-col space-y-2 p-2">
            <label>{field.name}:</label>
            <div className="flex space-x-1 w-full h-8 items-center">
                <label>{field.rule.value[0]}</label>
                <Slider min={range[0]} max={range[1]} value={field.rule.value as [number, number]} onChange={handleChange} />
                <label>{field.rule.value[1]}</label>
            </div>
        </div>
    );
};
