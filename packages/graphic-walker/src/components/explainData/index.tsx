import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';
import { useCompututaion, useVizStore } from '../../store';
import { useTranslation } from 'react-i18next';
import embed from 'vega-embed';
import { VegaGlobalConfig, IThemeKey, IRow } from '../../interfaces';
import { builtInThemes } from '../../vis/theme';
import {
    candidateTruncation,
    DEFAULT_CANDIDATE_LIMIT,
    defaultExplainers,
    explainMark,
    formatMeasureValue,
    type IExplainContext,
    type IExplainerResult,
    type IExplanation,
    type IExplanationType,
} from '../../lib/explain';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { themeContext } from '@/store/theme';
import { cn } from '@/utils';

const EXPLANATION_ORDER: IExplanationType[] = ['extreme-value', 'contributing-dimension', 'contributing-measure', 'unique-mark'];

const TYPE_KEY: Record<IExplanationType, string> = {
    'extreme-value': 'extremeValue',
    'contributing-dimension': 'contributingDimension',
    'contributing-measure': 'contributingMeasure',
    'unique-mark': 'uniqueMark',
};

const STRENGTH_CLASS: Record<IExplanation['strength'], string> = {
    strong: 'bg-primary text-primary-foreground',
    moderate: 'bg-accent text-accent-foreground',
    weak: 'bg-muted text-muted-foreground',
};

const STRENGTH_ORDER: Record<IExplanation['strength'], number> = {
    strong: 0,
    moderate: 1,
    weak: 2,
};

function formatCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.map(formatCell).join(' - ');
    if (typeof value === 'number') return formatMeasureValue(value);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

function fieldName(field: IExplanation['field'] | IExplanation['measure']): string {
    return field?.name ?? field?.fid ?? '';
}

function explanationTitle(explanation: IExplanation): string {
    if (explanation.type === 'contributing-dimension' || explanation.type === 'contributing-measure') {
        return `${fieldName(explanation.field)}\u2009\u2192\u2009${fieldName(explanation.measure)}`;
    }
    if (explanation.type === 'extreme-value') {
        return fieldName(explanation.measure ?? explanation.field);
    }
    return fieldName(explanation.field);
}

function sortExplanations(explanations: IExplanation[]): IExplanation[] {
    return [...explanations].sort((a, b) => STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] || b.score - a.score);
}

const EvidenceChart: React.FC<{
    spec: Record<string, unknown>;
    config: VegaGlobalConfig;
    dark: string;
}> = ({ spec, config, dark }) => {
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let disposed = false;
        let finalize: (() => void) | undefined;
        const node = chartRef.current;
        if (!node) return;

        embed(node, spec as any, {
            mode: 'vega-lite',
            actions: false,
            config,
            tooltip: {
                theme: dark,
            },
        }).then((result) => {
            if (disposed) {
                result.finalize();
                return;
            }
            finalize = () => result.finalize();
        });

        return () => {
            disposed = true;
            finalize?.();
        };
    }, [config, dark, spec]);

    return <div ref={chartRef} className="w-full min-w-[18rem] overflow-x-auto" />;
};

const EvidenceRows: React.FC<{
    rows: IRow[];
}> = ({ rows }) => {
    const visibleRows = rows.slice(0, 10);
    const columns = Array.from(new Set(visibleRows.flatMap((row) => Object.keys(row)))).slice(0, 6);
    if (visibleRows.length === 0 || columns.length === 0) return null;

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
                <thead>
                    <tr className="border-b">
                        {columns.map((column) => (
                            <th key={column} className="whitespace-nowrap px-2 py-1 text-left font-medium text-muted-foreground">
                                {column}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {visibleRows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b last:border-b-0">
                            {columns.map((column) => (
                                <td key={column} className="max-w-[12rem] truncate px-2 py-1 text-left">
                                    {formatCell(row[column])}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const ExplanationCard: React.FC<{
    explanation: IExplanation;
    config: VegaGlobalConfig;
    dark: string;
}> = ({ explanation, config, dark }) => {
    const { t } = useTranslation();
    return (
        <div className="rounded-md border bg-background p-3">
            <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${STRENGTH_CLASS[explanation.strength]}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                    {t(`explain.strength.${explanation.strength}`)}
                </span>
                <h4 className="text-sm font-semibold leading-5">{explanationTitle(explanation)}</h4>
            </div>
            {(explanation.evidence.chartSpec || explanation.evidence.rows) && (
                <div className="mt-3 md:flex md:gap-4">
                    {explanation.evidence.chartSpec && (
                        <div className="max-w-full shrink-0 overflow-x-auto md:w-[340px]">
                            <EvidenceChart spec={explanation.evidence.chartSpec} config={config} dark={dark} />
                        </div>
                    )}
                    <div className="mt-3 min-w-0 flex-1 space-y-3 md:mt-0">
                        <p className="text-xs leading-5 text-muted-foreground">{t(explanation.descriptionKey, explanation.descriptionParams)}</p>
                        {explanation.evidence.rows && <EvidenceRows rows={explanation.evidence.rows} />}
                    </div>
                </div>
            )}
            {!explanation.evidence.chartSpec && !explanation.evidence.rows && (
                <p className="mt-3 text-xs leading-5 text-muted-foreground">{t(explanation.descriptionKey, explanation.descriptionParams)}</p>
            )}
        </div>
    );
};

const OverviewChips: React.FC<{
    counts: Map<IExplanationType, number>;
    total: number;
    activeType: IExplanationType | 'all';
    onSelect: (type: IExplanationType | 'all') => void;
}> = ({ counts, total, activeType, onSelect }) => {
    const { t } = useTranslation();
    const chipClass = (active: boolean) =>
        cn(
            'inline-flex h-7 shrink-0 items-center rounded-full px-3 text-xs font-medium transition-colors',
            active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        );

    return (
        <div className="mt-3 flex gap-2 overflow-x-auto">
            <button type="button" className={chipClass(activeType === 'all')} onClick={() => onSelect('all')}>
                {t('explain.overview.all')} · {total}
            </button>
            {EXPLANATION_ORDER.map((type) => {
                const count = counts.get(type) ?? 0;
                if (count === 0) return null;
                return (
                    <button
                        type="button"
                        key={type}
                        className={chipClass(activeType === type)}
                        onClick={() => onSelect(activeType === type ? 'all' : type)}
                    >
                        {t(`explain.type.${TYPE_KEY[type]}`)} · {count}
                    </button>
                );
            })}
        </div>
    );
};

const ExplainData: React.FC<{
    themeKey: IThemeKey;
}> = observer(({ themeKey }) => {
    const vizStore = useVizStore();
    const dark = useContext(themeContext);
    const computationFunction = useCompututaion();
    const { allFields, viewMeasures, viewDimensions, viewFilters, showInsightBoard, selectedMarkObject, config } = vizStore;
    const { timezoneDisplayOffset } = config;
    const [results, setResults] = useState<IExplainerResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [candidateLimit, setCandidateLimit] = useState(DEFAULT_CANDIDATE_LIMIT);
    const [activeType, setActiveType] = useState<IExplanationType | 'all'>('all');
    const selectedMarkKey = JSON.stringify(toJS(selectedMarkObject));

    const vegaConfig = useMemo<VegaGlobalConfig>(() => {
        const config: VegaGlobalConfig = {
            ...builtInThemes[themeKey ?? 'vega']?.[dark],
        };
        return config;
    }, [themeKey, dark]);

    const { t } = useTranslation();

    useEffect(() => {
        setCandidateLimit(DEFAULT_CANDIDATE_LIMIT);
    }, [selectedMarkKey, showInsightBoard]);

    const ctx = useMemo<IExplainContext>(() => {
        const selectedMark = JSON.parse(selectedMarkKey) as IExplainContext['selectedMark'];
        return { allFields, viewDimensions, viewMeasures, viewFilters, selectedMark, timezoneDisplayOffset, candidateLimit };
    }, [allFields, candidateLimit, selectedMarkKey, timezoneDisplayOffset, viewDimensions, viewFilters, viewMeasures]);

    useEffect(() => {
        let cancelled = false;
        if (!showInsightBoard || Object.keys(ctx.selectedMark).length === 0) {
            setResults([]);
            setLoading(false);
            return () => {
                cancelled = true;
            };
        }

        setResults([]);
        setLoading(true);
        setActiveType('all');

        (async () => {
            try {
                for await (const result of explainMark(ctx, computationFunction, defaultExplainers)) {
                    if (cancelled) return;
                    setResults((prev) => [...prev.filter((item) => item.explainer !== result.explainer), result]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [computationFunction, ctx, showInsightBoard]);

    const resultsByType = useMemo(() => {
        return new Map(results.map((result) => [result.explainer, result]));
    }, [results]);

    const insightCounts = useMemo(() => {
        return new Map(EXPLANATION_ORDER.map((type) => [type, resultsByType.get(type)?.explanations.length ?? 0]));
    }, [resultsByType]);

    const hasExplanations = results.some((result) => result.explanations.length > 0);
    const totalInsights = results.reduce((sum, result) => sum + result.explanations.length, 0);
    const footerNotes = results.filter((result) => (result.status === 'skipped' || result.status === 'error') && result.reason);
    const showEmpty = !loading && results.length > 0 && !hasExplanations;
    const trunc = candidateTruncation(ctx);
    const showTruncation = !loading && results.length > 0 && trunc.truncated;

    return (
        <Dialog
            open={showInsightBoard}
            onOpenChange={() => {
                vizStore.setShowInsightBoard(false);
                setResults([]);
                setLoading(false);
                setCandidateLimit(DEFAULT_CANDIDATE_LIMIT);
                setActiveType('all');
            }}
        >
            <DialogContent className="lg:w-[960px]" containerClassName="p-0">
                <div className="flex max-h-[min(760px,88vh)] flex-col">
                    <div className="border-b px-6 py-4">
                        <DialogTitle>{t('explain.title')}</DialogTitle>
                        {results.length > 0 && (
                            <OverviewChips counts={insightCounts} total={totalInsights} activeType={activeType} onSelect={setActiveType} />
                        )}
                    </div>
                    <div className="min-h-[22rem] overflow-y-auto px-6 py-4">
                        <div className="space-y-5">
                            {EXPLANATION_ORDER.map((type) => {
                                if (activeType !== 'all' && activeType !== type) return null;
                                const result = resultsByType.get(type);
                                if (!result) return null;
                                if (result.status === 'ok' && result.explanations.length === 0) return null;
                                if (result.status !== 'ok') return null;

                                const explanations = sortExplanations(result.explanations);
                                return (
                                    <section key={type} className="space-y-3">
                                        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            {t(`explain.type.${TYPE_KEY[type]}`)} · {explanations.length}
                                        </h3>
                                        {explanations.map((explanation, index) => (
                                            <ExplanationCard key={`${type}-${index}`} explanation={explanation} config={vegaConfig} dark={dark} />
                                        ))}
                                    </section>
                                );
                            })}
                            {showEmpty && <div className="py-16 text-center text-sm text-muted-foreground">{t('explain.empty')}</div>}
                            {footerNotes.length > 0 && (
                                <details className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                    <summary className="cursor-pointer font-medium">{t('explain.overview.skippedNote', { count: footerNotes.length })}</summary>
                                    <div className="mt-2 space-y-1">
                                        {footerNotes.map((result) => (
                                            <p key={result.explainer}>{result.status === 'skipped' ? t(result.reason ?? '') : result.reason}</p>
                                        ))}
                                    </div>
                                </details>
                            )}
                        </div>
                    </div>
                    {loading && (
                        <div className="flex items-center gap-2 border-t px-6 py-3 text-xs text-muted-foreground">
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                            <span>{t('explain.loading')}</span>
                        </div>
                    )}
                    {showTruncation && (
                        <div className="flex items-center justify-between gap-3 border-t px-6 py-3 text-xs text-muted-foreground">
                            <span>{t('explain.truncation.notice', { scanned: trunc.scanned, total: trunc.total })}</span>
                            <Button variant="outline" size="sm" onClick={() => setCandidateLimit((limit) => limit + 20)}>
                                {t('explain.truncation.more')}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
});

export default ExplainData;
