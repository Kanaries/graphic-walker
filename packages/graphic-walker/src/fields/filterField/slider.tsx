import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { filter, fromEvent, map, throttleTime } from 'rxjs';
import { useTranslation } from 'react-i18next';

const SliderContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: stretch;
    overflow: hidden;
    padding-block: 1em;

    > .output {
        display: flex;
        justify-content: space-between;
        margin-top: 1em;

        > output {
            width: 100%;
        }

        > output:first-child {
            margin-right: 0.5em;
        }

        > output:last-child {
            margin-left: 0.5em;
        }
    }
`;

const SliderElement = styled.div`
    margin-inline: 0.5em;
    padding: 1em;
    flex-grow: 1;
    flex-shrink: 1;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: stretch;
`;

const SliderTrack = styled.div`
    flex-grow: 1;
    flex-shrink: 1;
    background-color: #ccc;
    height: 5px;
    border-radius: 3px;
    position: relative;
`;

const SliderThumb = styled.div`
    position: absolute;
    top: 50%;
    cursor: ew-resize;
    background-color: #fff;
    width: 2em;
    height: 2em;
    border-radius: 1em;
    outline: none;
    box-shadow: 0 4px 6px 2px rgba(0, 0, 0, 0.1);

    &:hover {
        background-color: #fff;
    }
`;

const SliderSlice = styled.div`
    position: absolute;
    height: 100%;
`;

const nicer = (range: readonly [number, number], value: number): string => {
    if (typeof value !== 'number') {
        console.warn('Expected a number but received', typeof value);
        return '';
    }
    const precision = /(\.\d*)$/.exec(((range[1] - range[0]) / 1000).toString())?.[0].length;
    return precision === undefined ? `${value}` : value.toFixed(precision).replace(/\.?0+$/, '');
};

interface ValueInputProps {
    min: number;
    max: number;
    value: number;
    resetValue: number;
    onChange: (value: number) => void;
}

const ValueInput: React.FC<ValueInputProps> = (props) => {
    const { min, max, value, resetValue, onChange } = props;
    const [innerValue, setInnerValue] = useState(`${value}`);

    const handleSubmitValue = () => {
        const v = Number(innerValue);
        if (!isNaN(v) && v <= max && v >= min) {
            onChange(v);
        } else {
            onChange(resetValue);
            setInnerValue(`${resetValue}`);
        }
    };

    useEffect(() => {
        setInnerValue(`${value}`);
    }, [value]);

    return (
        <input
            type="number"
            min={min}
            max={max}
            className="block w-full rounded-md border-0 py-1 px-2 text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 dark:bg-zinc-900 dark:border-gray-700 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
            value={innerValue}
            onChange={(e) => setInnerValue(e.target.value)}
            onBlur={handleSubmitValue}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    handleSubmitValue();
                }
            }}            
        />
    );
};

interface SliderProps {
    min: number;
    max: number;
    value: readonly [number, number];
    onChange: (value: readonly [number, number]) => void;
}

const Slider: React.FC<SliderProps> = React.memo(function Slider ({
    min,
    max,
    value,
    onChange,
}) {
    const [dragging, setDragging] = React.useState<'left' | 'right' | null>(null);
    const trackRef = React.useRef<HTMLDivElement | null>(null);
    const sliceRef = React.useRef<HTMLDivElement | null>(null);

    const range: typeof value = [
        (value[0] - min) / ((max - min) || 1),
        (value[1] - min) / ((max - min) || 1)
    ];

    const mouseOffsetRef = React.useRef(0);

    const { t } = useTranslation();

    useEffect(() => {
        if (dragging) {
            const stop = (ev?: MouseEvent) => {
                setDragging(null);
                ev?.stopPropagation();
            };

            const dragHandler = fromEvent(document.body, 'mousemove').pipe(
                map(ev => {
                    if (!trackRef.current || !dragging) {
                        return null;
                    }

                    if ((ev as MouseEvent).buttons !== 1) {
                        stop();

                        return null;
                    }

                    const { x, width } = trackRef.current.getBoundingClientRect();

                    const pos = Math.min(
                        dragging === 'left' ? range[1] : 1,
                        Math.max(
                            dragging === 'right' ? range[0] : 0,
                            ((ev as MouseEvent).clientX - mouseOffsetRef.current - x) / width
                        )
                    );

                    return pos;
                }),
                throttleTime(100),
                filter(pos => {
                    return pos !== null && pos !== range[dragging === 'left' ? 0 : 1];
                }),
            ).subscribe(pos => {
                const next: [number, number] = [...range];
                next[dragging === 'left' ? 0 : 1] = pos as number;

                next[0] = next[0] * ((max - min) || 1) + min;
                next[1] = next[1] * ((max - min) || 1) + min;

                onChange(next);
            });
            
            document.body.addEventListener('mouseup', stop);
            
            return () => {
                document.body.removeEventListener('mouseup', stop);
                dragHandler.unsubscribe();
            };
        }
    }, [dragging, range, onChange, min, max]);

    return (
        <SliderContainer>
            <SliderElement>
                <SliderTrack
                    ref={e => trackRef.current = e}
                >
                    <SliderSlice
                        role="presentation"
                        ref={e => sliceRef.current = e}
                        className="bg-indigo-600"
                        style={{
                            left: `${range[0] * 100}%`,
                            width: `${(range[1] - range[0]) * 100}%`,
                        }}
                    />
                    <SliderThumb
                        role="slider"
                        aria-label="minimum"
                        id="slider:min"
                        aria-valuemin={min}
                        aria-valuemax={max}
                        aria-valuenow={value[0]}
                        aria-valuetext={nicer([min, max], value[0])}
                        tabIndex={-1}
                        onMouseDown={ev => {
                            if (ev.buttons === 1) {
                                mouseOffsetRef.current = ev.nativeEvent.offsetX - (ev.target as HTMLDivElement).getBoundingClientRect().width;
                                setDragging('left');
                            }
                        }}
                        style={{
                            left: `calc(1em + ${range[0] * 100}%)`,
                            transform: 'translate(-100%, -50%)',
                        }}
                    />
                    <SliderThumb
                        role="slider"
                        aria-label="maximum"
                        id="slider:max"
                        aria-valuemin={min}
                        aria-valuemax={max}
                        aria-valuenow={value[1]}
                        aria-valuetext={nicer([min, max], value[1])}
                        tabIndex={-1}
                        onMouseDown={ev => {
                            if (ev.buttons === 1) {
                                mouseOffsetRef.current = ev.nativeEvent.offsetX;
                                setDragging('right');
                            }
                        }}
                        style={{
                            left: `calc(${range[1] * 100}% - 1em)`,
                            transform: 'translate(0, -50%)',
                        }}
                    />
                </SliderTrack>
            </SliderElement>
            <div className="output">
                <output htmlFor="slider:min">
                    <div className="my-1">{t('filters.range.start_value')}</div>
                    {
                        <ValueInput
                            min={min}
                            max={value[1]}
                            value={value[0]}
                            resetValue={min}
                            onChange={(newValue) => onChange([newValue, value[1]])} 
                        />
                    }
                </output>
                <output htmlFor="slider:max">
                    <div className="my-1">{t('filters.range.end_value')}</div>
                    {
                        <ValueInput
                            min={value[0]}
                            max={max}
                            value={value[1]}
                            resetValue={max}
                            onChange={(newValue) => onChange([value[0], newValue])} 
                        />
                    }
                </output>
            </div>
        </SliderContainer>
    );
});


export default Slider;
