import React, { useEffect } from 'react';
import { getCircle } from '../../lib/paint';
import { SketchPicker } from 'react-color';
import DefaultButton from '../button/default';
import { ShadowDomContext } from '../../shadow-dom';

export const PixelCursor = (props: { color: string; dia: number; factor: number; style?: React.CSSProperties; className?: string }) => {
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

// export const Container = (props: { color: string; cursor: CursorDef; children?: React.ReactNode | Iterable<React.ReactNode>; showPreview?: boolean }) => {
//     const { color, cursor, children, showPreview } = props;
//     const [cursorPos, setCursorPos] = React.useState<[number, number] | null>(null);
//     return (
//         <div
//             className="relative cursor-none"
//             onMouseOut={() => setCursorPos(null)}
//             onMouseMoveCapture={(e) => setCursorPos([e.nativeEvent.offsetX, e.nativeEvent.offsetY])}
//             onTouchMoveCapture={(e) => {
//                 const rect = e.currentTarget.getBoundingClientRect();
//                 setCursorPos([e.changedTouches[0].pageX - rect.left, e.changedTouches[0].pageY - rect.top]);
//             }}
//             onTouchEnd={() => setCursorPos(null)}
//         >
//             {children}
//             {cursorPos !== null && cursor.type === 'circle' && (
//                 <div
//                     className="absolute pointer-events-none"
//                     style={{
//                         background: color,
//                         width: cursor.dia * cursor.factor,
//                         height: cursor.dia * cursor.factor,
//                         borderRadius: cursor.dia * cursor.factor,
//                         opacity: 0.6,
//                         left: cursorPos[0] - (cursor.dia * cursor.factor) / 2,
//                         top: cursorPos[1] - (cursor.dia * cursor.factor) / 2,
//                     }}
//                 />
//             )}
//             {showPreview && !cursorPos && cursor.type === 'circle' && (
//                 <div
//                     className="absolute pointer-events-none"
//                     style={{
//                         background: color,
//                         width: cursor.dia * cursor.factor,
//                         height: cursor.dia * cursor.factor,
//                         borderRadius: cursor.dia * cursor.factor,
//                         opacity: 0.6,
//                         left: `calc(50% - ${(cursor.dia * cursor.factor) / 2}px)`,
//                         top: `calc(50% - ${(cursor.dia * cursor.factor) / 2}px)`,
//                     }}
//                 />
//             )}
//         </div>
//     );
// };

export type CursorDef =
    | {
          type: 'circle';
          dia: number;
          factor: number;
      }
    | {
          type: 'rect';
          x: number;
          xFactor: number;
          y: number;
          yFactor: number;
      };

export const PixelContainer = (props: {
    color: string;
    cursor: CursorDef;
    offsetX: number;
    offsetY: number;
    children?: React.ReactNode | Iterable<React.ReactNode>;
    showPreview?: boolean;
}) => {
    const { color, cursor, offsetX, offsetY, children, showPreview } = props;
    const [cursorPos, setCursorPos] = React.useState<[number, number] | null>(null);
    return (
        <div
            className="relative cursor-none"
            onMouseOut={() => setCursorPos(null)}
            onMouseMoveCapture={(e) => setCursorPos([e.nativeEvent.offsetX, e.nativeEvent.offsetY])}
            onTouchMoveCapture={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setCursorPos([e.changedTouches[0].pageX - rect.left, e.changedTouches[0].pageY - rect.top]);
            }}
            onTouchEnd={() => setCursorPos(null)}
        >
            {children}
            {cursorPos !== null && cursor.type === 'rect' && (
                <>
                    <div
                        className="absolute pointer-events-none"
                        style={{
                            backgroundColor: color,
                            left:
                                Math.floor((cursorPos[0] - offsetX) / cursor.xFactor) * cursor.xFactor +
                                offsetX -
                                ((cursor.x - (cursor.x % 2)) / 2) * cursor.xFactor,
                            top:
                                Math.floor((cursorPos[1] - offsetY) / cursor.yFactor) * cursor.yFactor +
                                offsetY -
                                ((cursor.y - (cursor.y % 2)) / 2 - 1 + (cursor.y % 2)) * cursor.yFactor,
                            width: cursor.x * cursor.xFactor,
                            height: cursor.y * cursor.yFactor,
                            opacity: 0.6,
                        }}
                    />
                    <div
                        className="absolute pointer-events-none bg-black dark:bg-white"
                        style={{
                            width: 16,
                            height: 16,
                            borderRadius: 16,
                            opacity: 0.4,
                            left: cursorPos[0] - 8,
                            top: cursorPos[1] - 8,
                        }}
                    />
                </>
            )}
            {showPreview && !cursorPos && cursor.type === 'rect' && (
                <div
                    className="absolute pointer-events-none"
                    style={{
                        backgroundColor: color,
                        width: cursor.x * cursor.xFactor,
                        height: cursor.y * cursor.yFactor,
                        opacity: 0.6,
                        left: `calc(50% - ${((cursor.x - (cursor.x % 2)) / 2) * cursor.xFactor}px)`,
                        top: `calc(50% - ${((cursor.y - (cursor.y % 2)) / 2) * cursor.yFactor}px)`,
                    }}
                />
            )}
            {cursorPos !== null && cursor.type === 'circle' && (
                <PixelCursor
                    className="absolute pointer-events-none"
                    color={color}
                    factor={cursor.factor}
                    dia={cursor.dia}
                    style={{
                        left:
                            Math.floor((cursorPos[0] - offsetX) / cursor.factor) * cursor.factor +
                            offsetX -
                            ((cursor.dia - (cursor.dia % 2)) / 2) * cursor.factor,
                        top:
                            Math.floor((cursorPos[1] - offsetY) / cursor.factor) * cursor.factor +
                            offsetY -
                            ((cursor.dia - (cursor.dia % 2)) / 2 - 1 + (cursor.dia % 2)) * cursor.factor,
                    }}
                />
            )}
            {showPreview && !cursorPos && cursor.type === 'circle' && (
                <PixelCursor
                    className="absolute pointer-events-none"
                    color={color}
                    factor={cursor.factor}
                    dia={cursor.dia}
                    style={{
                        left: `calc(50% - ${((cursor.dia - (cursor.dia % 2)) / 2) * cursor.factor}px)`,
                        top: `calc(50% - ${((cursor.dia - (cursor.dia % 2)) / 2) * cursor.factor}px)`,
                    }}
                />
            )}
        </div>
    );
};

export const ClickInput = (props: { value: string; onChange: (v: string) => void }) => {
    const [edit, setEdit] = React.useState(false);
    const doChange = (e: { target: HTMLInputElement }) => {
        if (e.target.value) props.onChange(e.target.value);
        setEdit(false);
    };

    return edit ? (
        <input
            autoFocus
            className="block w-full rounded border-0 py-1 px-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600"
            defaultValue={props.value}
            onBlur={doChange}
            onKeyUp={(e) => {
                if (e.key === 'Enter') {
                    doChange(e as unknown as { target: HTMLInputElement });
                    return false;
                } else {
                    return true;
                }
            }}
        />
    ) : (
        <label
            className="px-2 py-1 rounded hover:bg-blue-100 leading-6"
            onClick={() => {
                setEdit(true);
            }}
        >
            {props.value}
        </label>
    );
};

export const ColorEditor = (props: { color: string; onChangeColor: (color: string) => void; colors: string[] }) => {
    const [showColorEdit, setShowColorEdit] = React.useState(false);
    const [colorEdited, setColorEdited] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);
    const shadowDomMeta = React.useContext(ShadowDomContext);

    useEffect(() => {
        if (showColorEdit) {
            const listener = (e: Event) => {
                if (e.target && !ref.current?.contains(e.target as Node)) {
                    setShowColorEdit(false);
                }
            };
            const dom = shadowDomMeta.root;
            dom?.addEventListener('click', listener);
            return () => dom?.removeEventListener('click', listener);
        }
    }, [showColorEdit]);

    const [color, setColor] = React.useState(props.color);
    return (
        <div className="relative" ref={ref}>
            <div
                className="w-8 h-5 border-2"
                style={{ backgroundColor: props.color }}
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowColorEdit(true);
                    setColorEdited(false);
                    setColor(props.color);
                }}
            ></div>
            {showColorEdit && (
                <div className="absolute right-0 top-8 z-40 flex-col space-y-1 bg-white dark:bg-zinc-900 shadow-lg rounded-md border border-gray-100 dark:border-gray-800">
                    <SketchPicker
                        presetColors={props.colors}
                        color={color}
                        onChange={(color) => {
                            setColorEdited(true);
                            setColor(color.hex);
                        }}
                        styles={{ default: { picker: { border: 'none', boxShadow: 'none' } } }}
                    ></SketchPicker>
                    <div className="flex justify-end p-2">
                        <DefaultButton
                            text="Save"
                            onClick={() => {
                                setShowColorEdit(false);
                                if (colorEdited) {
                                    props.onChangeColor(color);
                                }
                            }}
                        ></DefaultButton>
                    </div>
                </div>
            )}
        </div>
    );
};
