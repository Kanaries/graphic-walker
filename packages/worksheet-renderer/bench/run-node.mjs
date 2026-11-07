import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { machineMetadata } from './environment.mjs';
const temporary = await mkdtemp(join(tmpdir(), 'worksheet-benchmark-'));
try {
    const result = await build({ entryPoints: [new URL('./node.ts', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', target: 'node20', write: false });
    const bytes = result.outputFiles[0].contents, file = join(temporary, 'benchmark.mjs');
    await writeFile(file, bytes);
    const child = spawnSync(process.execPath, [...process.execArgv, file, ...process.argv.slice(2)], {
        stdio: 'inherit', env: { ...process.env, BENCH_MACHINE: JSON.stringify(machineMetadata()), BENCH_BUNDLE_SHA256: createHash('sha256').update(bytes).digest('hex') },
    });
    process.exitCode = child.status ?? 1;
} finally { await rm(temporary, { recursive: true, force: true }); }
