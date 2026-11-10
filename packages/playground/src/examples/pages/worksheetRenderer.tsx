import { useMemo, useRef, useState } from 'react';
import { getComputation } from '@kanaries/graphic-walker';
import { Worksheet, compileWorksheet, type WorksheetHandle, type WorksheetSpec } from '@kanaries/worksheet-renderer';
import { axis, axisFields, dimensions, instances, measures, orders, presets, regions, type Shelves } from './worksheetRenderer.data';
import './worksheetRenderer.css';

const computation = getComputation(orders);
function Shelf({ name, values, options, onChange }: { name: string; values: string[]; options: string[]; onChange: (value: string[]) => void }) {
    return <div className="ws-shelf">
        <span className="ws-shelf-label">{name}</span>
        {values.map((id, i) => <span className={`ws-pill ${instances[id].display === 'continuous' ? 'ws-measure' : ''}`} key={id}>
            {instances[id].label}
            {i > 0 ? <button type="button" aria-label={`Move ${name} ${id} left`} title="Move left" onClick={() => { const next = [...values]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; onChange(next); }}>‹</button> : null}
            <button type="button" aria-label={`Remove ${name} ${id}`} title="Remove field" onClick={() => onChange(values.filter(v => v !== id))}>×</button>
        </span>)}
        <select aria-label={`Add ${name}`} value="" onChange={e => { if (e.target.value) onChange([...values, e.target.value]); }}>
            <option value="">+ Add field</option>{options.filter(id => !values.includes(id)).map(id => <option key={id} value={id}>{instances[id].label}</option>)}
        </select>
    </div>;
}
function download(filename: string, contents: string, type: string) {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function WorksheetRendererPage() {
    const [shelves, setShelves] = useState<Shelves>(presets.nested);
    const [scaleScope, setScaleScope] = useState<WorksheetSpec['scaleScope']>('shared');
    const [color, setColor] = useState(presets.nested.color ?? '');
    const [detail, setDetail] = useState('');
    const [text, setText] = useState('sales');
    const [stack, setStack] = useState(true);
    const [sort, setSort] = useState<WorksheetSpec['sort']>('ascending');
    const [region, setRegion] = useState('');
    const [slot, setSlot] = useState(200);
    const [step, setStep] = useState(24);
    const [fit, setFit] = useState<WorksheetSpec['fit'] | ''>('');
    const [exportError, setExportError] = useState('');
    const handle = useRef<WorksheetHandle>(null);
    const spec = useMemo<WorksheetSpec>(() => ({
        kind: 'worksheet', specVersion: 2, instances,
        rows: axis(shelves.rows, shelves.rowMeasures), columns: axis(shelves.columns, shelves.columnMeasures),
        mark: shelves.mark, color: color || undefined, detail: detail ? [detail] : [], text: shelves.mark === 'text' ? text : undefined,
        stack, scaleScope, sort, pane: { width: slot, height: Math.round(slot * .8) }, band: { width: shelves.mark === 'text' ? undefined : step + 4, height: step }, fit: fit || undefined,
        filters: region ? [{ field: 'Region', values: [region] }] : [],
    }), [shelves, color, detail, text, stack, scaleScope, sort, slot, step, fit, region]);
    const diagnostic = useMemo(() => { try { return compileWorksheet(spec).tasks; } catch { return []; } }, [spec]);
    const updateShelf = (key: keyof Omit<Shelves, 'mark' | 'color' | 'text' | 'fit'>, values: string[]) => setShelves(s => ({ ...s, [key]: values }));
    return <section className="worksheet-lab">
        <div className="ws-heading"><div><p className="ws-eyebrow">INTERNAL RENDERER · V0</p><h1>Nested worksheets</h1>
            <p>多层嵌套、度量并列和分面。每个成员占一个等宽的格子，数值轴画在表格边缘，表头和轴在滚动时固定。点击标记选中，按住 Ctrl 或 Cmd 加选，Esc 清空。</p></div>
            <button className="ws-export" type="button" onClick={async () => {
                try { const svg = await handle.current!.exportSVG(); download('worksheet.svg', svg, 'image/svg+xml'); setExportError(''); }
                catch (error) { setExportError(String(error)); }
            }}>Export full SVG</button>
        </div>
        <div className="ws-presets" aria-label="Worksheet presets">
            {Object.entries(presets).map(([key, preset]) =>
                <button type="button" key={key} onClick={() => { setShelves(preset); setColor(preset.color ?? ''); setText(preset.text ?? 'sales'); setFit(preset.fit ?? ''); setDetail(''); setStack(true); }}>{preset.label}</button>)}
        </div>
        <div className="ws-shelves">
            <Shelf name="Rows" values={shelves.rows} options={dimensions} onChange={v => updateShelf('rows', v)} />
            <Shelf name="Row axis" values={shelves.rowMeasures} options={axisFields} onChange={v => updateShelf('rowMeasures', v)} />
            <Shelf name="Columns" values={shelves.columns} options={dimensions} onChange={v => updateShelf('columns', v)} />
            <Shelf name="Column axis" values={shelves.columnMeasures} options={axisFields} onChange={v => updateShelf('columnMeasures', v)} />
        </div>
        <div className="ws-toolbar">
            <label>Mark<select value={shelves.mark} onChange={e => setShelves(s => ({ ...s, mark: e.target.value as Shelves['mark'] }))}>{['bar', 'point', 'circle', 'tick', 'line', 'area', 'rect', 'text'].map(v => <option key={v}>{v}</option>)}</select></label>
            <label>Axis range<select value={scaleScope} onChange={e => setScaleScope(e.target.value as WorksheetSpec['scaleScope'])}>
                <option value="shared">Uniform per measure</option><option value="prefix">Per outer header</option><option value="independent">Independent per row / column</option>
            </select></label>
            <label>Color<select value={color} onChange={e => setColor(e.target.value)}><option value="">None</option>{[...dimensions, ...measures].map(id => <option key={id} value={id}>{instances[id].label}</option>)}</select></label>
            <label>Text<select value={text} disabled={shelves.mark !== 'text'} onChange={e => setText(e.target.value)}>{measures.map(id => <option key={id} value={id}>{instances[id].label}</option>)}</select></label>
            <label>Detail<select value={detail} onChange={e => setDetail(e.target.value)}><option value="">None</option>{dimensions.map(id => <option key={id}>{id}</option>)}</select></label>
            <label>Region filter<select value={region} onChange={e => setRegion(e.target.value)}><option value="">All regions</option>{regions.map(r => <option key={r}>{r}</option>)}</select></label>
            <label>Order<select value={sort} onChange={e => setSort(e.target.value as WorksheetSpec['sort'])}><option value="ascending">Ascending</option><option value="descending">Descending</option></select></label>
            <label>Member step<select value={step} onChange={e => setStep(Number(e.target.value))}><option value="18">Compact</option><option value="24">Default</option><option value="32">Roomy</option></select></label>
            <label>Axis slot<select value={slot} onChange={e => setSlot(Number(e.target.value))}><option value="150">Compact</option><option value="200">Default</option><option value="280">Wide</option></select></label>
            <label>Fit<select value={fit} onChange={e => setFit(e.target.value as WorksheetSpec['fit'] | '')}><option value="">Standard</option><option value="width">Fit width</option><option value="height">Fit height</option><option value="both">Entire view</option></select></label>
            <label className="ws-check"><input type="checkbox" checked={stack} disabled={shelves.mark !== 'bar' && shelves.mark !== 'area'} onChange={e => setStack(e.target.checked)} /> Stack bars</label>
        </div>
        <p className="ws-note">{orders.length.toLocaleString()} synthetic order lines · SUM(Sales), AVG(Profit), COUNTD(Order) 保留独立聚合。三个 Category 分别有 4、9、4 个 Subcategory，Fasteners 在 South 没有记录。导出包含整张工作表。</p>
        {exportError ? <p role="alert">{exportError}</p> : null}
        <Worksheet ref={handle} spec={spec} computation={computation} height={620} />
        <details className="ws-diagnostics"><summary>Inspect worksheet spec and query plan</summary>
            <button type="button" onClick={() => download('worksheet.json', JSON.stringify(spec, null, 2), 'application/json')}>Download spec</button>
            <div className="ws-code-columns"><pre>{JSON.stringify({ ...spec, instances: undefined }, null, 2)}</pre><pre>{JSON.stringify(diagnostic.map(t => t.payload), null, 2)}</pre></div>
        </details>
        <p className="ws-note">V0 独立实验入口。尚未接入旧编辑器的历史记录，没有折叠、双轴、LOD 或表计算。</p>
    </section>;
}
