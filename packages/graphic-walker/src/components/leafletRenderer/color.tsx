import React from 'react';
import { IField } from '../../interfaces';
import { ColorDisplay } from './encodings';

const MAX_COLORS = 15;

export default function ColorPanel(props: { display: ColorDisplay; field: IField; aggerated?: boolean }) {
    const { display, field, aggerated } = props;
    const fieldName = aggerated && field.analyticType === 'measure' && field.aggName ? `${field.aggName}(${field.name})` : field.name;
    return (
        <div className="absolute right-5 top-5 bg-popover/30 rounded p-2" style={{ zIndex: 999 }}>
            {display.type === 'nominal' && (
                <div className="font-xs flex flex-col space-y-1">
                    <div className="font-medium max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap">{fieldName}</div>
                    {display.colors.slice(0, MAX_COLORS).map(({ name, color }) => {
                        return (
                            <div className="flex space-x-1 items-center" key={name}>
                                <div className="w-3 h-3" style={{ backgroundColor: color }}></div>
                                <div>{name}</div>
                            </div>
                        );
                    })}
                    {display.colors.length > MAX_COLORS && (
                        <div className="flex space-x-1 items-center">
                            <div className="w-3 h-3" style={{ backgroundColor: display.colors[MAX_COLORS].color }}></div>
                            <div>...{display.colors.length - MAX_COLORS} entries</div>
                        </div>
                    )}
                </div>
            )}
            {display.type === 'quantitative' && (
                <div className="font-xs flex flex-col space-y-1">
                    <div className="font-medium max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap">{fieldName}</div>
                    <div className="flex space-x-1">
                        <div
                            className="w-4 h-48"
                            style={{
                                background: `linear-gradient(${[...display.color].reverse().join(',')})`,
                            }}
                        ></div>
                        <div className="font-xs flex flex-col justify-between">
                            <div>{Math.floor(display.domain[1])}</div>
                            <div>{Math.floor(display.domain[1] * 0.75 + display.domain[0] * 0.25)}</div>
                            <div>{Math.floor(display.domain[1] * 0.5 + display.domain[0] * 0.5)}</div>
                            <div>{Math.floor(display.domain[1] * 0.25 + display.domain[0] * 0.75)}</div>
                            <div>{Math.floor(display.domain[0])}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
