import React, { useState, useRef, useImperativeHandle } from 'react';

export interface TextFieldProps {
    placeholder?: string;
    onChange?: (v: string) => void;
}

export function highlightField(highlighter: (value: string) => string) {
    return React.forwardRef<{ clear(): void; setValue(value: string): void }, TextFieldProps>(function TextField({ placeholder, onChange }, ref) {
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
            <div className="relative flex min-h-[60px] w-full rounded-md border border-input bg-transparent text-sm shadow-sm">
                <div className="absolute whitespace-pre inset-0 pointer-events-none px-3 py-2" dangerouslySetInnerHTML={{ __html: highlightValue }} />
                {placeholder && value === '' && (
                    <div className="px-3 py-2 pointer-events-none text-muted-foreground absolute inset-0 select-none">{placeholder}</div>
                )}
                <div
                    ref={divRef}
                    contentEditable="plaintext-only"
                    onInput={(e) => {
                        const text = e.currentTarget.textContent ?? '';
                        setValue(text);
                        onChange?.(text);
                    }}
                    className="px-3 py-2 w-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 rounded-md border-0 text-transparent caret-foreground"
                ></div>
            </div>
        );
    });
}
