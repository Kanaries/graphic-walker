import styled from 'styled-components';
import { SketchPicker } from 'react-color';
import { useState, useEffect, useRef } from 'react';
import { extractRGB } from '../util';

const StyledPicker = styled(SketchPicker)<{ noShadow?: boolean; noBorder?: boolean }>`
    --tw-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    --tw-shadow-colored: 0 4px 6px -1px var(--tw-shadow-color), 0 2px 4px -2px var(--tw-shadow-color);
    box-shadow: ${({ noShadow }) =>
        noShadow ? 'none' : 'var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow)'} !important;
    border-color: hsl(var(--border)) !important;
    border-width: ${({ noBorder }) => (noBorder ? '0' : '1px')} !important;
    background: hsl(var(--popover)) !important;
    color: hsl(var(--popover-foreground)) !important;
    .flexbox-fix {
        border-color: hsl(var(--border)) !important;
    }
    label {
        color: hsl(var(--popover-foreground)) !important;
    }
    input {
        box-shadow: none !important;
        border-radius: calc(var(--radius) - 2px) !important;
        border: 1px solid hsl(var(--input)) !important;
        background-color: transparent !important;
        width: 100% !important;
    }
`;

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
