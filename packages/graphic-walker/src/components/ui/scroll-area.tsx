import * as React from 'react';

import { cn } from '@/utils';

const ScrollArea = React.forwardRef<HTMLDivElement, React.HTMLProps<HTMLDivElement>>(({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('relative overflow-auto dark:[color-scheme:dark]', className)} {...props}>
        {children}
    </div>
));

export { ScrollArea };
