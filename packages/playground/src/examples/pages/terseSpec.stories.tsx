import { useContext, useMemo, useState } from 'react';
import { themeContext } from '../context';
import { GraphicRenderer, normalize } from '@kanaries/graphic-walker';
import type { IChart, TerseSpec } from '@kanaries/graphic-walker';
import { useFetch, IDataSource } from '../util';

/**
 * TerseSpec is the human-authored spec grammar. You write a terse spec, call
 * `normalize(spec, fields)` to expand it into a full canonical IChart, and feed
 * that chart to any renderer. The terse layer is for authoring only — persistence
 * (export/import) always uses the canonical form. See docs/terse-spec-design.md.
 */
const DATASET_URL = '/datasets/ds-carsales-service.json';

// Each entry is one grammar lesson. To add a new example, append an entry here —
// `spec` must be a valid TerseSpec against the car-sales dataset (fields:
// Manufacturer, Model, Vehicle_type, Latest_Launch, Sales_in_thousands,
// Price_in_thousands, Horsepower, Curb_weight, Fuel_efficiency, ...).
const TERSE_EXAMPLES: { name: string; description: string; spec: TerseSpec }[] = [
    {
        name: 'Basic bar chart',
        description: 'Reference fields by NAME and use agg(field) shorthand — no fids, no pools, no layout boilerplate.',
        spec: {
            mark: 'bar',
            x: 'Manufacturer',
            y: 'mean(Price_in_thousands)',
            color: 'Vehicle_type',
        },
    },
    {
        name: 'Computed field + filter + sort',
        description:
            'Define an inline computed field with a SQL expression (quote field names like "Horsepower"), reference it by name, filter rows, sort descending and keep the top 10.',
        spec: {
            mark: 'bar',
            x: 'Manufacturer',
            y: { field: 'Power_to_weight', aggregate: 'mean', sort: 'descending' },
            computed: [{ name: 'Power_to_weight', expr: '"Horsepower" / "Curb_weight"' }],
            filters: [{ field: 'Vehicle_type', oneOf: ['Passenger'] }],
            limit: 10,
        },
    },
    {
        name: 'Time drill line chart',
        description: 'timeUnit expands into a real date-drill computed field at query level — the same drill the UI produces.',
        spec: {
            mark: 'line',
            x: { field: 'Latest_Launch', timeUnit: 'year' },
            y: 'sum(Sales_in_thousands)',
            color: 'Vehicle_type',
        },
    },
];

const CHEAT_SHEET: [string, string][] = [
    [`"x": "Manufacturer"`, 'reference a field by name'],
    [`"y": "mean(Price_in_thousands)"`, 'aggregate shorthand: sum / mean / count / median / min / max / variance / stdev'],
    [`"x": "fid:col_0_64"`, 'fid: prefix bypasses name resolution'],
    [`{ "field", "aggregate", "sort", "timeUnit" }`, 'object form for per-channel options'],
    [`"computed": [{ "name", "expr" | "bin" | "log" }]`, 'inline computed fields; quote refs inside expr like "Horsepower"'],
    [`"filters": [{ "field", "oneOf" | "notIn" | "range" | "timeRange" }]`, 'row filters; timeRange takes epoch milliseconds'],
    [`"aggregate": false / "stack" / "limit" / "sort"`, 'chart-level knobs'],
    [`"config" / "layout"`, 'canonical escape hatches, merged last'],
];

export default function TerseSpecComponent() {
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>(DATASET_URL);
    const [exampleIndex, setExampleIndex] = useState(0);
    const [input, setInput] = useState(() => JSON.stringify(TERSE_EXAMPLES[0].spec, null, 2));
    const [applied, setApplied] = useState<{ text: string; revision: number }>(() => ({
        text: JSON.stringify(TERSE_EXAMPLES[0].spec, null, 2),
        revision: 0,
    }));
    const [showExpanded, setShowExpanded] = useState(false);

    const selectExample = (index: number) => {
        const text = JSON.stringify(TERSE_EXAMPLES[index].spec, null, 2);
        setExampleIndex(index);
        setInput(text);
        setApplied((prev) => ({ text, revision: prev.revision + 1 }));
    };

    const apply = () => setApplied((prev) => ({ text: input, revision: prev.revision + 1 }));

    const result = useMemo<{ chart: IChart } | { error: string }>(() => {
        try {
            const spec = JSON.parse(applied.text) as TerseSpec;
            return { chart: normalize(spec, fields) };
        } catch (err) {
            return { error: err instanceof Error ? err.message : String(err) };
        }
    }, [applied.text, fields]);

    return (
        <div className="flex flex-col gap-5 p-4 sm:p-6">
            <p className="max-w-4xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                TerseSpec is the hand-writable spec grammar: fields by <span className="font-semibold text-zinc-900 dark:text-zinc-100">name</span>,{' '}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">agg(field)</code> shorthand, inline{' '}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">computed</code> /{' '}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">filters</code>,{' '}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">timeUnit</code> drills.{' '}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">normalize(spec, fields)</code> expands it into the full canonical
                chart spec that every renderer (and export/import) consumes.
            </p>

            <div className="flex flex-wrap items-center gap-2">
                {TERSE_EXAMPLES.map((example, i) => {
                    const active = i === exampleIndex;
                    return (
                        <button
                            key={example.name}
                            onClick={() => selectExample(i)}
                            className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                                active
                                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                                    : 'border-zinc-300 text-zinc-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400'
                            }`}
                        >
                            <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                                    active ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                                }`}
                            >
                                {i + 1}
                            </span>
                            {example.name}
                        </button>
                    );
                })}
            </div>

            <p className="max-w-4xl border-l-2 border-indigo-500 pl-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {TERSE_EXAMPLES[exampleIndex].description}
            </p>

            <div className="grid min-h-0 grow gap-5 xl:grid-cols-5">
                <section className="flex flex-col gap-3 xl:col-span-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">TerseSpec JSON</span>
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">⌘/Ctrl + ⏎ to apply</span>
                    </div>
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') apply();
                        }}
                        spellCheck={false}
                        className="min-h-[16rem] w-full grow resize-y rounded-lg border border-zinc-300 bg-zinc-50 p-3 font-mono text-xs leading-5 text-zinc-900 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                    <div className="flex items-center gap-4">
                        <button
                            onClick={apply}
                            className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                            Apply
                        </button>
                        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                            <input
                                type="checkbox"
                                className="accent-indigo-600"
                                checked={showExpanded}
                                onChange={(e) => setShowExpanded(e.target.checked)}
                            />
                            show expanded canonical spec
                        </label>
                    </div>
                    {'error' in result && (
                        <div className="whitespace-pre-wrap rounded-lg border border-red-300 bg-red-50 p-3 font-mono text-xs leading-5 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                            normalize() failed: {result.error}
                        </div>
                    )}
                    {showExpanded && 'chart' in result && (
                        <div className="flex min-h-0 flex-col gap-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Expanded canonical spec — normalize() output
                            </span>
                            <pre className="max-h-72 overflow-auto rounded-lg border border-zinc-200 bg-zinc-950 p-3 text-[11px] leading-4 text-zinc-100 dark:border-zinc-800">
                                {JSON.stringify(result.chart, null, 2)}
                            </pre>
                        </div>
                    )}
                    <details className="mt-1">
                        <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
                            Grammar cheat sheet
                        </summary>
                        <dl className="mt-2 flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                            {CHEAT_SHEET.map(([syntax, meaning]) => (
                                <div key={syntax} className="flex flex-col gap-0.5">
                                    <dt>
                                        <code className="break-all text-xs text-indigo-600 dark:text-indigo-400">{syntax}</code>
                                    </dt>
                                    <dd className="text-xs text-zinc-500 dark:text-zinc-400">{meaning}</dd>
                                </div>
                            ))}
                        </dl>
                    </details>
                </section>

                <section className="flex min-h-[26rem] flex-col overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 xl:col-span-3">
                    <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Rendered chart</span>
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">normalize(spec, fields) → GraphicRenderer</span>
                    </div>
                    <div className="min-h-0 grow overflow-auto p-2">
                        {'chart' in result ? (
                            <GraphicRenderer key={applied.revision} fields={fields} data={dataSource} chart={[result.chart]} appearance={theme} />
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm text-zinc-400 dark:text-zinc-600">
                                Fix the spec to render the chart
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
