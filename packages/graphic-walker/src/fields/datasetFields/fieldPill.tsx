import React from 'react';

/**
 * react-beautiful-dnd v13.1.0 bug
 * https://github.com/atlassian/react-beautiful-dnd/issues/2361
 */
export const FieldPill = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'> & { isDragging: boolean }>(function FieldPill(
    { isDragging, className, style, ...props },
    ref
) {
    return (
        <div
            {...props}
            ref={ref}
            className={`gw-field-pill select-none items-center overflow-hidden ${className ?? ''}`}
            style={{
                ...style,
                ...(isDragging ? {} : { transform: 'translate(0px, 0px)' }),
            }}
        />
    );
});
