import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
await build({ entryPoints: ['src/index.ts'], outfile: 'dist/index.js', bundle: true, format: 'esm', platform: 'browser', target: 'es2020', sourcemap: true });
execFileSync(process.execPath, ['../../node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], { stdio: 'inherit' });
