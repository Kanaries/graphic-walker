import * as Slider from '@radix-ui/react-slider';
import React from 'react';
import { useDebounceValueBind } from '../hooks';

export default (props: { min: number; max: number; value: [number, number]; onChange: (v: [number, number]) => void }) => {
    const [innerValue, setInnerValue] = useDebounceValueBind(props.value, props.onChange);
    return (
        <div className="flex space-x-2 w-full">
            <label>{innerValue[0]}</label>
            <Slider.Root
                className="relative flex w-full touch-none select-none items-center"
                value={innerValue}
                minStepsBetweenThumbs={1}
                min={props.min}
                max={props.max}
                onValueChange={(v) => setInnerValue(v as [number, number])}
            >
                <Slider.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <Slider.Range className="absolute h-full bg-zinc-900 dark:bg-white" />
                </Slider.Track>
                <Slider.Thumb className="block h-5 w-5 outline-none rounded-full border-2 border-zinc-900 dark:border-white bg-white dark:bg-zinc-900 disabled:pointer-events-none disabled:opacity-50" />
                <Slider.Thumb className="block h-5 w-5 outline-none rounded-full border-2 border-zinc-900 dark:border-white bg-white dark:bg-zinc-900 disabled:pointer-events-none disabled:opacity-50" />
            </Slider.Root>
            <label>{innerValue[1]}</label>
        </div>
    );
};
