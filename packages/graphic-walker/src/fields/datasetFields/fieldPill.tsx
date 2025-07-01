import React from 'react';

/**
 * react-beautiful-dnd v13.1.0 bug
 * https://github.com/atlassian/react-beautiful-dnd/issues/2361
 */
export const FieldPill = React.forwardRef<
    HTMLDivElement,
    {
        isDragging: boolean;
        children?: React.ReactNode;
        className?: string;
        [key: string]: any;
    }
>(({ isDragging, children, className = '', ...props }, ref) => {
    const baseClasses =
        "select-none items-center overflow-hidden [&>*:not(span)]:flex-none [&>span]:flex-1 [&>span]:inline-block [&>span]:px-0.5 [&>span]:overflow-hidden [&>span]:text-ellipsis [&>span]:whitespace-nowrap has-[[role='button']:hover]:bg-transparent";
    const transformClass = !isDragging ? '[transform:translate(0px,0px)!important]' : '';

    return (
        <div ref={ref} className={`${baseClasses} ${transformClass} ${className}`} {...props}>
            {children}
        </div>
    );
});

FieldPill.displayName = 'FieldPill';
