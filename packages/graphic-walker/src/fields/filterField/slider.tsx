import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { filter, fromEvent, map, throttleTime } from 'rxjs';
import { useTranslation } from 'react-i18next';

const SliderContainer = styled.div({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'stretch',
    overflow: 'hidden',
    paddingBlock: '1em',

    '> .output': {
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: "1em",
        '> output': {
            width: '100%'
        },
        '> output:first-child': {
            marginRight: '0.5em'
        },
        '> output:last-child': {
            marginLeft: '0.5em'
        }
    }
});

const SliderElement = styled.div({
    marginInline: '0.5em',
    padding: '1em',
    flexGrow: 1,
    flexShrink: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'stretch',
});

const SliderTrack = styled.div({
    flexGrow: 1,
    flexShrink: 1,
    backgroundColor: '#ccc',
    height: '5px',
    borderRadius: '3px',
    position: 'relative',
});

const SliderThumb = styled.div({
    position: 'absolute',
    top: '50%',
    cursor: 'ew-resize',
    backgroundColor: '#fff',
    width: '2em',
    height: '2em',
    borderRadius: '1em',
    outline: 'none',
    boxShadow: '0 4px 6px 2px rgb(0 0 0 / 0.1)',

    ':hover': {
        backgroundColor: '#fff',
    },
});

const SliderSlice = styled.div({
    position: 'absolute',
    height: '100%'
});


const nicer = (range: readonly [number, number], value: number): string => {
    const precision = /(\.\d*)$/.exec(((range[1] - range[0]) / 1000).toString())?.[0].length;
    
    return precision === undefined ? `${value}` : value.toFixed(precision).replace(/\.?0+$/, '');
};

interface SliderProps {
    min: number;
    max: number;
    value: readonly [number, number];
    onChange: (value: readonly [number, number]) => void;
    isDateTime?: boolean;
}

const Slider: React.FC<SliderProps> = React.memo(function Slider ({
    min,
    max,
    value,
    onChange,
    isDateTime = false,
}) {
    const [dragging, setDragging] = React.useState<'left' | 'right' | null>(null);
    const trackRef = React.useRef<HTMLDivElement | null>(null);
    const sliceRef = React.useRef<HTMLDivElement | null>(null);
    const [inputValue, setInputValue] = useState(['', '']);

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

    useEffect(() => {
        setInputValue([String(nicer([min, max], value[0])), String(nicer([min, max], value[1]))])
    }, [value])

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
                        aria-valuetext={isDateTime ? `${new Date(value[0])}` : nicer([min, max], value[0])}
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
                        aria-valuetext={isDateTime ? `${new Date(value[1])}` : nicer([min, max], value[1])}
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
                        <input
                            type="text"
                            className="block w-full rounded-md border-0 py-1 px-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            value={inputValue[0]}
                            onChange={(e) => {
                                setInputValue([e.target.value, inputValue[0]])
                            }}
                            onBlur={() => {
                                let newNumVal = Number(inputValue[0]);
                                if (!isNaN(newNumVal) && newNumVal <= value[1] && newNumVal >= min) {
                                    onChange([newNumVal, value[1]]);
                                } else {
                                    onChange([min, value[1]]);
                                }
                            }}
                        />
                    }
                </output>
                <output htmlFor="slider:max">
                    <div className="my-1">{t('filters.range.end_value')}</div>
                    {
                        <input
                            type="text"
                            className="block w-full rounded-md border-0 py-1 px-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            value={inputValue[1]}
                            onChange={(e) => {
                                setInputValue([inputValue[0], e.target.value])
                            }}
                            onBlur={() => {
                                let newNumVal = Number(inputValue[1]);
                                if (!isNaN(newNumVal) && newNumVal >= value[0] && newNumVal <= max) {
                                    onChange([value[0], newNumVal]);
                                } else {
                                    onChange([value[0], max]);
                                }
                            }}
                        />
                    }
                </output>
            </div>
        </SliderContainer>
    );
});


export default Slider;
