import React, { createContext, useCallback, useContext, useRef } from 'react';
import { DraggableFieldState, IDraggableStateKey } from '../interfaces';
import {
    DragDropContext,
    DropResult,
    ResponderProvided,
    DraggableLocation,
    Sensor,
    useKeyboardSensor,
    useMouseSensor,
    useTouchSensor,
} from '@kanaries/react-beautiful-dnd';
import { useVizStore } from '../store';
import { proxied } from '../utils/proxy';
window['__react-beautiful-dnd-disable-dev-warnings'] = true;
window['__react-beautiful-dnd-disable-scroll-hack'] = true;

export const blockContext = createContext<React.RefObject<HTMLDivElement>>({ current: null });

export function refMapper<T extends HTMLElement>(refCallback: (node: T | null) => void) {
    const block = useContext(blockContext);
    return useCallback(
        (node: T | null) => {
            if (node === null) return refCallback(null);
            const n = Object.defineProperty(node, 'getBoundingClientRect', {
                get() {
                    return () => {
                        const blockRect = block.current?.getBoundingClientRect();
                        const rect = HTMLElement.prototype.getBoundingClientRect.call(node);
                        if (!blockRect) return rect;
                        return new DOMRect(rect.x - blockRect.x, rect.y - blockRect.y, rect.width, rect.height);
                    };
                },
                configurable: true,
            });
            refCallback(n);
        },
        [refCallback]
    );
}

function sensorMapper(sensor: Sensor): Sensor {
    return (api) => {
        const block = useContext(blockContext);
        const proxiedAPI = proxied(api, {
            tryGetLock: (req, next) => {
                const i = next(...req);
                if (i === null) return null;
                return proxied(i, {
                    fluidLift: ([pos], next) => {
                        const rect = block.current?.getBoundingClientRect();
                        const target = rect
                            ? next({
                                  x: pos.x - rect.x,
                                  y: pos.y - rect.y,
                              })
                            : next(pos);
                        return proxied(target, {
                            move: ([pos], next) => {
                                const rect = block.current?.getBoundingClientRect();
                                if (rect) {
                                    next({
                                        x: pos.x - rect.x,
                                        y: pos.y - rect.y,
                                    });
                                } else {
                                    next(pos);
                                }
                                return target;
                            },
                        });
                    },
                });
            },
        });
        return sensor(proxiedAPI);
    };
}

const sensors = [useMouseSensor, useTouchSensor, useKeyboardSensor].map(sensorMapper);

export const FieldsContextWrapper: React.FC<{ children?: React.ReactNode | Iterable<React.ReactNode> }> = (props) => {
    const vizStore = useVizStore();
    const blockRef = useRef<HTMLDivElement>(null);
    const onDragEnd = useCallback(
        (result: DropResult, provided: ResponderProvided) => {
            if (!result.destination) {
                vizStore.removeField(result.source.droppableId as keyof DraggableFieldState, result.source.index);
                return;
            }
            const destination = result.destination as DraggableLocation;
            if (destination.droppableId === result.source.droppableId) {
                if (destination.index === result.source.index) return;
                vizStore.reorderField(destination.droppableId as keyof DraggableFieldState, result.source.index, destination.index);
            } else {
                let sourceKey = result.source.droppableId as keyof DraggableFieldState;
                let targetKey = destination.droppableId as keyof DraggableFieldState;
                vizStore.moveField(sourceKey, result.source.index, targetKey, destination.index);
            }
        },
        [vizStore]
    );
    return (
        <blockContext.Provider value={blockRef}>
            <div className="scale-100" ref={blockRef}>
                <DragDropContext enableDefaultSensors={false} sensors={sensors} onDragEnd={onDragEnd} onDragStart={() => {}} onDragUpdate={() => {}}>
                    {props.children}
                </DragDropContext>
            </div>
        </blockContext.Provider>
    );
};

export default FieldsContextWrapper;

export const DRAGGABLE_STATE_KEYS: Readonly<IDraggableStateKey[]> = [
    { id: 'columns', mode: 0 },
    { id: 'rows', mode: 0 },
    { id: 'color', mode: 1 },
    { id: 'opacity', mode: 1 },
    { id: 'size', mode: 1 },
    { id: 'shape', mode: 1 },
    { id: 'theta', mode: 1 },
    { id: 'radius', mode: 1 },
    { id: 'longitude', mode: 1 },
    { id: 'latitude', mode: 1 },
    { id: 'geoId', mode: 1 },
    { id: 'filters', mode: 1 },
    { id: 'details', mode: 1 },
    { id: 'text', mode: 1 },
] as const;
