import React from 'react';
import { Tooltip as TooltipRoot, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function Tooltip({
    content,
    children,
    ...props
}: React.ComponentPropsWithoutRef<typeof TooltipProvider> & { content?: React.ReactNode | Iterable<React.ReactNode> }) {
    return (
        <TooltipProvider {...props}>
            <TooltipRoot>
                <TooltipTrigger asChild>{children}</TooltipTrigger>
                <TooltipContent>{content}</TooltipContent>
            </TooltipRoot>
        </TooltipProvider>
    );
}
