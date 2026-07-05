import React, { useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';
import { Trans, useTranslation } from 'react-i18next';
import { SparklesIcon } from '@heroicons/react/24/solid';
import { ChevronDoubleRightIcon, CursorArrowRaysIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useVizStore } from '../../store';
import { IChart } from '../../interfaces';
import { COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID } from '../../constants';
import { cn } from '../../utils';
import { recommend, IAutoVizDisableReason, IAutoVizItem } from '../../lib/autoViz';
import { Button } from '../ui/button';
import Tooltip from '../tooltip';
import { chartIcons, chartTypeLabels } from './chartIcons';

/** English fallbacks; overridden by the `autoviz.reason.*` i18n keys when present */
const reasonLabels: Record<IAutoVizDisableReason, string> = {
    need_fields: 'Select at least one field',
    need_dimension: 'Needs at least 1 dimension',
    need_two_dimensions: 'Needs at least 2 dimensions',
    too_many_dimensions: 'Too many dimensions for this chart',
    need_measure: 'Needs at least 1 measure',
    need_two_measures: 'Needs at least 2 measures',
    need_single_measure: 'Needs exactly 1 measure',
    too_many_measures: 'Too many measures for this chart',
    need_temporal: 'Needs a date/time dimension',
    need_temporal_or_ordinal: 'Needs a date/time or ordinal dimension',
    need_raw_measure: 'Needs a raw measure, not row count',
    need_lon_lat: 'Needs longitude & latitude fields',
    need_geo_feature: 'Needs a configured GeoJSON boundary',
};

const VIRTUAL_FIDS = [MEA_KEY_ID, MEA_VAL_ID];

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** keycap-styled modifier key; the visual anchor of the field-selection hint */
const ModKey: React.FC = () => (
    <kbd className="mx-0.5 inline-flex items-center rounded border bg-muted px-1 font-mono text-[10px] leading-4 text-foreground">
        {IS_MAC ? '⌘' : 'Ctrl'}
    </kbd>
);

/**
 * Tableau "Show Me"-style dock: a collapsible card on the right edge of the vis workspace.
 * Expanded state lives in the store (`showAutoVizPanel`) so the toolbar toggle stays in sync.
 *
 * Recommendation input cascades through three tiers:
 * 1. fields highlighted in the field list (ctrl/cmd+click) — merged with the view fields;
 * 2. no highlight → the fields already encoded in the current chart;
 * 3. empty chart too → cold start: every chart type reverse-matches usable fields
 *    from the dataset, so clicking any lit type starts a chart from scratch.
 */
const AutoVizPanel: React.FC = observer(function AutoVizPanel() {
    const vizStore = useVizStore();
    const { t } = useTranslation();
    const expanded = vizStore.showAutoVizPanel;
    const selectedIds = vizStore.selectedFieldIds;

    const allFields = useMemo(
        () => vizStore.dimensions.concat(vizStore.measures).filter((f) => !VIRTUAL_FIDS.includes(f.fid)),
        [vizStore.dimensions, vizStore.measures]
    );

    // tier 1 ∪ tier 2: view fields (count excluded — the chart encodes it implicitly)
    // merged with explicitly highlighted fields
    const inputFields = useMemo(() => {
        const viewFields = vizStore.viewDimensions
            .concat(vizStore.viewMeasures)
            .filter((f) => !VIRTUAL_FIDS.includes(f.fid) && f.fid !== COUNT_FIELD_ID);
        const fids = new Set(viewFields.map((f) => f.fid));
        const picked = allFields.filter((f) => selectedIds.includes(f.fid) && !fids.has(f.fid));
        return viewFields.concat(picked);
    }, [vizStore.viewDimensions, vizStore.viewMeasures, allFields, selectedIds]);

    const mode: 'selection' | 'view' | 'cold' = selectedIds.length > 0 ? 'selection' : inputFields.length > 0 ? 'view' : 'cold';

    const result = useMemo(() => {
        if (!expanded) {
            return null;
        }
        const base = toJS(vizStore.currentVis) as IChart;
        const geoFeatureReady = Boolean(vizStore.layout.geojson || vizStore.layout.geoUrl);
        return recommend({
            fields: inputFields.map((f) => toJS(f)),
            base,
            allFields: allFields.map((f) => toJS(f)),
            geoFeatureReady,
        });
    }, [expanded, inputFields, allFields, vizStore.currentVis, vizStore.layout.geojson, vizStore.layout.geoUrl]);

    const apply = (item: IAutoVizItem | null) => {
        if (!item?.available || !item.chart) {
            return;
        }
        vizStore.applyChart(item.chart);
    };

    if (!expanded) {
        return (
            <div className="hidden sm:flex my-0.5 ml-0.5 flex-shrink-0">
                <button
                    type="button"
                    title={t('autoviz.expand', 'Show Auto Viz')}
                    onClick={() => vizStore.setShowAutoVizPanel(true)}
                    className="flex h-full w-7 flex-col items-center gap-2 rounded-md border bg-background py-2 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                    <SparklesIcon className="h-4 w-4" />
                    <span className="text-[10px] font-medium tracking-wide [writing-mode:vertical-rl]">{t('autoviz.title', 'Auto Viz')}</span>
                </button>
            </div>
        );
    }

    const availableCount = result?.items.filter((x) => x.available).length ?? 0;

    return (
        <div className="hidden sm:flex my-0.5 ml-0.5 w-[248px] flex-shrink-0 flex-col overflow-hidden rounded-md border bg-background">
            {/* header */}
            <div className="flex flex-shrink-0 items-center gap-1.5 border-b px-2.5 py-2">
                <SparklesIcon className="h-4 w-4 text-primary" />
                <span className="flex-1 truncate text-xs font-medium">{t('autoviz.title', 'Auto Viz')}</span>
                <button
                    type="button"
                    title={t('autoviz.collapse', 'Collapse panel')}
                    onClick={() => vizStore.setShowAutoVizPanel(false)}
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                    <ChevronDoubleRightIcon className="h-3.5 w-3.5" />
                </button>
            </div>
            {/* chart palette */}
            <div className="grid flex-1 auto-rows-min grid-cols-3 gap-1.5 overflow-y-auto p-2">
                {(result?.items ?? []).map((item) => {
                    const Icon = chartIcons[item.chartType];
                    const label = t(`autoviz.charts.${item.chartType}`, chartTypeLabels[item.chartType]);
                    const tooltip = !item.available
                        ? t(`autoviz.reason.${item.reason}`, reasonLabels[item.reason!])
                        : item.matchedFields?.length
                          ? t('autoviz.uses', 'Uses: {{fields}}', { fields: item.matchedFields.map((f) => f.name ?? f.fid).join(', ') })
                          : item.isDefault
                            ? t('autoviz.recommended', 'Recommended')
                            : label;
                    const card = (
                        <div
                            role="button"
                            aria-disabled={!item.available}
                            onClick={() => apply(item)}
                            className={cn(
                                'relative flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-all',
                                item.available
                                    ? 'cursor-pointer text-foreground hover:border-primary hover:bg-primary/5 hover:shadow-sm'
                                    : 'cursor-not-allowed border-transparent text-muted-foreground opacity-35',
                                item.isDefault && 'border-primary bg-primary/5 shadow-sm'
                            )}
                        >
                            {item.isDefault && (
                                <span className="absolute -right-1 -top-1 rounded-full bg-background">
                                    <SparklesIcon className="h-3.5 w-3.5 text-primary" />
                                </span>
                            )}
                            <Icon className="h-7 w-7" />
                            <span className="w-full truncate text-center text-[10px] leading-tight">{label}</span>
                        </div>
                    );
                    return (
                        <Tooltip key={item.chartType} content={tooltip}>
                            {card}
                        </Tooltip>
                    );
                })}
            </div>
            {/* footer */}
            <div className="flex flex-shrink-0 flex-col gap-1.5 border-t px-2.5 py-2">
                {mode === 'selection' && (
                    <>
                        <div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
                            <span className="truncate">
                                {t('autoviz.selected_count', '{{count}} fields selected in the field list', { count: selectedIds.length })}
                            </span>
                            <button
                                type="button"
                                onClick={() => vizStore.clearFieldSelection()}
                                className="flex flex-shrink-0 items-center gap-0.5 rounded px-1 py-0.5 transition-colors hover:bg-accent hover:text-foreground"
                            >
                                <XMarkIcon className="h-3 w-3" />
                                {t('autoviz.clear', 'Clear')}
                            </button>
                        </div>
                        <span className="text-[11px] leading-snug text-muted-foreground">
                            {t('autoviz.hint', '{{count}} chart types match your selection', { count: availableCount })}
                        </span>
                    </>
                )}
                {mode === 'cold' && (
                    <>
                        {/* the one thing worth reading: how to select fields — keycap as the visual anchor */}
                        <span className="flex items-start gap-1 text-[11px] leading-5 text-foreground/90">
                            <CursorArrowRaysIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                            <span>
                                <Trans
                                    t={t}
                                    i18nKey="autoviz.select_hint"
                                    components={{ k: <ModKey /> }}
                                    defaults="Pick fields on the left · <k></k>+click to multi-select"
                                />
                            </span>
                        </span>
                        <span className="text-[10px] leading-snug text-muted-foreground/70">
                            {t('autoviz.empty', '…or click any lit chart type to start')}
                        </span>
                    </>
                )}
                {mode === 'view' && (
                    <>
                        <span className="text-[11px] leading-snug text-muted-foreground">
                            {t('autoviz.based_on_view', 'Based on the fields in the current chart · {{count}} types match', { count: availableCount })}
                        </span>
                        <span className="text-[10px] leading-5 text-muted-foreground/70">
                            <Trans
                                t={t}
                                i18nKey="autoviz.refine_hint"
                                components={{ k: <ModKey /> }}
                                defaults="Click or <k></k>+click fields on the left to refine"
                            />
                        </span>
                    </>
                )}
                <Button size="sm" className="h-7 w-full text-xs" disabled={!result?.defaultItem} onClick={() => apply(result?.defaultItem ?? null)}>
                    <SparklesIcon className="mr-1.5 h-3.5 w-3.5" />
                    {t('autoviz.apply_best', 'Apply recommended')}
                </Button>
            </div>
        </div>
    );
});

export default AutoVizPanel;
