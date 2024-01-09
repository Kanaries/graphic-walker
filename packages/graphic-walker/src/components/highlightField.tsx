import React, { useState, useRef, useImperativeHandle } from 'react';

export interface TextFieldProps {
    placeholder?: string;
    onChange?: (v: string) => void;
}

export function highlightField(highlighter: (value: string) => string) {
    return React.forwardRef<{ clear(): void; setValue(value: string): void; }, TextFieldProps>(function TextField({ placeholder, onChange }, ref) {
        const [value, setValue] = useState('');
        const divRef = useRef<HTMLDivElement>(null);
        const highlightValue = highlighter(value);
        useImperativeHandle(ref, () => ({
            clear() {
                divRef.current && (divRef.current.innerHTML = '');
                setValue('');
            },
            setValue(value) {
                divRef.current && (divRef.current.innerHTML = value);
                setValue(value);
            },
        }));
        return (
            <div className="relative w-full text-gray-700 dark:text-gray-200 rounded-md border-0 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400  sm:text-sm sm:leading-6 dark:bg-zinc-900">
                <div className="absolute whitespace-pre inset-0 pointer-events-none py-1 px-2" dangerouslySetInnerHTML={{ __html: highlightValue }} />
                {placeholder && value === '' && <div className="py-1 px-2 pointer-events-none text-gray-400 absolute inset-0 select-none">{placeholder}</div>}
                <div
                    ref={divRef}
                    contentEditable="plaintext-only"
                    onInput={(e) => {
                        const text = e.currentTarget.textContent ?? '';
                        setValue(text);
                        onChange?.(text);
                    }}
                    className="py-1 px-2 focus-visible:ring-1 focus-visible:ring-inset rounded-md border-0 focus-visible:ring-indigo-600 text-transparent caret-gray-700 dark:caret-gray-200 focus-visible:outline-none"
                ></div>
            </div>
        );
    });
}
