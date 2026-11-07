import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { BENCHMARK_FONT, BENCHMARK_SEED, BENCHMARK_VIEWPORT } from './fixtures';
import { distribution, prepareBenchmark, renderWindow, sampleWindow } from './pipeline';

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const id = option('--case', 'B2') as 'B2' | 'B3' | 'B4' | 'B5';
if (!['B2', 'B3', 'B4', 'B5'].includes(id)) throw new Error('Use --case B2|B3|B4|B5');
const profile = option('--profile', 'reference');
if (!['quick', 'reference'].includes(profile)) throw new Error('Use --profile quick|reference');
const coldCount = profile === 'reference' ? 30 : 3, rounds = profile === 'reference' ? 5 : 1, samplesPerRound = profile === 'reference' ? 300 : 30;
const gc = (globalThis as typeof globalThis & { gc?: () => void }).gc;
const memory = () => ({ ...process.memoryUsage(), maxRssBytes: process.resourceUsage().maxRSS * 1024 });
const phases: Array<{ name: string; memory: ReturnType<typeof memory>; cpu: NodeJS.CpuUsage }> = [];
const progress = (message: string) => process.stderr.write(`${new Date().toISOString()} ${message}\n`);
gc?.();
progress(`Preparing ${id}, ${profile}, smoke=${args.includes('--smoke')}`);
const prepared = await prepareBenchmark(id, { smoke: args.includes('--smoke'), svgStress: args.includes('--svg-stress'), phase(name) { phases.push({ name, memory: memory(), cpu: process.cpuUsage() }); progress(`${name}: RSS ${(memory().rss / 2 ** 20).toFixed(1)} MiB`); } });
const samples: Array<{ phase: string; round: number; sample: number; cpuMs: number; wallMs: number; timing: Record<string, number>; counts: Record<string, number> }> = [];
async function measure(phase: string, round: number, sample: number) {
    const window = sampleWindow(prepared, sample), cpu = process.cpuUsage(), started = performance.now();
    const stages = new Map<string, NodeJS.CpuUsage>();
    const result = await renderWindow(prepared, window, samples.length + 1, (name) => stages.set(name, process.cpuUsage()));
    const cpuBetween = (start: string, end: string) => { const a = stages.get(start)!, b = stages.get(end)!; return (b.user + b.system - a.user - a.system) / 1000; };
    Object.assign(result.timing, { readCpuMs: cpuBetween('read-start', 'read-end'), validationCpuMs: cpuBetween('read-end', 'validation-end'), sceneCpuMs: cpuBetween('validation-end', 'scene-end') });
    const elapsed = process.cpuUsage(cpu);
    samples.push({ phase, round, sample, cpuMs: (elapsed.user + elapsed.system) / 1000, wallMs: performance.now() - started, timing: result.timing, counts: result.counts });
}
for (let index = 0; index < coldCount; index++) await measure('cold-read-scene', 0, index);
gc?.();
const beforeScroll = memory();
for (let round = 0; round < rounds; round++) {
    progress(`Scroll round ${round + 1}/${rounds}: ${samplesPerRound} real window reads and scenes`);
    for (let index = 0; index < samplesPerRound; index++) await measure('scroll-read-scene', round, index);
}
gc?.();
const afterScroll = memory();
const summarize = (items: typeof samples) => ({
    wallMs: distribution(items.map((item) => item.wallMs)), cpuMs: distribution(items.map((item) => item.cpuMs)),
    readWallMs: distribution(items.map((item) => item.timing.readMs)), readCpuMs: distribution(items.map((item) => item.timing.readCpuMs)), validationCpuMs: distribution(items.map((item) => item.timing.validationCpuMs)), sceneCpuMs: distribution(items.map((item) => item.timing.sceneCpuMs)), validationMs: distribution(items.map((item) => item.timing.validationMs)), sceneMs: distribution(items.map((item) => item.timing.sceneMs)),
    loadedRecords: distribution(items.map((item) => item.counts.loadedRecords)), loadedPanes: distribution(items.map((item) => item.counts.loadedPanes)), visibleMarks: distribution(items.map((item) => item.counts.marks)), commands: distribution(items.map((item) => item.counts.commands)),
});
const report = {
    schema: 'worksheet-node-benchmark-v1', case: prepared.id, profile,
    environment: { ...JSON.parse(process.env.BENCH_MACHINE ?? '{}'), bundleSha256: process.env.BENCH_BUNDLE_SHA256, seed: BENCHMARK_SEED, viewport: BENCHMARK_VIEWPORT, font: BENCHMARK_FONT, fontMeasurement: 'Node deterministic fallback; no browser font or paint measurement', gcAvailable: !!gc, execArgv: process.execArgv },
    preparation: prepared.preparation, phases, manifest: prepared.manifest, expected: prepared.fixture?.expected,
    cold: summarize(samples.filter((item) => item.phase === 'cold-read-scene')),
    scroll: { combined: summarize(samples.filter((item) => item.phase === 'scroll-read-scene')), rounds: Array.from({ length: rounds }, (_, round) => summarize(samples.filter((item) => item.phase === 'scroll-read-scene' && item.round === round))) },
    memory: { beforeScroll, afterScroll, heapRetainedDeltaBytes: afterScroll.heapUsed - beforeScroll.heapUsed, includesPreparedInputAndIndex: true },
    limitations: ['Node measures actual source reads, contract validation and Scene construction. It does not paint Canvas/SVG or measure browser frames, input latency, long tasks or SVG DOM nodes.', 'Source indexing occurs once and is reported separately. Cold samples are fresh reads/scenes from the prepared source, not full independent browser-controller first frames.', 'Full input and source index remain resident. These memory totals are not the runtime-only 128 MiB metric.', 'No renderer cache is used in this Node pipeline. Browser hot-cache and scheduler metrics require the browser harness.'], samples,
};
const output = option('--output', '');
if (output) { await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2)); progress(`Saved ${output}`); }
process.stdout.write(JSON.stringify({ case: report.case, preparation: report.preparation, cold: report.cold, scroll: report.scroll.combined, memory: report.memory }, null, 2) + '\n');
