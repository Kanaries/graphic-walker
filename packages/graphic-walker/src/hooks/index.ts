import { useState, useEffect } from 'react';

export function useDebounceValue<T>(value: T, timeout = 200): T {
    const [innerValue, setInnerValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setInnerValue(value), timeout);
        return () => clearTimeout(handler);
    }, [value]);
    return innerValue;
}
