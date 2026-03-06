import React, { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

function cx(...classes: Array<string | undefined>) {
    return classes.filter(Boolean).join(' ');
}

export const FieldListContainer: React.FC<{
    name: string;
    style?: Omit<CSSProperties, 'translate'>;
    children?: React.ReactNode | Iterable<React.ReactNode>;
}> = (props) => {
    const { t } = useTranslation('translation', { keyPrefix: 'constant.draggable_key' });

    return (
        <FieldListSegment className="sm:ml-0.5 my-0.5 border relative" style={props.style}>
            <div className="fl-header border-r cursor-default select-none">
                <h4 className="font-normal">{t(props.name)}</h4>
            </div>
            <div className="fl-container overflow-hidden">{props.children}</div>
        </FieldListSegment>
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

export const FieldsContainer = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(function FieldsContainer({ className, ...props }, ref) {
    return <div ref={ref} className={cx('flex p-[0.2em] min-h-[2.4em] flex-wrap touch-none [&>div]:m-px', className)} {...props} />;
});

export const FilterFieldsContainer = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(function FilterFieldsContainer({ className, ...props }, ref) {
    return <div ref={ref} className={cx('flex flex-col py-[0.5em] pb-[0.8em] px-[0.2em] min-h-[4em] [&>div]:my-[0.3em] [&>div]:mx-px', className)} {...props} />;
});

export const FieldListSegment = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(function FieldListSegment({ className, ...props }, ref) {
    return (
        <div
            ref={ref}
            className={cx('flex text-xs [&_.fl-header]:w-[100px] [&_.fl-header]:shrink-0 [&_.fl-header_h4]:m-[0.6em] [&_.fl-header_h4]:font-normal [&_.fl-container]:grow-[10] [&_.fl-container]:relative', className)}
            {...props}
        />
    );
});

export const FilterFieldSegment = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(function FilterFieldSegment({ className, ...props }, ref) {
    return (
        <div
            ref={ref}
            className={cx(
                'border border-[#e5e7eb] dark:border-[#2d3748] text-xs m-[0.2em] [&_.flt-header]:border-b [&_.flt-header]:border-[#e5e7eb] dark:[&_.flt-header]:border-[#2d3748] [&_.flt-header]:p-[0.6em] [&_.flt-header_h4]:font-normal',
                className
            )}
            {...props}
        />
    );
});

export const Pill = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'> & { colType: 'discrete' | 'continuous' }>(function Pill(
    { colType, className, ...props },
    ref
) {
    return (
        <div
            ref={ref}
            className={cx(
                'items-center rounded-md border box-border cursor-default flex text-xs h-5 min-w-[150px] max-w-[300px] px-[10px] select-none text-ellipsis whitespace-nowrap',
                colType === 'continuous' ? 'bg-background border-muted-foreground text-foreground' : 'bg-primary border-background text-primary-foreground',
                className
            )}
            {...props}
        />
    );
});
