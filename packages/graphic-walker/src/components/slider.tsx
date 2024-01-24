import * as Slider from '@radix-ui/react-slider';
import React from 'react';

export default (props: { min: number; max: number; value: [number, number]; onChange: (v: [number, number]) => void }) => {
    return (
        <Slider.Root
            className="relative flex w-full touch-none select-none items-center"
            value={props.value}
            minStepsBetweenThumbs={1}
            min={props.min}
            max={props.max}
            onValueChange={props.onChange}
        >
            <Slider.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <Slider.Range className="absolute h-full bg-zinc-900 dark:bg-white" />
            </Slider.Track>
            <Slider.Thumb className="block h-4 w-4 outline-none rounded-full border shadow border-zinc-900 dark:border-white bg-white dark:bg-zinc-900 disabled:pointer-events-none disabled:opacity-50" />
            <Slider.Thumb className="block h-4 w-4 outline-none rounded-full border shadow border-zinc-900 dark:border-white bg-white dark:bg-zinc-900 disabled:pointer-events-none disabled:opacity-50" />
        </Slider.Root>
    );
};
