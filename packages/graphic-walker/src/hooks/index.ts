import React, { useCallback } from 'react';
import { useState, useEffect, useRef } from 'react';

export function createStreamedValueHook(wrapper: <T>(emitter: (v: T) => void) => (v: T) => void) {
    return function useStreamedValue<T>(value: T) {
        const [innerValue, setInnerValue] = useState(value);
        const setter = useCallback(wrapper(setInnerValue), []);
        useEffect(() => setter(value), [value]);
        return innerValue;
    };
}

export function createStreamedValueBindHook(wrapper: <T>(emitter: (v: T) => void) => (v: T) => void) {
    const useStreamedValue = createStreamedValueHook(wrapper);
    return function useStreamedValueBind<T>(value: T, setter: (v: T) => void): [T, React.Dispatch<React.SetStateAction<T>>] {
        const [innerValue, setInnerValue] = useState(value);
        const valueToSet = useStreamedValue(innerValue);
        const first = useRef(true);
        useEffect(() => setInnerValue(value), [value]);
        useEffect(() => {
            if (first.current) {
                first.current = false;
            } else {
                setter(valueToSet);
            }
        }, [valueToSet]);
        return [innerValue, setInnerValue];
    };
}

function debouce(timeout = 200, leading = false) {
    return <T>(emitter: (v: T) => void): ((v: T) => void) => {
        const disposer = { current: null as (() => void) | null };
        let leadingFired = false;
        return (v) => {
            disposer.current?.();
            if (leading && disposer.current === null) {
                emitter(v);
                leadingFired = true;
            } else {
                leadingFired = false;
            }
            const handler = setTimeout(() => {
                if (leadingFired) {
                    disposer.current = null;
                } else {
                    emitter(v);
                    // clean dispoer after timeout so leading won't fire when trailing just fired.
                    const disposerToClean = disposer.current;
                    setTimeout(() => {
                        if (disposerToClean === disposer.current) {
                            disposer.current = null;
                        }
                    }, timeout);
                }
            }, timeout);
            disposer.current = () => {
                clearTimeout(handler);
            };
        };
    };
}

export const useKeyWord = createStreamedValueHook(debouce(200, true));
export const useDebounceValueBind = createStreamedValueBindHook(debouce());

/**
 * hook of state that change of value will change innerValue inplace, make reduced re-render.
 * @param value the Value to control
 */
export function useRefControledState<T>(value: T) {
    const [innerValue, setInnerValue] = React.useState<T>(value);
    const innerValueRef = React.useRef(innerValue);
    innerValueRef.current = innerValue;
    const valueRef = React.useRef(value);
    const useInner = React.useRef(false);
    if (valueRef.current !== value) {
        valueRef.current = value;
        useInner.current = false;
    }
    const setValue = React.useCallback((value: React.SetStateAction<T>) => {
        if (useInner.current) {
            setInnerValue(value);
        } else {
            useInner.current = true;
            setInnerValue(typeof value === 'function' ? (value as (item: T) => T)(valueRef.current) : value);
        }
    }, []);
    return [useInner.current ? innerValue : value, setValue] as const;
}
