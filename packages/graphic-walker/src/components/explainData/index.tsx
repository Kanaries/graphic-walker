import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';
import { useCompututaion, useVizStore } from '../../store';
import { useTranslation } from 'react-i18next';
import embed from 'vega-embed';
import { VegaGlobalConfig, IThemeKey, IRow } from '../../interfaces';
import { builtInThemes } from '../../vis/theme';
import { defaultExplainers, explainMark, type IExplainContext, type IExplainerResult, type IExplanation, type IExplanationType } from '../../lib/explain';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { themeContext } from '@/store/theme';

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

function formatDescriptionParams(params: IExplanation['descriptionParams']): IExplanation['descriptionParams'] {
    return Object.fromEntries(
        Object.entries(params).map(([key, value]) => {
            if ((key === 'before' || key === 'after') && typeof value === 'number') {
                return [key, Number(value.toFixed(2))];
            }
            return [key, value];
        })
    );
}

function formatCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.map(formatCell).join(' - ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
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

    return <div ref={chartRef} className="w-full overflow-x-auto" />;
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
            <div className="flex items-start justify-between gap-3">
                <p className="text-sm leading-5">{t(explanation.descriptionKey, formatDescriptionParams(explanation.descriptionParams))}</p>
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${STRENGTH_CLASS[explanation.strength]}`}>
                    {t(`explain.strength.${explanation.strength}`)}
                </span>
            </div>
            {(explanation.evidence.chartSpec || explanation.evidence.rows) && (
                <div className="mt-3 space-y-3">
                    {explanation.evidence.chartSpec && <EvidenceChart spec={explanation.evidence.chartSpec} config={config} dark={dark} />}
                    {explanation.evidence.rows && <EvidenceRows rows={explanation.evidence.rows} />}
                </div>
            )}
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

    const vegaConfig = useMemo<VegaGlobalConfig>(() => {
        const config: VegaGlobalConfig = {
            ...builtInThemes[themeKey ?? 'vega']?.[dark],
        };
        return config;
    }, [themeKey, dark]);

    const { t } = useTranslation();

    useEffect(() => {
        let cancelled = false;
        const selectedMark = toJS(selectedMarkObject) as IExplainContext['selectedMark'];
        if (!showInsightBoard || Object.keys(selectedMark).length === 0) {
            setResults([]);
            setLoading(false);
            return () => {
                cancelled = true;
            };
        }

        const ctx = { allFields, viewDimensions, viewMeasures, viewFilters, selectedMark, timezoneDisplayOffset };
        setResults([]);
        setLoading(true);

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
    }, [allFields, computationFunction, selectedMarkObject, showInsightBoard, timezoneDisplayOffset, viewDimensions, viewFilters, viewMeasures]);

    const resultsByType = useMemo(() => {
        return new Map(results.map((result) => [result.explainer, result]));
    }, [results]);

    const hasExplanations = results.some((result) => result.explanations.length > 0);
    const showEmpty = !loading && results.length > 0 && !hasExplanations;

    return (
        <Dialog
            open={showInsightBoard}
            onOpenChange={() => {
                vizStore.setShowInsightBoard(false);
                setResults([]);
                setLoading(false);
            }}
        >
            <DialogContent className="lg:w-[960px]" containerClassName="p-0">
                <div className="flex max-h-[min(760px,88vh)] flex-col">
                    <div className="border-b px-6 py-4">
                        <DialogTitle>{t('explain.title')}</DialogTitle>
                    </div>
                    <div className="min-h-[22rem] overflow-y-auto px-6 py-4">
                        <div className="space-y-5">
                            {EXPLANATION_ORDER.map((type) => {
                                const result = resultsByType.get(type);
                                if (!result) return null;
                                if (result.status === 'ok' && result.explanations.length === 0) return null;

                                const explanations = [...result.explanations].sort((a, b) => b.score - a.score);
                                return (
                                    <section key={type} className="space-y-3">
                                        <h3 className="text-sm font-semibold">{t(`explain.type.${TYPE_KEY[type]}`)}</h3>
                                        {result.status === 'ok' &&
                                            explanations.map((explanation, index) => (
                                                <ExplanationCard
                                                    key={`${type}-${index}`}
                                                    explanation={explanation}
                                                    config={vegaConfig}
                                                    dark={dark}
                                                />
                                            ))}
                                        {result.status === 'skipped' && result.reason && <p className="text-xs text-muted-foreground">{t(result.reason)}</p>}
                                        {result.status === 'error' && result.reason && <p className="text-xs text-muted-foreground">{result.reason}</p>}
                                    </section>
                                );
                            })}
                            {showEmpty && <div className="py-16 text-center text-sm text-muted-foreground">{t('explain.empty')}</div>}
                        </div>
                    </div>
                    {loading && (
                        <div className="flex items-center gap-2 border-t px-6 py-3 text-xs text-muted-foreground">
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                            <span>{t('explain.loading')}</span>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
});

export default ExplainData;
