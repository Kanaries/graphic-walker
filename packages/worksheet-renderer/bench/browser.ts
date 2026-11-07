import { createWorksheet } from '../src/runtime/worksheet';
import type { RenderDataSource } from '../src/core/types';
import { layoutMetrics } from '../src/scene/build';
import { BENCHMARK_FONT, BENCHMARK_SEED, BENCHMARK_VIEWPORT, type BenchmarkCase } from './fixtures';
import { distribution, prepareBenchmark, sampleWindow, type PreparedBenchmark } from './pipeline';

declare const __BENCH_METADATA__: Record<string, unknown>;
const buildMetadata = fetch('./build.json')
    .then((response) => (response.ok ? response.json() : {}))
    .catch(() => ({}));
const host = document.querySelector<HTMLElement>('#worksheet')!;
const output = document.querySelector<HTMLElement>('#output')!;
const status = document.querySelector<HTMLElement>('#status')!;
let prepared: PreparedBenchmark | undefined;
let view: ReturnType<typeof createWorksheet> | undefined;
let lastReport: unknown;
const metrics: unknown[] = [],
    diagnostics: unknown[] = [],
    reads: Array<{ method: string; syncCallMs: number; wallMs: number; awaitMs: number }> = [];
let backend: 'canvas' | 'svg' = 'canvas';
const memory = () => {
    const value = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } })
        .memory;
    return value
        ? { usedJSHeapSize: value.usedJSHeapSize, totalJSHeapSize: value.totalJSHeapSize, jsHeapSizeLimit: value.jsHeapSizeLimit }
        : undefined;
};
const raf = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
const paint = async () => {
    await raf();
    await raf();
};
const say = (message: string) => {
    status.textContent = message;
};
function traceSource(source: RenderDataSource): RenderDataSource {
    const traced = { version: source.version } as RenderDataSource;
    for (const method of ['describe', 'readAxis', 'readDomains', 'readPaneData', 'locate'] as const) {
        (traced as unknown as Record<string, unknown>)[method] = async (...args: unknown[]) => {
            const start = performance.now();
            const result = (source[method] as (...args: unknown[]) => Promise<unknown>)(...args);
            const returned = performance.now();
            try {
                return await result;
            } finally {
                const end = performance.now();
                reads.push({ method, syncCallMs: returned - start, wallMs: end - start, awaitMs: end - returned });
            }
        };
    }
    return traced;
}
function mount() {
    if (!prepared) throw new Error('Prepare a fixture first');
    view?.dispose();
    view = createWorksheet(
        host,
        { plan: prepared.plan, source: prepared.source, backend },
        { autoResize: false, ...BENCHMARK_VIEWPORT, metrics: true, accessibleName: `${prepared.id} benchmark worksheet` },
    );
    view.on('metrics', (event) => metrics.push(event));
    view.on('diagnostic', (event) => diagnostics.push(event));
    return view;
}
async function prepare(id: BenchmarkCase | 'B4', options: { smoke?: boolean; svgStress?: boolean; backend?: 'canvas' | 'svg' } = {}) {
    view?.dispose();
    view = undefined;
    prepared = undefined;
    reads.length = 0;
    diagnostics.length = 0;
    metrics.length = 0;
    backend = options.backend ?? (id === 'B5' ? 'svg' : 'canvas');
    say(`Generating ${id} prepared records on this device…`);
    await paint();
    const phaseMemory: Array<{ phase: string; memory: ReturnType<typeof memory> }> = [];
    prepared = await prepareBenchmark(id, {
        ...options,
        phase(phase) {
            phaseMemory.push({ phase, memory: memory() ? { ...memory()! } : undefined });
            say(`${id}: ${phase}`);
        },
    });
    prepared.source = traceSource(prepared.source);
    await document.fonts.ready;
    const instance = mount();
    const receipt = await instance.ready;
    if (receipt.status !== 'committed') throw new Error(`Initial viewport ${receipt.status}: ${JSON.stringify(diagnostics.at(-1))}`);
    await paint();
    const result = { preparation: prepared.preparation, expected: prepared.fixture?.expected, manifest: prepared.manifest, phaseMemory };
    output.textContent = JSON.stringify(result, null, 2);
    say(`${prepared.id} ready. Scroll, select a mark, or run measurements.`);
    return result;
}
function state() {
    const snapshot = view?.getViewState();
    const scalar = snapshot as (NonNullable<typeof snapshot> & { frameId?: number; displayedFrameId?: number }) | undefined;
    const canvas = host.querySelector('canvas');
    return {
        fixture: prepared?.id,
        view: scalar
            ? {
                  inputRevision: scalar.inputRevision,
                  version: scalar.version,
                  frameId: scalar.frameId,
                  displayedFrameId: scalar.displayedFrameId,
                  scrollX: scalar.scrollX,
                  scrollY: scalar.scrollY,
                  loading: scalar.loading,
                  cacheWindows: scalar.cacheWindows,
              }
            : undefined,
        canvasCount: host.querySelectorAll('canvas').length,
        svgNodes: host.querySelectorAll('svg *').length,
        domNodes: host.querySelectorAll('*').length,
        bitmap: canvas ? { width: canvas.width, height: canvas.height } : undefined,
        memory: memory() ? { ...memory()! } : undefined,
        reads: reads.length,
        metrics: metrics.length,
        diagnostics: [...diagnostics],
    };
}
async function move(x: number, y: number) {
    if (!view) throw new Error('Prepare a fixture first');
    const instance = view,
        previous = (instance.getViewState() as { frameId?: number }).frameId ?? 0;
    return new Promise<{ commitMs: number; frameId: number }>((resolve, reject) => {
        const started = performance.now();
        const timeout = setTimeout(() => {
            off();
            offLoad();
            reject(new Error('Timed out waiting for a committed viewport'));
        }, 15_000);
        const finish = () => {
            const snapshot = instance.getViewState() as ReturnType<typeof instance.getViewState> & { frameId?: number };
            if (snapshot.frameId && snapshot.frameId > previous && !snapshot.loading) {
                clearTimeout(timeout);
                off();
                offLoad();
                resolve({ commitMs: performance.now() - started, frameId: snapshot.frameId });
            }
        };
        const off = instance.on('viewStateChange', finish);
        const offLoad = instance.on('loadStateChange', (event) => {
            if (event.state === 'error') {
                clearTimeout(timeout);
                off();
                offLoad();
                reject(new Error(JSON.stringify(diagnostics.at(-1))));
            } else finish();
        });
        instance.scrollToPosition({ x, y });
    });
}
async function run(
    options: { profile?: 'quick' | 'reference'; lifecycle?: boolean; trajectory?: 'cells' | 'pixels'; maxPixelOffset?: number } = {},
) {
    if (!prepared) throw new Error('Prepare a fixture first');
    const trajectory = options.trajectory ?? 'cells',
        maxPixelOffset = options.maxPixelOffset ?? 120;
    if (!Number.isSafeInteger(maxPixelOffset) || maxPixelOffset < 1 || maxPixelOffset > 10_000)
        throw new Error('Pixel offset must be an integer from 1 to 10,000');
    const idleTimes: number[] = [];
    for (let index = 0; index < 120; index++) idleTimes.push(await raf());
    const idleIntervals = idleTimes.slice(1).map((time, index) => time - idleTimes[index]);
    const idleDistribution = distribution(idleIntervals);
    const observedFrameIntervalMs = idleDistribution.p50;
    const profile = options.profile ?? 'reference',
        coldCount = profile === 'reference' ? 30 : 3,
        roundCount = profile === 'reference' ? 5 : 1,
        framesPerRound = profile === 'reference' ? 300 : 30;
    const cold: Array<{ commitMs: number; presentedMs: number; state: ReturnType<typeof state> }> = [];
    const longTasks: Array<{ startTime: number; duration: number }> = [];
    let observer: PerformanceObserver | undefined;
    try {
        observer = new PerformanceObserver((list) =>
            list.getEntries().forEach((entry) => longTasks.push({ startTime: entry.startTime, duration: entry.duration })),
        );
        observer.observe({ type: 'longtask', buffered: true });
    } catch {}
    for (let i = 0; i < coldCount; i++) {
        say(`Cold viewport ${i + 1}/${coldCount}`);
        view?.dispose();
        await raf();
        const started = performance.now(),
            instance = mount(),
            receipt = await instance.ready,
            committed = performance.now();
        if (receipt.status !== 'committed') throw new Error(`Cold viewport ${receipt.status}`);
        await paint();
        cold.push({ commitMs: committed - started, presentedMs: performance.now() - started, state: state() });
    }
    const layout = layoutMetrics(prepared.plan, BENCHMARK_VIEWPORT.width, BENCHMARK_VIEWPORT.height);
    const positions =
        trajectory === 'pixels'
            ? [
                  ...Array.from({ length: maxPixelOffset + 1 }, (_, x) => ({ x, y: x })),
                  ...Array.from({ length: maxPixelOffset - 1 }, (_, index) => ({
                      x: maxPixelOffset - index - 1,
                      y: maxPixelOffset - index - 1,
                  })),
              ]
            : [
                  { x: 0, y: 0 },
                  { x: layout.columnWidth, y: 0 },
                  { x: layout.columnWidth, y: layout.rowHeight },
                  { x: 0, y: layout.rowHeight },
              ];
    for (const position of positions) {
        await move(position.x, position.y);
        await raf();
    }
    const rounds: Array<Record<string, unknown> & { commitSamplesMs: number[]; rafIntervalsMs: number[] }> = [];
    for (let round = 0; round < roundCount; round++) {
        say(`Hot scroll round ${round + 1}/${roundCount}: ${framesPerRound} committed frames`);
        const readStart = reads.length,
            metricStart = metrics.length,
            frames: number[] = [],
            commits: number[] = [],
            rafTimes: number[] = [];
        let running = true;
        const recordFrame = (time: number) => {
            if (running) {
                rafTimes.push(time);
                requestAnimationFrame(recordFrame);
            }
        };
        requestAnimationFrame(recordFrame);
        const started = performance.now();
        for (let index = 0; index < framesPerRound; index++) {
            const position = positions[index % positions.length],
                result = await move(position.x, position.y);
            commits.push(result.commitMs);
            frames.push(result.frameId);
            await raf();
        }
        running = false;
        const ended = performance.now(),
            intervals = rafTimes.slice(1).map((time, index) => time - rafTimes[index]);
        const runtimeMetrics = metrics.slice(metricStart);
        const metricDistribution = (name: string) =>
            distribution(
                runtimeMetrics
                    .map((event) => (event as Record<string, unknown>)[name])
                    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value)),
            );
        rounds.push({
            round,
            commitMs: distribution(commits),
            runtimeCpuMs: metricDistribution('cpuMs'),
            runtimeSceneMs: metricDistribution('sceneMs'),
            runtimeSubmitMs: metricDistribution('submitMs'),
            runtimeReadMs: metricDistribution('readMs'),
            rafIntervalMs: distribution(intervals),
            frameIds: frames,
            commitSamplesMs: commits,
            rafIntervalsMs: intervals,
            sourceReadCount: reads.length - readStart,
            metrics: runtimeMetrics,
            longTasks: longTasks.filter((entry) => entry.startTime >= started && entry.startTime <= ended),
            droppedFrameIntervals: intervals.filter((value) => value > (1000 / 60) * 1.5).length,
            intervalsOver60HzReference: intervals.filter((value) => value > 25).length,
            intervalsOverObservedCadence: intervals.filter((value) => value > observedFrameIntervalMs * 1.5).length,
            state: {
                canvasCount: state().canvasCount,
                svgNodes: state().svgNodes,
                domNodes: state().domNodes,
                bitmap: state().bitmap,
                memory: state().memory,
            },
        });
    }
    observer?.disconnect();
    const lifecycle = options.lifecycle ? await runLifecycle(profile === 'reference' ? 50 : 3) : undefined;
    const report = {
        schema: 'worksheet-browser-benchmark-v1',
        case: prepared.id,
        backend,
        profile,
        trajectory,
        maxPixelOffset: trajectory === 'pixels' ? maxPixelOffset : undefined,
        environment: {
            ...__BENCH_METADATA__,
            ...(await buildMetadata),
            userAgent: navigator.userAgent,
            hardwareConcurrency: navigator.hardwareConcurrency,
            deviceMemoryGiB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
            seed: BENCHMARK_SEED,
            viewport: BENCHMARK_VIEWPORT,
            actualDevicePixelRatio: devicePixelRatio,
            idleRafIntervalMs: idleDistribution,
            observedRefreshHz: 1000 / observedFrameIntervalMs,
            font: BENCHMARK_FONT,
            fontChecks: { Arial: document.fonts.check('11px Arial'), NotoSansCJK: document.fonts.check('11px "Noto Sans CJK SC"') },
            longTaskObserverSupported: PerformanceObserver.supportedEntryTypes?.includes('longtask') ?? false,
        },
        manifest: prepared.manifest,
        preparation: prepared.preparation,
        cold: {
            commitMs: distribution(cold.map((sample) => sample.commitMs)),
            presentedMs: distribution(cold.map((sample) => sample.presentedMs)),
            samples: cold,
        },
        scroll: {
            combinedCommitMs: distribution(rounds.flatMap((round) => round.commitSamplesMs)),
            combinedRafIntervalMs: distribution(rounds.flatMap((round) => round.rafIntervalsMs)),
            rounds,
        },
        sourceReads: {
            count: reads.length,
            syncCallMs: distribution(reads.map((read) => read.syncCallMs)),
            awaitMs: distribution(reads.map((read) => read.awaitMs)),
            wallMs: distribution(reads.map((read) => read.wallMs)),
        },
        lifecycle,
        diagnostics: [...diagnostics],
        limitations: [
            'Automated scrolling uses the public controller API and actual browser painting. Native wheel, keyboard, pointer and selection acceptance are separate interactive checks.',
            'Provider syncCallMs is synchronous time before its promise returns, not a CPU profiler. awaitMs includes asynchronous work as well as waiting.',
            'Browser heap includes fixture records, complete-source index and library state; it is not an isolated 128 MiB runtime measurement.',
            'Font checks report availability requested by the browser and do not identify fallback glyph fonts.',
        ],
    };
    lastReport = report;
    output.textContent = JSON.stringify(report, null, 2);
    say(`${prepared.id}: ${coldCount} cold viewports and ${roundCount * framesPerRound} scroll frames recorded.`);
    return report;
}
async function runLifecycle(count = 50) {
    if (!prepared) throw new Error('Prepare a fixture first');
    const gc = (window as Window & { gc?: () => void }).gc;
    const settleDisposed = async () => {
        await paint();
        gc?.();
        await paint();
        gc?.();
    };
    view?.dispose();
    await settleDisposed();
    const before = memory() ? { ...memory()! } : undefined;
    const beforeTrace = { metrics: metrics.length, reads: reads.length, diagnostics: diagnostics.length };
    let maximumDomNodes = 0;
    for (let index = 0; index < count; index++) {
        const instance = mount();
        if ((await instance.ready).status !== 'committed') throw new Error('Lifecycle mount did not commit');
        maximumDomNodes = Math.max(maximumDomNodes, host.querySelectorAll('*').length);
        instance.dispose();
        if (host.childElementCount) throw new Error('Disposed worksheet left DOM in its host');
        await raf();
    }
    await settleDisposed();
    const after = memory() ? { ...memory()! } : undefined;
    const result = {
        count,
        baseline: 'disposed controller retained by host; two native rAF, GC, two native rAF, GC at both boundaries',
        beforeTrace,
        afterTrace: { metrics: metrics.length, reads: reads.length, diagnostics: diagnostics.length },
        maximumDomNodes,
        finalDomNodes: host.childElementCount,
        gcAvailable: !!gc,
        before,
        after,
        retainedHeapGrowthFraction: before && after ? (after.usedJSHeapSize - before.usedJSHeapSize) / before.usedJSHeapSize : null,
    };
    await mount().ready;
    return result;
}
async function jumpToSample(sample: number) {
    if (!prepared) throw new Error('Prepare a fixture first');
    const window = sampleWindow(prepared, sample),
        layout = layoutMetrics(prepared.plan, 1440, 900);
    return move(window.columns.start * layout.columnWidth, window.rows.start * layout.rowHeight);
}
async function runEndToEnd(id: BenchmarkCase | 'B4', options: { samples?: number; backend?: 'canvas' | 'svg'; svgStress?: boolean } = {}) {
    const samples: Array<Awaited<ReturnType<typeof prepare>> & { sample: number; endToEndPresentedMs: number }> = [];
    for (let index = 0; index < (options.samples ?? 30); index++) {
        view?.dispose();
        view = undefined;
        prepared = undefined;
        (window as Window & { gc?: () => void }).gc?.();
        await raf();
        const start = performance.now();
        const result = await prepare(id, options);
        samples.push({ sample: index, endToEndPresentedMs: performance.now() - start, ...result });
    }
    const report = {
        case: id,
        kind: 'browser-full-source-rebuilds',
        environment: { ...__BENCH_METADATA__, ...(await buildMetadata), userAgent: navigator.userAgent },
        endToEndPresentedMs: distribution(samples.map((sample) => sample.endToEndPresentedMs)),
        samples,
    };
    lastReport = report;
    output.textContent = JSON.stringify(report, null, 2);
    return report;
}
function download() {
    if (!lastReport) throw new Error('Run a benchmark first');
    const url = URL.createObjectURL(new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${prepared?.id ?? 'worksheet'}-browser-benchmark.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const guarded = (operation: () => Promise<unknown> | void) => async () => {
    try {
        await operation();
    } catch (error) {
        say(String(error));
        output.textContent = JSON.stringify({ error: String(error), diagnostics }, null, 2);
    }
};
document.querySelector('#prepare')!.addEventListener(
    'click',
    guarded(() =>
        prepare((document.querySelector('#case') as HTMLSelectElement).value as BenchmarkCase | 'B4', {
            backend: (document.querySelector('#backend') as HTMLSelectElement).value as 'canvas' | 'svg',
            svgStress: (document.querySelector('#stress') as HTMLInputElement).checked,
        }),
    ),
);
document.querySelector('#run')!.addEventListener(
    'click',
    guarded(() =>
        run({
            profile: (document.querySelector('#profile') as HTMLSelectElement).value as 'quick' | 'reference',
            lifecycle: (document.querySelector('#lifecycle') as HTMLInputElement).checked,
        }),
    ),
);
document.querySelector('#first')!.addEventListener(
    'click',
    guarded(() => move(0, 0)),
);
document.querySelector('#last')!.addEventListener(
    'click',
    guarded(() => move(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)),
);
document.querySelector('#download')!.addEventListener('click', guarded(download));
(window as unknown as { worksheetBenchmark: unknown }).worksheetBenchmark = {
    prepare,
    run,
    runEndToEnd,
    runLifecycle,
    jumpToSample,
    move,
    state,
    download,
    getReport: () => lastReport,
    dispose: () => {
        view?.dispose();
        view = undefined;
        prepared = undefined;
    },
};
