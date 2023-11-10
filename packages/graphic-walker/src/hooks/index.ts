import React from 'react';
import { useState, useEffect, useRef } from 'react';

export function useDebounceValue<T>(value: T, timeout = 200): T {
    const [innerValue, setInnerValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setInnerValue(value), timeout);
        return () => clearTimeout(handler);
    }, [value]);
    return innerValue;
}

export function useDebounceValueBind<T>(value: T, setter: (v: T) => void, timeout = 200): [T, (v: T) => void] {
    const [innerValue, setInnerValue] = useState(value);
    const valueToSet = useDebounceValue(innerValue, timeout);
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
}
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
