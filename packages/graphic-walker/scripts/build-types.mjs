import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const cwd = fileURLToPath(new URL('..', import.meta.url));
const run = (module, args) => execFileSync(process.execPath, [require.resolve(module), ...args], { cwd, stdio: 'inherit' });

// The runtime is bundled by Vite. Ship its modules and declarations inside this package as well,
// so consumers never need the private worksheet workspace or the monorepo's paths.
run('typescript/bin/tsc', ['-p', '../worksheet-renderer/tsconfig.json', '--noEmit', 'false', '--declaration', '--rootDir', '../worksheet-renderer/src', '--outDir', 'dist/worksheet']);
run('ts-patch/bin/tspc.js', ['-p', 'tsconfig.build.json']);
