import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { rm, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
await rm('dist', { recursive: true, force: true });
await build({
    entryPoints: ['src/index.ts', 'src/react.ts'],
    outdir: 'dist',
    splitting: true,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    sourcemap: true,
    external: ['react'],
});
execFileSync(process.execPath, ['../../node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], { stdio: 'inherit' });
// Declarations must resolve in native ESM/NodeNext consumers as well as bundlers.
async function fixDeclarationImports(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await fixDeclarationImports(path);
        else if (entry.name.endsWith('.d.ts')) {
            const text = await readFile(path, 'utf8');
            await writeFile(
                path,
                text.replace(
                    /(\bfrom\s+|\bimport\s*\()(['"])(\.[^'"]+)(['"])/g,
                    (_match, prefix, quote, specifier, endQuote) =>
                        prefix + quote + specifier + (extname(specifier) ? '' : '.js') + endQuote,
                ),
            );
        }
    }
}
await fixDeclarationImports('dist');
