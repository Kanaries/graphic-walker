import * as React from 'react';

import { cn } from '@/utils';
import { useRefControledState } from '@/hooks';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const NumberInput = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, value, onChange, ...props }, ref) => {
    const [uncontrolledValue, setUncontrolledValue] = useRefControledState(value);

    return (
        <input
            type="number"
            className={cn(
                'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                className
            )}
            ref={ref}
            value={uncontrolledValue}
            onChange={(e) => {
                setUncontrolledValue(e.target.value);
            }}
            onBlur={(e) => {
                onChange?.(e);
            }}
            {...props}
        />
    );
});
NumberInput.displayName = 'NumberInput';

export { NumberInput };
