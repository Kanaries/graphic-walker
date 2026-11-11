import { build } from 'esbuild';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const temp = await mkdtemp(path.join(root, '.test-'));
try {
    const names = (await readdir(path.join(root, 'tests'))).filter(name => name.endsWith('.test.ts'));
    await build({ entryPoints: names.map(name => path.join(root, 'tests', name)), outdir: temp, outExtension: { '.js': '.cjs' }, bundle: true, platform: 'node', format: 'cjs', packages: 'external' });
    const result = spawnSync(process.execPath, ['--test', ...names.map(name => path.join(temp, name.replace(/\.ts$/, '.cjs')))], { stdio: 'inherit' });
    process.exitCode = result.status ?? 1;
} finally { await rm(temp, { recursive: true, force: true }); }
