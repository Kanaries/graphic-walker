import { createElement, forwardRef, useImperativeHandle, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { createWorksheet } from './runtime/worksheet';
import type { WorksheetInput, WorksheetOptions, WorksheetEvents } from './runtime/types';

export type WorksheetController = ReturnType<typeof createWorksheet>;
export interface WorksheetHandle {
    getController(): WorksheetController | undefined;
}
export interface WorksheetProps {
    input: WorksheetInput;
    options?: WorksheetOptions;
    className?: string;
    style?: CSSProperties;
    onReady?: (event: WorksheetEvents['ready']) => void;
    onSelectionChange?: (event: WorksheetEvents['selectionChange']) => void;
    onDiagnostic?: (event: WorksheetEvents['diagnostic']) => void;
    onViewStateChange?: (event: WorksheetEvents['viewStateChange']) => void;
    onController?: (controller: WorksheetController | undefined) => void;
}

/** React owns one controller lifecycle. Data and marks stay outside the React tree. */
export const Worksheet = forwardRef<WorksheetHandle, WorksheetProps>(function Worksheet(props, forwardedRef) {
    const host = useRef<HTMLDivElement>(null);
    const controller = useRef<WorksheetController | undefined>(undefined);
    const applied = useRef<WorksheetInput | undefined>(undefined);
    const latest = useRef(props);
    latest.current = props;
    // Options contain only static scalar values. Changing sizing ownership requires a fresh controller.
    const optionsKey = JSON.stringify(props.options ?? {});
    useImperativeHandle(forwardedRef, () => ({ getController: () => controller.current }), []);
    useLayoutEffect(() => {
        if (!host.current) return;
        const current = createWorksheet(host.current, latest.current.input, latest.current.options);
        controller.current = current;
        applied.current = latest.current.input;
        const unsubscribe = [
            current.on('ready', (event) => latest.current.onReady?.(event)),
            current.on('selectionChange', (event) => latest.current.onSelectionChange?.(event)),
            current.on('diagnostic', (event) => latest.current.onDiagnostic?.(event)),
            current.on('viewStateChange', (event) => latest.current.onViewStateChange?.(event)),
        ];
        latest.current.onController?.(current);
        return () => {
            for (const stop of unsubscribe) stop();
            current.dispose();
            if (controller.current === current) {
                controller.current = undefined;
                applied.current = undefined;
            }
            latest.current.onController?.(undefined);
        };
    }, [optionsKey]);
    useLayoutEffect(() => {
        if (controller.current && applied.current !== props.input) {
            applied.current = props.input;
            void controller.current.update(props.input);
        }
    }, [props.input, optionsKey]);
    return createElement('div', { ref: host, className: props.className, style: { width: '100%', height: '100%', ...props.style } });
});
