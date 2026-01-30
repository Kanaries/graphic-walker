import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Spinner from '@/components/spinner';
import Tooltip from '@/components/tooltip';
import { useCompututaion, useVizStore } from '@/store';
import { fieldStat } from '@/computation';
import { GLOBAL_CONFIG } from '@/config';
import {
    IAnalyticType,
    IAggregator,
    ICustomSortType,
    IManualSortValue,
    IPaintMap,
    IPaintMapV2,
    ISemanticType,
    IViewField,
    ISortMode,
    IWindowAgg,
} from '@/interfaces';
import { DragDropContext, Draggable, Droppable, DropResult } from '@kanaries/react-beautiful-dnd';
import { COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID, PAINT_FIELD_ID } from '@/constants';
import { getMeaAggName } from '@/utils';

type ManualListItem = {
    value: IManualSortValue;
    id: string;
};

const DEFAULT_SORT_ORDER: Exclude<ISortMode, 'none'> = 'ascending';
type AggregatorSelectValue = IAggregator;

function asDisplayValue(value: IManualSortValue) {
    if (value === null) return 'null';
    if (value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
}

const FieldConfigDialog = observer(() => {
    const vizStore = useVizStore();
    const computation = useCompututaion();
    const { t } = useTranslation();

    const target = vizStore.fieldConfigTarget;
    const isOpen = vizStore.showFieldConfigPanel && Boolean(target);
    const currentField: IViewField | null = useMemo(() => {
        if (!target) return null;
        return vizStore.currentEncodings[target.channel]?.[target.index] ?? null;
    }, [target, vizStore.currentEncodings]);

    const [titleOverride, setTitleOverride] = useState('');
    const [sortType, setSortType] = useState<ICustomSortType>('measure');
    const [sortOrder, setSortOrder] = useState<ISortMode>('none');
    const [manualValues, setManualValues] = useState<ManualListItem[]>([]);
    const [loadingValues, setLoadingValues] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [aggValue, setAggValue] = useState<AggregatorSelectValue>('sum');
    const [semanticTypeState, setSemanticTypeState] = useState<ISemanticType>('nominal');
    const [analyticTypeState, setAnalyticTypeState] = useState<IAnalyticType>('dimension');
    const [customFormat, setCustomFormat] = useState('');
    const [windowAgg, setWindowAgg] = useState<IWindowAgg | 'none'>('none');
    const [manualSortDisabled, setManualSortDisabled] = useState(false);
    const [manualSortDisabledReason, setManualSortDisabledReason] = useState('');
    const [manualValuesFetched, setManualValuesFetched] = useState(false);
    const manualSortRequestIdRef = useRef(0);
    const [ready, setReady] = useState(false);

    const isMeasureField = analyticTypeState === 'measure';
    const isRowCountField = currentField?.fid === COUNT_FIELD_ID;
    const isInnerField = [MEA_VAL_ID, MEA_KEY_ID, PAINT_FIELD_ID].includes(currentField?.fid || '');
    const restrictToTitleAndFormatOnly = Boolean(isRowCountField);
    const disableTypeSelectors = Boolean(isInnerField || restrictToTitleAndFormatOnly);
    const isFetchingManualValues = loadingValues && sortType === 'manual';
    const defaultAggregated = vizStore.config.defaultAggregated;
    const allowWindowAgg =
        defaultAggregated &&
        isMeasureField &&
        semanticTypeState === 'quantitative' &&
        !isRowCountField &&
        !isInnerField;

    const allowSort = useMemo(() => {
        if (!target || !currentField) return false;
        if (analyticTypeState !== 'dimension') return false;
        if (semanticTypeState !== 'nominal' && semanticTypeState !== 'ordinal') return false;
        return target.channel === 'rows' || target.channel === 'columns';
    }, [target, analyticTypeState, semanticTypeState]);

    const specialManualValues = useMemo<ManualListItem[] | null>(() => {
        if (!currentField) return null;
        if (currentField.fid === MEA_KEY_ID) {
            const folds = vizStore.config.folds ?? [];
            const defaultAggregated = vizStore.config.defaultAggregated;
            const meaValField = vizStore.viewMeasures.find((field) => field.fid === MEA_VAL_ID);
            if (!folds.length) return [];
            return folds
                .map((fid) => vizStore.allFields.find((field) => field.fid === fid))
                .filter((field): field is IViewField => Boolean(field))
                .filter((field) => defaultAggregated || field.aggName !== 'expr')
                .map((field) => {
                    if (!defaultAggregated) {
                        return {
                            value: field.name,
                            id: `${MEA_KEY_ID}_${field.fid}`,
                        } satisfies ManualListItem;
                    }
                    const aggName = meaValField?.aggName ?? field.aggName;
                    return {
                        value: getMeaAggName(field.name, aggName, field.windowAgg),
                        id: `${MEA_KEY_ID}_${field.fid}`,
                    } satisfies ManualListItem;
                });
        }
        if (currentField.fid === PAINT_FIELD_ID) {
            const mapParam = currentField.expression?.params?.find((param) => param.type === 'map' || param.type === 'newmap');
            if (!mapParam) return [];
            const paintMap = mapParam.value as IPaintMap | IPaintMapV2;
            const orderSource = paintMap.usedColor && paintMap.usedColor.length ? paintMap.usedColor : Object.keys(paintMap.dict).map((key) => Number(key));
            const colorOrder = orderSource.filter((key, index, arr) => !Number.isNaN(key) && arr.indexOf(key) === index);
            return colorOrder
                .map((key) => {
                    const name = paintMap.dict[key]?.name;
                    if (!name) return null;
                    return {
                        value: name,
                        id: `${PAINT_FIELD_ID}_${key}`,
                    } as ManualListItem;
                })
                .filter((item): item is ManualListItem => Boolean(item));
        }
        return null;
    }, [currentField?.expression, currentField?.fid, vizStore.allFields, vizStore.config.defaultAggregated, vizStore.config.folds, vizStore.viewMeasures]);

    const aggregatorOptions = useMemo(() => GLOBAL_CONFIG.AGGREGATOR_LIST, []);
    const semanticTypeOptions: ISemanticType[] = ['nominal', 'ordinal', 'quantitative', 'temporal'];
    const analyticTypeOptions: IAnalyticType[] = ['dimension', 'measure'];
    const windowAggOptions: { value: IWindowAgg | 'none'; label: string }[] = [
        { value: 'none', label: 'None' },
        { value: 'running_total', label: 'Running total' },
        { value: 'difference', label: 'Difference' },
        { value: 'moving_average', label: 'Moving average' },
        { value: 'growth_rate', label: 'Compound growth rate' },
        { value: 'rank', label: 'Rank' },
    ];

    useEffect(() => {
        manualSortRequestIdRef.current += 1;
        if (!currentField) {
            setTitleOverride('');
            setSortType('measure');
            setSortOrder('none');
            setManualValues([]);
            setFetchError(null);
            setAggValue('sum');
            setSemanticTypeState('nominal');
            setAnalyticTypeState('dimension');
            setCustomFormat('');
            setManualSortDisabled(false);
            setManualSortDisabledReason('');
            setManualValuesFetched(false);
            setReady(false);
            return;
        }
        setTitleOverride(currentField.titleOverride ?? '');
        setSortType(currentField.sortType ?? 'measure');
        setSortOrder(currentField.sort ?? 'none');
        if (currentField.fid === MEA_KEY_ID || currentField.fid === PAINT_FIELD_ID) {
            setManualValues([]);
        } else {
            setManualValues((currentField.sortList ?? []).map((value, idx) => ({ value, id: `${currentField.fid}_${idx}` })));
        }
        setFetchError(null);
        setAggValue((currentField.aggName as AggregatorSelectValue) ?? 'sum');
        setSemanticTypeState(currentField.semanticType);
        setAnalyticTypeState(currentField.analyticType);
        setCustomFormat(currentField.customFormat ?? '');
        setWindowAgg(currentField.windowAgg ?? 'none');
        setManualSortDisabled(false);
        setManualSortDisabledReason('');
        setManualValuesFetched(false);
        setReady(true);
    }, [currentField?.fid, target?.channel, target?.index]);

    const handleAnalyticTypeChange = useCallback(
        (value: IAnalyticType) => {
            setAnalyticTypeState(value);
            if (value === 'dimension') {
                setAggValue('sum');
                setWindowAgg('none');
            } else if (value === 'measure') {
                setAggValue((GLOBAL_CONFIG.AGGREGATOR_LIST[0] as AggregatorSelectValue) ?? 'sum');
            }
        },
        [aggValue]
    );

    useEffect(() => {
        if (!allowWindowAgg && windowAgg !== 'none') {
            setWindowAgg('none');
        }
    }, [allowWindowAgg, windowAgg]);

    const hydrateValues = useCallback(async () => {
        if (!currentField || !allowSort || !ready || sortType !== 'manual') return;
        setFetchError(null);
        if (specialManualValues !== null) {
            setManualValuesFetched(true);
            setLoadingValues(false);
            const distinctTotal = specialManualValues.length;
            const limitExceeded = distinctTotal > 100;
            setManualSortDisabled(limitExceeded);
            setManualSortDisabledReason(limitExceeded ? `Manual sort supports up to 100 distinct values. ${distinctTotal} values detected.` : '');
            if (limitExceeded) {
                setManualValues([]);
                setSortType((prev) => (prev === 'manual' ? 'measure' : prev));
                return;
            }
            setManualValues((prev) => {
                if (prev.length > 0) return prev;
                return specialManualValues;
            });
            return;
        }
        const requestId = ++manualSortRequestIdRef.current;
        setManualValuesFetched(true);
        setLoadingValues(true);
        try {
            const stats = await fieldStat(
                computation,
                currentField,
                {
                    values: true,
                    range: false,
                    valuesMeta: true,
                    valuesLimit: 101,
                },
                vizStore.meta
            );
            if (requestId !== manualSortRequestIdRef.current) {
                return;
            }
            const distinctTotal = stats.valuesMeta?.distinctTotal ?? stats.values.length;
            const limitExceeded = distinctTotal > 100;
            setManualSortDisabled(limitExceeded);
            setManualSortDisabledReason(limitExceeded ? `Manual sort supports up to 100 distinct values. ${distinctTotal} values detected.` : '');
            if (limitExceeded) {
                setManualValues([]);
                setSortType((prev) => (prev === 'manual' ? 'measure' : prev));
                return;
            }
            if (stats.values.length) {
                setManualValues((prev) => {
                    if (prev.length > 0) return prev;
                    return stats.values.map((v, idx) => ({
                        value: v.value as IManualSortValue,
                        id: `${currentField.fid}_auto_${idx}`,
                    }));
                });
            }
        } catch (err) {
            if (requestId === manualSortRequestIdRef.current) {
                setFetchError(err instanceof Error ? err.message : String(err));
            }
        } finally {
            if (requestId === manualSortRequestIdRef.current) {
                setLoadingValues(false);
            }
        }
    }, [allowSort, ready, computation, currentField, sortType, vizStore.meta, specialManualValues]);

    useEffect(() => {
        if (isOpen && allowSort && currentField && sortType === 'manual' && !manualValuesFetched && !loadingValues) {
            hydrateValues();
        }
    }, [allowSort, currentField?.fid, hydrateValues, isOpen, loadingValues, manualValuesFetched, sortType, target?.channel, target?.index]);

    useEffect(() => {
        if (!currentField || sortType !== 'manual' || specialManualValues === null) return;
        const distinctTotal = specialManualValues.length;
        const limitExceeded = distinctTotal > 100;
        setManualSortDisabled(limitExceeded);
        setManualSortDisabledReason(limitExceeded ? `Manual sort supports up to 100 distinct values. ${distinctTotal} values detected.` : '');
        setManualValuesFetched(true);
        setLoadingValues(false);
        setFetchError(null);
        if (limitExceeded) {
            setManualValues([]);
            setSortType((prev) => (prev === 'manual' ? 'measure' : prev));
            return;
        }
        setManualValues((prev) => {
            if (prev.length === 0) {
                return specialManualValues;
            }
            const isSame =
                prev.length === specialManualValues.length &&
                prev.every((item, index) => item.id === specialManualValues[index].id && item.value === specialManualValues[index].value);
            if (isSame) return prev;
            const specialMap = new Map(specialManualValues.map((item) => [item.id, item]));
            const ordered: ManualListItem[] = [];
            prev.forEach((item) => {
                const replacement = specialMap.get(item.id);
                if (replacement) {
                    ordered.push(replacement);
                    specialMap.delete(item.id);
                }
            });
            specialMap.forEach((item) => ordered.push(item));
            return ordered;
        });
    }, [currentField, sortType, specialManualValues]);

    const handleRetryManualValues = useCallback(() => {
        if (loadingValues) return;
        setFetchError(null);
        setManualValuesFetched(false);
    }, [loadingValues]);

    const handleClose = useCallback(() => {
        vizStore.setShowFieldConfigPanel(false);
    }, [vizStore]);

    const handleSave = useCallback(() => {
        if (!target || !currentField) return;
        const trimmedTitle = titleOverride.trim();
        const trimmedFormat = customFormat.trim();
        const patch: Partial<IViewField> = {
            titleOverride: trimmedTitle ? trimmedTitle : undefined,
            semanticType: semanticTypeState,
            analyticType: analyticTypeState,
            customFormat: trimmedFormat ? trimmedFormat : undefined,
        };
        if (analyticTypeState === 'measure') {
            patch.aggName = aggValue;
        } else if (currentField.aggName) {
            patch.aggName = undefined;
        }
        if (allowSort) {
            if (sortType === 'manual') {
                patch.sortType = 'manual';
                patch.sortList = manualValues.map((item) => item.value);
                patch.sort = patch.sortList.length ? DEFAULT_SORT_ORDER : 'none';
            } else if (sortType === 'alphabetical') {
                patch.sortType = 'alphabetical';
                patch.sort = sortOrder === 'none' ? DEFAULT_SORT_ORDER : sortOrder;
                patch.sortList = undefined;
            } else {
                patch.sortType = 'measure';
                patch.sort = sortOrder;
                patch.sortList = undefined;
            }
        }
        if (allowWindowAgg && windowAgg !== 'none') {
            patch.windowAgg = windowAgg as IWindowAgg;
        } else if (currentField.windowAgg) {
            patch.windowAgg = undefined;
        }
        vizStore.editEncodingField(target.channel, target.index, patch);
        handleClose();
    }, [
        allowSort,
        allowWindowAgg,
        currentField,
        handleClose,
        manualValues,
        semanticTypeState,
        analyticTypeState,
        aggValue,
        sortOrder,
        sortType,
        target,
        titleOverride,
        customFormat,
        windowAgg,
        vizStore,
    ]);

    const reorderManualValue = useCallback((from: number, to: number) => {
        setManualValues((prev) => {
            if (from === to) return prev;
            const next = prev.slice();
            const [item] = next.splice(from, 1);
            next.splice(to, 0, item);
            return next;
        });
    }, []);

    const renderSortOrderControls = () => (
        <div className="space-y-2">
            <Label>Sort Order</Label>
            <RadioGroup value={sortOrder} onValueChange={(value) => setSortOrder(value as ISortMode)} className="flex space-x-3">
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ascending" id="order-asc" />
                    <Label htmlFor="order-asc">Ascending</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="descending" id="order-desc" />
                    <Label htmlFor="order-desc">Descending</Label>
                </div>
                {sortType === 'measure' && (
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="none" id="order-none" />
                        <Label htmlFor="order-none">None</Label>
                    </div>
                )}
            </RadioGroup>
        </div>
    );

    const handleManualDragEnd = useCallback(
        (result: DropResult) => {
            if (!result.destination) return;
            reorderManualValue(result.source.index, result.destination.index);
        },
        [reorderManualValue]
    );

    const manualList = (
        <div className="space-y-3">
            <div className="flex items-end space-x-2">
                <div className="flex-1">
                    <Label htmlFor="manual-input">Custom Value</Label>
                </div>
            </div>
            <div className="rounded border p-2">
                <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                    <span>Drag to change order</span>
                </div>
                {fetchError && (
                    <div className="flex items-center justify-between mb-2 text-xs text-destructive">
                        <span className="pr-2">{fetchError}</span>
                        <button type="button" className="text-primary underline" onClick={handleRetryManualValues}>
                            Retry
                        </button>
                    </div>
                )}
                <ScrollArea className="max-h-48">
                    <DragDropContext onDragEnd={handleManualDragEnd}>
                        <Droppable droppableId="manual-values" direction="vertical">
                            {(provided) => (
                                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                                    {manualValues.map((item, index) => (
                                        <Draggable key={item.id} draggableId={item.id} index={index}>
                                            {(dragProvided, snapshot) => (
                                                <div
                                                    ref={dragProvided.innerRef}
                                                    className={`flex items-center justify-between rounded border px-2 py-1 text-sm transition-colors ${
                                                        snapshot.isDragging ? 'bg-primary/10 border-primary' : 'bg-muted/40'
                                                    }`}
                                                    {...dragProvided.draggableProps}
                                                    {...dragProvided.dragHandleProps}
                                                >
                                                    <span className="truncate pr-4">{asDisplayValue(item.value)}</span>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                    {isFetchingManualValues && (
                                        <span className="flex items-center space-x-1 text-primary">
                                            <Spinner className="h-3 w-3" />
                                            <span>Loading…</span>
                                        </span>
                                    )}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                </ScrollArea>
            </div>
        </div>
    );

    const sortControls = allowSort ? (
        <div className="space-y-4">
            <div>
                <Label>Custom Sort</Label>
                <RadioGroup value={sortType} onValueChange={(value) => setSortType(value as ICustomSortType)} className="space-y-2 mt-2">
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="measure" id="sort-measure" />
                        <Label htmlFor="sort-measure">By opposite axis (default)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="alphabetical" id="sort-alpha" />
                        <Label htmlFor="sort-alpha">Alphabetical</Label>
                    </div>
                    {manualSortDisabled ? (
                        <Tooltip content={manualSortDisabledReason || 'Manual sort supports up to 100 distinct values.'}>
                            <div className="flex items-center space-x-2 text-muted-foreground">
                                <RadioGroupItem value="manual" id="sort-manual" disabled />
                                <Label htmlFor="sort-manual">Manual order</Label>
                            </div>
                        </Tooltip>
                    ) : (
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="manual" id="sort-manual" />
                            <Label htmlFor="sort-manual">Manual order</Label>
                            {isFetchingManualValues && <Spinner className="h-3 w-3 text-primary" />}
                        </div>
                    )}
                </RadioGroup>
            </div>
            {(sortType === 'measure' || sortType === 'alphabetical') && renderSortOrderControls()}
            {sortType === 'manual' && manualList}
        </div>
    ) : null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Field Settings</DialogTitle>
                    {currentField && <p className="text-sm text-muted-foreground">{currentField.name}</p>}
                </DialogHeader>
                {currentField ? (
                    <div className="space-y-6 my-2">
                        <div className="space-y-2">
                            <Label htmlFor="field-title">Title Override</Label>
                            <Textarea
                                id="field-title"
                                value={titleOverride}
                                onChange={(event) => setTitleOverride(event.target.value)}
                                placeholder="Leave empty to use the default title"
                            />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Analytic Type</Label>
                                <Select
                                    value={analyticTypeState}
                                    onValueChange={(value) => handleAnalyticTypeChange(value as IAnalyticType)}
                                    disabled={disableTypeSelectors}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select analytic type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {analyticTypeOptions.map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Semantic Type</Label>
                                <Select
                                    value={semanticTypeState}
                                    onValueChange={(value) => setSemanticTypeState(value as ISemanticType)}
                                    disabled={disableTypeSelectors}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select semantic type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {semanticTypeOptions.map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Aggregator</Label>
                                <Select
                                    value={aggValue}
                                    onValueChange={(value) => setAggValue(value as AggregatorSelectValue)}
                                    disabled={(!isMeasureField && !isInnerField) || isRowCountField}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select aggregator" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {aggregatorOptions.map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {t(`constant.aggregator.${option}`)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {isRowCountField ? (
                                    <p className="text-xs text-muted-foreground">Row count uses a fixed aggregator.</p>
                                ) : (
                                    !isMeasureField && <p className="text-xs text-muted-foreground">Aggregator only applies to measure fields.</p>
                                )}
                            </div>
                            {defaultAggregated && (
                                <div className="space-y-2">
                                    <Label>Window Aggregation</Label>
                                    <Select value={windowAgg} onValueChange={(value) => setWindowAgg(value as IWindowAgg | 'none')} disabled={!allowWindowAgg}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select window aggregation" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {windowAggOptions.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="field-format">Custom Format</Label>
                                <Input
                                    id="field-format"
                                    value={customFormat}
                                    placeholder="e.g. ,.2f or %Y-%m-%d"
                                    onChange={(event) => setCustomFormat(event.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {t(`config.formatGuidesDocs`)}:{' '}
                                    <a target="_blank" className="hover:underline text-primary" href="https://github.com/d3/d3-format#locale_format">
                                        {t(`config.readHere`)}
                                    </a>
                                </p>
                            </div>
                        </div>
                        {sortControls}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">No field selected.</p>
                )}
                <DialogFooter>
                    <Button variant="secondary" onClick={handleClose}>
                        {t('actions.cancel')}
                    </Button>
                    <Button onClick={handleSave} disabled={!currentField}>
                        {t('actions.confirm')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
});

export default FieldConfigDialog;
