import { context } from 'esbuild';
import { machineMetadata } from './environment.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const metadata = machineMetadata();
const ctx = await context({ entryPoints: [new URL('./browser.ts', import.meta.url).pathname], outfile: new URL('./browser.bundle.js', import.meta.url).pathname, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', sourcemap: true, define: { __BENCH_METADATA__: JSON.stringify(metadata) }, plugins: [{ name: 'build-metadata', setup(build) { build.onEnd(async (result) => { if (result.errors.length) return; const bytes = await readFile(new URL('./browser.bundle.js', import.meta.url)); await writeFile(new URL('./build.json', import.meta.url), JSON.stringify({ bundleSha256: createHash('sha256').update(bytes).digest('hex'), builtAt: new Date().toISOString() })); }); } }] });
await ctx.watch();
const server = await ctx.serve({ host: '127.0.0.1', port: Number(process.env.BENCH_PORT ?? 4182), servedir: new URL('.', import.meta.url).pathname });
console.log(`Worksheet benchmark: http://${server.host}:${server.port}`);
