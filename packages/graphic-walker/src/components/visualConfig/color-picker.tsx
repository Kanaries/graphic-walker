import { StyledPicker } from '../color-picker';
import { ErrorBoundary } from 'react-error-boundary';
import React from 'react';
import { Input } from '../ui/input';

const DEFAULT_COLOR_SCHEME = ['#5B8FF9', '#FF6900', '#FCB900', '#7BDCB5', '#00D084', '#8ED1FC', '#0693E3', '#ABB8C3', '#EB144C', '#F78DA7', '#9900EF'];

// Utility functions for color conversion
const rgbaToHex = (r: number, g: number, b: number, a: number = 1): string => {
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
        hex = hex.split('').map(char => char + char).join('');
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
                    <Input
                        value={defaultColor.r}
                        type="number"
                        onChange={(e) => {
                            setPrimaryColorEdited(true);
                            setDefaultColor({ 
                                ...defaultColor, 
                                r: Number(e.target.value) 
                            });
                        }}
                    />
                    <Input
                        value={defaultColor.g}
                        type="number"
                        onChange={(e) => {
                            setPrimaryColorEdited(true);
                            setDefaultColor({ 
                                ...defaultColor, 
                                g: Number(e.target.value) 
                            });
                        }}
                    />
                    <Input
                        value={defaultColor.b}
                        type="number"
                        onChange={(e) => {
                            setPrimaryColorEdited(true);
                            setDefaultColor({ 
                                ...defaultColor, 
                                b: Number(e.target.value) 
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
                            color={rgbaToHex(defaultColor.r, defaultColor.g, defaultColor.b, defaultColor.a)}
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
