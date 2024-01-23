import * as Slider from '@radix-ui/react-slider';
import React from 'react';

export default (props: { min: number; max: number; value: [number, number]; onChange: (v: [number, number]) => void }) => (
    <Slider.Root
        className="relative flex w-full touch-none select-none items-center"
        value={props.value}
        minStepsBetweenThumbs={1}
        min={props.min}
        max={props.max}
        onValueChange={(v) => props.onChange(v as [number, number])}
    >
        <Slider.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-500">
            <Slider.Range className="absolute h-full bg-indigo-500" />
        </Slider.Track>
        <Slider.Thumb className="block h-5 w-5 rounded-full border-2 border-indigo-500 bg-white dark:bg-zinc-900 disabled:pointer-events-none disabled:opacity-50" />
        <Slider.Thumb className="block h-5 w-5 rounded-full border-2 border-indigo-500 bg-white dark:bg-zinc-900 disabled:pointer-events-none disabled:opacity-50" />
    </Slider.Root>
);
