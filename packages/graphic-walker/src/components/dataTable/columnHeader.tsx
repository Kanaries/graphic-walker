import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, ChevronDownIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/16/solid';
import type { IMutField, ISemanticType } from '../../interfaces';
import { cn } from '../../utils';
import DataTypeIcon from '../dataTypeIcon';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';

export type ISortDirection = 'ascending' | 'descending';

interface ColumnHeaderProps {
    field: IMutField;
    sort?: ISortDirection;
    filtered?: boolean;
    hideSemanticType?: boolean;
    semanticTypeOptions: { value: ISemanticType; label: string }[];
    /** cycles descending → ascending → none; omitted when sorting is disabled */
    onToggleSort?: () => void;
    onSort?: (sort: ISortDirection | null) => void;
    /** opens the filter dialog; omitted when filtering is disabled */
    onFilter?: () => void;
    onClearFilter?: () => void;
    /** omitted when the semantic type is read-only */
    onChangeSemanticType?: (semanticType: ISemanticType) => void;
}

const itemClassName = 'gap-2.5 text-[13px]';

function SemanticTypeItems(props: Pick<ColumnHeaderProps, 'field' | 'semanticTypeOptions' | 'onChangeSemanticType'>) {
    const { field, semanticTypeOptions, onChangeSemanticType } = props;
    return (
        <>
            {semanticTypeOptions.map((option) => (
                <DropdownMenuItem key={option.value} className={itemClassName} onSelect={() => onChangeSemanticType?.(option.value)}>
                    <span className="flex w-4 justify-center">
                        <DataTypeIcon dataType={option.value} analyticType={field.analyticType} />
                    </span>
                    <span className="first-letter:uppercase">{option.label}</span>
                    {option.value === field.semanticType && <CheckIcon className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
            ))}
        </>
    );
}

export function ColumnHeader(props: ColumnHeaderProps) {
    const { field, sort, filtered, hideSemanticType, semanticTypeOptions, onToggleSort, onSort, onFilter, onClearFilter, onChangeSemanticType } = props;
    const { t } = useTranslation('translation', { keyPrefix: 'data_table' });
    const name = field.basename || field.name || field.fid;
    const typeLabel = semanticTypeOptions.find((x) => x.value === field.semanticType)?.label ?? field.semanticType;
    const chipClassName = cn(
        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors',
        field.analyticType === 'dimension' ? 'bg-dimension/[0.14]' : 'bg-measure/[0.14]'
    );
    const canChangeType = !!onChangeSemanticType && !hideSemanticType;
    const hasMenu = !!(onSort || onFilter || canChangeType);
    // keeps focus inside the filter dialog instead of handing it back to the menu trigger
    const openingDialog = useRef(false);

    return (
        <div className="relative flex h-[22px] min-w-0 items-center gap-2">
            {!hideSemanticType &&
                (canChangeType ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                data-testid="data-table-semantic-type"
                                aria-label={`${t('semantic_type')}: ${typeLabel}`}
                                title={typeLabel}
                                className={cn(
                                    chipClassName,
                                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                                    field.analyticType === 'dimension'
                                        ? 'hover:bg-dimension/25 data-[state=open]:bg-dimension/25'
                                        : 'hover:bg-measure/25 data-[state=open]:bg-measure/25'
                                )}
                            >
                                <DataTypeIcon dataType={field.semanticType} analyticType={field.analyticType} />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">{t('semantic_type')}</DropdownMenuLabel>
                            <SemanticTypeItems field={field} semanticTypeOptions={semanticTypeOptions} onChangeSemanticType={onChangeSemanticType} />
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <span className={chipClassName} title={typeLabel}>
                        <DataTypeIcon dataType={field.semanticType} analyticType={field.analyticType} />
                    </span>
                ))}
            {onToggleSort ? (
                <button
                    type="button"
                    className="min-w-0 truncate rounded-sm text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    title={name}
                    onClick={onToggleSort}
                >
                    {name}
                </button>
            ) : (
                <span className="min-w-0 truncate text-[13px] font-semibold" title={name}>
                    {name}
                </span>
            )}
            {sort === 'descending' && <ArrowDownIcon className="h-3 w-3 shrink-0" aria-hidden />}
            {sort === 'ascending' && <ArrowUpIcon className="h-3 w-3 shrink-0" aria-hidden />}
            {filtered && <FunnelIcon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />}
            {hasMenu && (
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            data-testid="data-table-column-menu"
                            aria-label={t('column_options', { name })}
                            className={cn(
                                'absolute right-0 top-0 flex h-[22px] w-[22px] items-center justify-center rounded-md bg-background text-muted-foreground',
                                'shadow-[-10px_0_8px_-2px_hsl(var(--background))] transition-opacity hover:bg-muted hover:text-foreground',
                                'opacity-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover/th:opacity-100',
                                'data-[state=open]:bg-muted data-[state=open]:text-foreground data-[state=open]:opacity-100'
                            )}
                        >
                            <ChevronDownIcon className="h-3.5 w-3.5" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        className="w-52"
                        onCloseAutoFocus={(e) => {
                            if (openingDialog.current) {
                                openingDialog.current = false;
                                e.preventDefault();
                            }
                        }}
                    >
                        {onSort && (
                            <>
                                <DropdownMenuItem className={itemClassName} onSelect={() => onSort('ascending')}>
                                    <ArrowUpIcon className="h-4 w-4 text-muted-foreground" />
                                    {t('sort_asc')}
                                    {sort === 'ascending' && <CheckIcon className="ml-auto h-4 w-4" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem className={itemClassName} onSelect={() => onSort('descending')}>
                                    <ArrowDownIcon className="h-4 w-4 text-muted-foreground" />
                                    {t('sort_desc')}
                                    {sort === 'descending' && <CheckIcon className="ml-auto h-4 w-4" />}
                                </DropdownMenuItem>
                                {sort && (
                                    <DropdownMenuItem className={itemClassName} onSelect={() => onSort(null)}>
                                        <XMarkIcon className="h-4 w-4 text-muted-foreground" />
                                        {t('clear_sort')}
                                    </DropdownMenuItem>
                                )}
                            </>
                        )}
                        {onFilter && (
                            <>
                                {onSort && <DropdownMenuSeparator />}
                                <DropdownMenuItem
                                    className={itemClassName}
                                    data-testid="data-table-filter"
                                    onSelect={() => {
                                        openingDialog.current = true;
                                        onFilter();
                                    }}
                                >
                                    <FunnelIcon className="h-4 w-4 text-muted-foreground" />
                                    {t('filter')}
                                </DropdownMenuItem>
                                {filtered && onClearFilter && (
                                    <DropdownMenuItem className={itemClassName} onSelect={onClearFilter}>
                                        <XMarkIcon className="h-4 w-4 text-muted-foreground" />
                                        {t('clear_filter')}
                                    </DropdownMenuItem>
                                )}
                            </>
                        )}
                        {canChangeType && (
                            <>
                                {(onSort || onFilter) && <DropdownMenuSeparator />}
                                <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">{t('semantic_type')}</DropdownMenuLabel>
                                <SemanticTypeItems field={field} semanticTypeOptions={semanticTypeOptions} onChangeSemanticType={onChangeSemanticType} />
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    );
}
