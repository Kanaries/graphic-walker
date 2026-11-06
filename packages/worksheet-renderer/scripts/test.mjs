import { build } from 'esbuild';
import { readdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const dir = await mkdtemp(join(tmpdir(), 'worksheet-tests-'));
try {
  const entries = (await readdir('tests')).filter(x => x.endsWith('.test.ts'));
  const files = [];
  for (const entry of entries) {
    const outfile = join(dir, entry.replace(/\.ts$/, '.mjs'));
    await build({ entryPoints: [join('tests', entry)], outfile, bundle: true, platform: 'node', format: 'esm', target: 'node20' });
    files.push(outfile);
  }
  if (!files.length) throw new Error('No tests discovered');
  const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally { await rm(dir, { recursive: true, force: true }); }
