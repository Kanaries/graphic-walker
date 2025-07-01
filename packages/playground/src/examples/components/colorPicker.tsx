import { HexColorPicker, HexColorInput } from 'react-colorful';
import { ErrorBoundary } from 'react-error-boundary';
import React from 'react';

const DEFAULT_COLOR_SCHEME = ['#5B8FF9', '#FF6900', '#FCB900', '#7BDCB5', '#00D084', '#8ED1FC', '#0693E3', '#ABB8C3', '#EB144C', '#F78DA7', '#9900EF'];

const StyledPicker = (props: { color: string; onChange: (color: string) => void; presetColors?: string[] }) => {
    return (
        <div className="flex flex-col gap-2 p-2 bg-background rounded-md border shadow">
            <div className="h-min">
                <HexColorPicker color={props.color} onChange={props.onChange} />
            </div>
            <HexColorInput
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                color={props.color}
                onChange={props.onChange}
            />
            {props.presetColors && (
                <div className="flex flex-wrap gap-1">
                    {props.presetColors.map((color) => (
                        <div
                            key={color}
                            className="w-6 h-6 rounded-full cursor-pointer"
                            style={{ backgroundColor: color }}
                            onClick={() => props.onChange(color)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// Utility functions for color conversion
const rgbaToHex = (r: number, g: number, b: number): string => {
    const toHex = (n: number) => {
        const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const hexToRgba = (hex: string): { r: number; g: number; b: number; a: number } => {
    // Remove # if present
    hex = hex.replace('#', '');

    // Handle short hex format (e.g., #fff)
    if (hex.length === 3) {
        hex = hex
            .split('')
            .map((char) => char + char)
            .join('');
    }

    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    return { r, g, b, a: 1 };
};

export const ColorPickerComponent = ({
    defaultColor,
    setDefaultColor,
    setPrimaryColorEdited,
    displayColorPicker,
    setDisplayColorPicker,
}: {
    defaultColor: { r: number; g: number; b: number; a: number };
    setDefaultColor: (color: { r: number; g: number; b: number; a: number }) => void;
    setPrimaryColorEdited: (edited: boolean) => void;
    displayColorPicker: boolean;
    setDisplayColorPicker: (display: boolean) => void;
}) => {
    return (
        <ErrorBoundary
            fallback={
                <div className="flex space-x-2">
                    <div
                        className="w-4 h-4"
                        style={{
                            backgroundColor: `rgba(${defaultColor.r},${defaultColor.g},${defaultColor.b},${defaultColor.a})`,
                        }}
                    />
                    <input
                        value={defaultColor.r}
                        type="number"
                        onChange={(e) => {
                            setPrimaryColorEdited(true);
                            setDefaultColor({
                                ...defaultColor,
                                r: Number(e.target.value),
                            });
                        }}
                    />
                    <input
                        value={defaultColor.g}
                        type="number"
                        onChange={(e) => {
                            setPrimaryColorEdited(true);
                            setDefaultColor({
                                ...defaultColor,
                                g: Number(e.target.value),
                            });
                        }}
                    />
                    <input
                        value={defaultColor.b}
                        type="number"
                        onChange={(e) => {
                            setPrimaryColorEdited(true);
                            setDefaultColor({
                                ...defaultColor,
                                b: Number(e.target.value),
                            });
                        }}
                    />
                </div>
            }
        >
            <div
                className="relative"
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                }}
            >
                <div
                    className="w-8 h-5 border-2"
                    style={{ backgroundColor: `rgba(${defaultColor.r},${defaultColor.g},${defaultColor.b},${defaultColor.a})` }}
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setDisplayColorPicker(true);
                    }}
                ></div>
                <div className="absolute left-0 top-8 z-40 shadow-sm">
                    {displayColorPicker && (
                        <StyledPicker
                            presetColors={DEFAULT_COLOR_SCHEME}
                            color={rgbaToHex(defaultColor.r, defaultColor.g, defaultColor.b)}
                            onChange={(hexColor) => {
                                setPrimaryColorEdited(true);
                                const rgbaColor = hexToRgba(hexColor);
                                setDefaultColor({
                                    ...rgbaColor,
                                    a: defaultColor.a, // preserve alpha
                                });
                            }}
                        />
                    )}
                </div>
            </div>
        </ErrorBoundary>
    );
};

// Simple Picker component for backward compatibility
export function Picker(props: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
    const [displayColorPicker, setDisplayColorPicker] = React.useState(false);
    const pickerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
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

    // Convert hex to RGBA for the new color picker
    const hexToRgbaColor = (hex: string) => {
        const rgba = hexToRgba(hex);
        return rgba;
    };

    // Convert RGBA back to hex
    const rgbaToHexColor = (color: { r: number; g: number; b: number; a: number }) => {
        return rgbaToHex(color.r, color.g, color.b);
    };

    const [colorState, setColorState] = React.useState(() => hexToRgbaColor(props.value));

    React.useEffect(() => {
        setColorState(hexToRgbaColor(props.value));
    }, [props.value]);

    return (
        <ColorPickerComponent
            defaultColor={colorState}
            setDefaultColor={(color) => {
                setColorState(color);
                props.onChange(rgbaToHexColor(color));
            }}
            setPrimaryColorEdited={() => {}}
            displayColorPicker={displayColorPicker && !props.disabled}
            setDisplayColorPicker={(display) => {
                if (!props.disabled) {
                    setDisplayColorPicker(display);
                }
            }}
        />
    );
}
