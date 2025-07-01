import { HexColorPicker, HexColorInput } from 'react-colorful';
import React from 'react';

export const StyledPicker = (props: { color: string; onChange: (color: string) => void; presetColors?: string[] }) => {
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
