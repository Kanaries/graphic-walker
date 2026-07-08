import { useContext, useMemo, useState } from 'react';
import { themeContext } from '../context';
import { GraphicRenderer, normalize } from '@kanaries/graphic-walker';
import type { IChart, TerseSpec } from '@kanaries/graphic-walker';
import { useFetch, IDataSource } from '../util';

/**
 * TerseSpec is the human-authored spec grammar. You write a terse spec, call
 * `normalize(spec, fields)` to expand it into a full canonical IChart, and feed
 * that chart to any renderer. The terse layer is for authoring only — persistence
 * (export/import) always uses the canonical form.
 *
 * Grammar summary:
 * - Field references are BY NAME (`'Manufacturer'`), not by fid. Prefix with
 *   `'fid:'` to bypass name resolution (e.g. `'fid:col_0_64'`).
 * - Aggregation shorthand: `'mean(Price_in_thousands)'`, `'sum(...)'`, `'count()'`.
 * - Object form for per-channel options: `{ field, aggregate, sort, timeUnit }`.
 * - `computed`: inline computed fields — one of `expr` (SQL, quote refs like
 *   `"Horsepower"`), `bin`, or `log`. Reference them by `name` on any channel.
 * - `filters`: `oneOf` / `notIn` / `range` / `timeRange` (epoch ms).
 * - `timeUnit` expands to a real query-level date drill, identical to the UI's
 *   drill-down — not just axis formatting.
 * - `config` / `layout` are canonical escape hatches, merged last.
 */
const DATASET_URL = '/datasets/ds-carsales-service.json';

// Each entry is one grammar lesson. To add a new example, append an entry here —
// `spec` must be a valid TerseSpec against the car-sales dataset (fields:
// Manufacturer, Model, Vehicle_type, Latest_Launch, Sales_in_thousands,
// Price_in_thousands, Horsepower, Curb_weight, Fuel_efficiency, ...).
const TERSE_EXAMPLES: { name: string; description: string; spec: TerseSpec }[] = [
    {
        name: '1. Basic bar chart',
        description: 'Reference fields by NAME and use agg(field) shorthand — no fids, no pools, no layout boilerplate.',
        spec: {
            mark: 'bar',
            x: 'Manufacturer',
            y: 'mean(Price_in_thousands)',
            color: 'Vehicle_type',
        },
    },
    {
        name: '2. Computed field + filter + sort',
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
        name: '3. Time drill line chart',
        description: 'timeUnit expands into a real date-drill computed field at query level — the same drill the UI produces.',
        spec: {
            mark: 'line',
            x: { field: 'Latest_Launch', timeUnit: 'year' },
            y: 'sum(Sales_in_thousands)',
            color: 'Vehicle_type',
        },
    },
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

    const result = useMemo<{ chart: IChart } | { error: string }>(() => {
        try {
            const spec = JSON.parse(applied.text) as TerseSpec;
            return { chart: normalize(spec, fields) };
        } catch (err) {
            return { error: err instanceof Error ? err.message : String(err) };
        }
    }, [applied.text, fields]);

    return (
        <div className="flex flex-col gap-3 p-3">
            <div className="text-sm">
                TerseSpec is the hand-writable spec grammar: fields by <b>name</b>, <code>agg(field)</code> shorthand, inline <code>computed</code> /{' '}
                <code>filters</code>, <code>timeUnit</code> drills. <code>normalize(spec, fields)</code> expands it into the full canonical chart spec that
                every renderer (and export/import) consumes. Edit the JSON below and hit Apply.
            </div>
            <div className="flex flex-wrap gap-2">
                {TERSE_EXAMPLES.map((example, i) => (
                    <button
                        key={example.name}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                            i === exampleIndex ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                        onClick={() => selectExample(i)}
                    >
                        {example.name}
                    </button>
                ))}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{TERSE_EXAMPLES[exampleIndex].description}</div>
            <div className="flex flex-col gap-2">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    spellCheck={false}
                    className="h-48 w-full border rounded font-mono text-xs p-2 bg-transparent"
                />
                <div className="flex gap-2 items-center">
                    <button
                        className="w-min h-9 px-4 py-2 bg-zinc-950 text-white shadow hover:bg-primary/90 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
                        onClick={() => setApplied((prev) => ({ text: input, revision: prev.revision + 1 }))}
                    >
                        Apply
                    </button>
                    <label className="text-xs flex items-center gap-1">
                        <input type="checkbox" checked={showExpanded} onChange={(e) => setShowExpanded(e.target.checked)} />
                        show expanded canonical spec
                    </label>
                </div>
            </div>
            {'error' in result ? (
                <div className="text-sm text-red-600 border border-red-300 rounded p-2 whitespace-pre-wrap">normalize() failed: {result.error}</div>
            ) : (
                <>
                    {showExpanded && (
                        <pre className="text-[10px] leading-tight border rounded p-2 max-h-64 overflow-auto">{JSON.stringify(result.chart, null, 2)}</pre>
                    )}
                    <div style={{ border: '1px solid #ccc' }}>
                        <GraphicRenderer key={applied.revision} fields={fields} data={dataSource} chart={[result.chart]} appearance={theme} />
                    </div>
                </>
            )}
        </div>
    );
}
