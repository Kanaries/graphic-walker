import React from 'react';
import { getCircle } from '../../lib/paint';

export const Cursor = (props: { color: string; dia: number; factor: number; style?: React.CSSProperties; className?: string }) => {
    const { className, color, dia, factor, style } = props;
    const pixels = React.useMemo(() => {
        const result: [number, number, number][] = new Array(dia).fill(0).map((_, i) => [i, Infinity, -1]);
        getCircle(dia).forEach(([x, y]) => {
            result[y][1] = Math.min(x, result[y][1]);
            result[y][2] = Math.max(x, result[y][1]);
        });
        return result.filter((x) => x[1] !== Infinity);
    }, [dia]);
    return (
        <div className={className} style={style}>
            <div
                className="relative"
                style={{
                    width: factor * dia,
                    height: factor * dia,
                }}
            >
                {pixels.map(([y, from, to]) => (
                    <div
                        className="absolute"
                        key={`cursor_${y}`}
                        style={{
                            background: color,
                            width: (to - from + 1) * factor,
                            height: factor,
                            opacity: 0.6,
                            top: y * factor,
                            left: from * factor,
                        }}
                    ></div>
                ))}
            </div>
        </div>
    );
};

export const PixelContainer = (props: {
    color: string;
    dia: number;
    factor: number;
    offsetX: number;
    offsetY: number;
    children?: React.ReactNode | Iterable<React.ReactNode>;
}) => {
    const { color, dia, factor, offsetX, offsetY, children } = props;
    const [cursorPos, setCursorPos] = React.useState<[number, number] | null>(null);
    const center = (dia - (dia % 2)) / 2;
    return (
        <div
            className="relative"
            onMouseOut={() => setCursorPos(null)}
            onMouseMoveCapture={(e) => setCursorPos([e.nativeEvent.offsetX, e.nativeEvent.offsetY])}
        >
            {children}
            {cursorPos !== null && (
                <Cursor
                    className="absolute pointer-events-none"
                    color={color}
                    factor={factor}
                    dia={dia}
                    style={{
                        left: Math.floor((cursorPos[0] - offsetX) / factor) * factor + offsetX - center * factor,
                        top: Math.floor((cursorPos[1] - offsetY) / factor) * factor + offsetY - center * factor,
                    }}
                />
            )}
        </div>
    );
};
