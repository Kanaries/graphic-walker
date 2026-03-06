import { SketchPicker } from 'react-color';
import { useState, useEffect, useRef, ComponentProps } from 'react';
import { extractRGB } from '../util';

const StyledPicker = ({ noShadow, noBorder, ...props }: ComponentProps<typeof SketchPicker> & { noShadow?: boolean; noBorder?: boolean }) => {
    return (
        <div className="gw-sketch-picker-wrap" data-no-shadow={noShadow ? 'true' : 'false'} data-no-border={noBorder ? 'true' : 'false'}>
            <SketchPicker {...props} className={`gw-sketch-picker ${props.className ?? ''}`.trim()} />
        </div>
    );
};

const DEFAULT_COLOR_SCHEME = ['#5B8FF9', '#FF6900', '#FCB900', '#7BDCB5', '#00D084', '#8ED1FC', '#0693E3', '#ABB8C3', '#EB144C', '#F78DA7', '#9900EF'];

export function Picker(props: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
    const [displayColorPicker, setDisplayColorPicker] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (displayColorPicker) {
            const listener = (event: MouseEvent) => {
                if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                    setDisplayColorPicker(false);
                }
            };
            document.addEventListener('click', listener);
            return () => document.removeEventListener('click', listener);
        }
    }, [displayColorPicker]);
    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
            }}
        >
            <div
                className="w-8 h-5 border-2"
                style={{ backgroundColor: props.value }}
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    !props.disabled && setDisplayColorPicker(true);
                }}
            ></div>
            <div className="absolute left-32 top-22 z-40 shadow-sm" ref={pickerRef}>
                {displayColorPicker && !props.disabled && (
                    <StyledPicker
                        disableAlpha
                        presetColors={DEFAULT_COLOR_SCHEME}
                        color={extractRGB(props.value)}
                        onChange={(color) => {
                            props.onChange(color.hex);
                        }}
                    />
                )}
            </div>
        </div>
    );
}
