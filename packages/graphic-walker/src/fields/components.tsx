import React, { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { GLOBAL_CONFIG } from '../config';

export const FieldListContainer: React.FC<{
    name: string;
    style?: Omit<CSSProperties, 'translate'>;
    children?: React.ReactNode | Iterable<React.ReactNode>;
}> = (props) => {
    const { t } = useTranslation('translation', { keyPrefix: 'constant.draggable_key' });

    return (
        <div className="flex text-xs sm:ml-0.5 my-0.5 border relative" style={props.style}>
            <div className="w-[100px] flex-shrink-0 border-r cursor-default select-none">
                <h4 className="m-[0.6em] font-normal text-xs leading-[0.875rem]">{t(props.name)}</h4>
            </div>
            <div className="flex-grow-[10] relative overflow-hidden">{props.children}</div>
        </div>
    );
};

export const AestheticFieldContainer: React.FC<{ name: string; style?: CSSProperties; children?: React.ReactNode | Iterable<React.ReactNode> }> = (props) => {
    const { t } = useTranslation('translation', { keyPrefix: 'constant.draggable_key' });

    return (
        <div className="my-0.5 sm:mx-0.5 text-xs border" style={props.style}>
            <div className="border-b p-2 cursor-default select-none">
                <h4 className="font-normal">{t(props.name)}</h4>
            </div>
            <div>{props.children}</div>
        </div>
    );
};

export const FilterFieldContainer: React.FC<{ children?: React.ReactNode | Iterable<React.ReactNode> }> = (props) => {
    const { t } = useTranslation('translation', { keyPrefix: 'constant.draggable_key' });

    return (
        <div className="my-0.5 sm:mx-0.5 text-xs border">
            <div className="border-b p-2 cursor-default select-none">
                <h4 className="font-normal">{t('filters')}</h4>
            </div>
            <div>{props.children}</div>
        </div>
    );
};

export const FieldsContainer = React.forwardRef<HTMLDivElement, { 
    children?: React.ReactNode; 
    className?: string;
    [key: string]: any;
}>(({ children, className = '', ...props }, ref) => (
    <div ref={ref} className={`flex p-0.5 min-h-[2.4em] flex-wrap touch-none [&>div]:m-px ${className}`} {...props}>
        {children}
    </div>
));

FieldsContainer.displayName = 'FieldsContainer';

export const FilterFieldsContainer = React.forwardRef<HTMLDivElement, { 
    children?: React.ReactNode; 
    className?: string;
    [key: string]: any;
}>(({ children, className = '', ...props }, ref) => (
    <div ref={ref} className={`flex flex-col py-2 px-0.5 min-h-[4em] [&>div]:my-1.5 [&>div]:mx-px ${className}`} {...props}>
        {children}
    </div>
));

FilterFieldsContainer.displayName = 'FilterFieldsContainer';


export const FilterFieldSegment: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`border border-gray-200 dark:border-gray-700 text-xs m-0.5 ${className}`}>
        {children}
    </div>
);

export const Pill = React.forwardRef<HTMLDivElement, { 
    colType: 'discrete' | 'continuous';
    children?: React.ReactNode;
    className?: string;
    [key: string]: any;
}>(({ colType, children, className = '', ...props }, ref) => {
    const baseClasses = "flex items-center rounded-sm border box-border cursor-default text-xs h-5 min-w-[150px] max-w-[300px] px-2.5 select-none truncate whitespace-nowrap";
    const typeClasses = colType === 'continuous' 
        ? "bg-background border-muted-foreground text-foreground"
        : "bg-primary border-background text-primary-foreground";
    
    return (
        <div ref={ref} className={`${baseClasses} ${typeClasses} ${className}`} {...props}>
            {children}
        </div>
    );
});

Pill.displayName = 'Pill';
