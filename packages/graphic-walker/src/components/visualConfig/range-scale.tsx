import React, { useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

const SliderContainer = styled.div`
    padding-top: 8px;
    .thumb,
    .thumb::-webkit-slider-thumb {
        -webkit-appearance: none;
    }

    .thumb {
        pointer-events: none;
        position: absolute;
        height: 0;
        width: 200px;
        outline: none;
    }

    .thumb--left {
        z-index: 3;
    }

    .thumb--right {
        z-index: 4;
    }

    .thumb::-webkit-slider-thumb {
        background-color: #f1f5f7;
        border: none;
        border-radius: 50%;
        box-shadow: 0 0 1px 1px #ced4da;
        cursor: pointer;
        height: 18px;
        width: 18px;
        margin-top: 4px;
        pointer-events: all;
        position: relative;
    }

    .thumb::-moz-range-thumb {
        background-color: #f1f5f7;
        border: none;
        border-radius: 50%;
        box-shadow: 0 0 1px 1px #ced4da;
        cursor: pointer;
        height: 18px;
        width: 18px;
        margin-top: 4px;
        pointer-events: all;
        position: relative;
    }
`;

function Checkbox(props: { inputKey: string; title: string; value: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="flex justify-center items-center space-x-1 text-xs">
            <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                checked={props.value}
                id={`${props.inputKey}`}
                aria-describedby={`${props.inputKey}_label`}
                title={props.title}
                onChange={({ target: { checked } }) => props.onChange(checked)}
            />
            <label id={`${props.inputKey}_label`} htmlFor={`${props.inputKey}`} title={props.title}>
                {props.title}
            </label>
        </div>
    );
}

const MultiRangeSlider = ({ min, max, minVal, maxVal, setMinVal, setMaxVal, factor }) => {
    const minValRef = useRef(minVal);
    const maxValRef = useRef(maxVal);
    const range = useRef<HTMLDivElement>(null);

    // Convert to percentage
    const getPercent = useCallback((value) => Math.round(((value - min) / (max - min)) * 100), [min, max]);

    // Set width of the range to decrease from the left side
    useEffect(() => {
        const minPercent = getPercent(minVal);
        const maxPercent = getPercent(maxValRef.current);

        if (range.current) {
            range.current.style.left = `${minPercent}%`;
            range.current.style.width = `${maxPercent - minPercent}%`;
        }
    }, [minVal, getPercent]);

    // Set width of the range to decrease from the right side
    useEffect(() => {
        const minPercent = getPercent(minValRef.current);
        const maxPercent = getPercent(maxVal);

        if (range.current) {
            range.current.style.width = `${maxPercent - minPercent}%`;
        }
    }, [maxVal, getPercent]);

    return (
        <SliderContainer>
            <input
                type="range"
                min={min * factor}
                max={max * factor}
                value={minVal * factor}
                onChange={(event) => {
                    const value = Math.min(Number(event.target.value), maxVal * factor - 1);
                    setMinVal(value / factor);
                    minValRef.current = value / factor;
                }}
                className="thumb thumb--left"
                style={{ zIndex: minVal > max - 100 ? '5' : undefined }}
            />
            <input
                type="range"
                min={min * factor}
                max={max * factor}
                value={maxVal * factor}
                onChange={(event) => {
                    const value = Math.max(Number(event.target.value), minVal * factor + 1);
                    setMaxVal(value / factor);
                    maxValRef.current = value / factor;
                }}
                className="thumb thumb--right"
            />

            <div className="relative w-48">
                <div className="absolute rounded h-1 bg-gray-200 dark:bg-gray-700 w-full z-[1]" />
                <div ref={range} className="absolute rounded h-1 bg-indigo-400 z-[2]" />
                <div className="text-xs absolute left-1.5 text-gray-900 dark:text-gray-50 mt-3">{minVal}</div>
                <div className="text-xs absolute -right-1 text-gray-900 dark:text-gray-50 mt-3">{maxVal}</div>
            </div>
        </SliderContainer>
    );
};

export function RangeScale(props: {
    text: string;
    maxRange: number;
    minRange: number;
    enableMaxDomain: boolean;
    enableMinDomain: boolean;
    enableRange: boolean;
    rangeMax: number;
    rangeMin: number;
    domainMax: number;
    domainMin: number;
    setEnableMinDomain: (v: boolean) => void;
    setEnableMaxDomain: (v: boolean) => void;
    setEnableRange: (v: boolean) => void;
    setDomainMin: (v: number) => void;
    setDomainMax: (v: number) => void;
    setRangeMin: (v: number) => void;
    setRangeMax: (v: number) => void;
}) {
    const { t } = useTranslation();

    return (
        <div className="flex space-x-6 my-2">
            <div className="flex flex-col space-y-1 items-start">
                <Checkbox
                    inputKey={`min_domain_${props.text}`}
                    value={props.enableMinDomain}
                    title={t('config.min_domain')}
                    onChange={props.setEnableMinDomain}
                />
                <input
                    value={props.domainMin}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!isNaN(v)) {
                            props.setDomainMin(v);
                        }
                    }}
                    type="number"
                    disabled={!props.enableMinDomain}
                    className="block w-full rounded-md border-0 py-1 px-2 text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 dark:bg-zinc-900 dark:border-gray-700 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                />
            </div>
            <div className="flex flex-col space-y-1 items-start">
                <Checkbox
                    inputKey={`max_domain_${props.text}`}
                    value={props.enableMaxDomain}
                    title={t('config.max_domain')}
                    onChange={props.setEnableMaxDomain}
                />
                <input
                    value={props.domainMax}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!isNaN(v)) {
                            props.setDomainMax(v);
                        }
                    }}
                    type="number"
                    disabled={!props.enableMaxDomain}
                    className="block w-full rounded-md border-0 py-1 px-2 text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 dark:bg-zinc-900 dark:border-gray-700 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                />
            </div>
            <div className="flex flex-col space-y-1 items-start w-48">
                <Checkbox inputKey={`range_${props.text}`} value={props.enableRange} title={t('config.range')} onChange={props.setEnableRange} />
                <MultiRangeSlider
                    max={props.maxRange}
                    min={props.minRange}
                    maxVal={props.rangeMax}
                    minVal={props.rangeMin}
                    setMaxVal={props.setRangeMax}
                    setMinVal={props.setRangeMin}
                    factor={props.maxRange < 2 ? 100 : 1}
                />
            </div>
        </div>
    );
}
