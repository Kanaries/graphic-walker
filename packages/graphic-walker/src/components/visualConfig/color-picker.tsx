import { StyledPicker } from '../color-picker';
import { ErrorBoundary } from 'react-error-boundary';
import React from 'react';
import { Input } from '../ui/input';
const DEFAULT_COLOR_SCHEME = ['#5B8FF9', '#FF6900', '#FCB900', '#7BDCB5', '#00D084', '#8ED1FC', '#0693E3', '#ABB8C3', '#EB144C', '#F78DA7', '#9900EF'];

export const ColorPickerComponent = ({ defaultColor, setDefaultColor, setPrimaryColorEdited, displayColorPicker, setDisplayColorPicker }) => {
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
                            setDefaultColor((x) => ({ ...x, r: Number(e.target.value) }));
                        }}
                    />
                    <Input
                        value={defaultColor.g}
                        type="number"
                        onChange={(e) => {
                            setPrimaryColorEdited(true);
                            setDefaultColor((x) => ({ ...x, g: Number(e.target.value) }));
                        }}
                    />
                    <Input
                        value={defaultColor.b}
                        type="number"
                        onChange={(e) => {
                            setPrimaryColorEdited(true);
                            setDefaultColor((x) => ({ ...x, b: Number(e.target.value) }));
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
                            color={defaultColor}
                            onChange={(color) => {
                                setPrimaryColorEdited(true);
                                setDefaultColor({
                                    ...color.rgb,
                                    a: color.rgb.a ?? 1,
                                });
                            }}
                        />
                    )}
                </div>
            </div>
        </ErrorBoundary>
    );
};
