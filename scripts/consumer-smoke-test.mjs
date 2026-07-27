import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const packageDir = path.join(repoRoot, 'packages/graphic-walker');
const require = createRequire(import.meta.url);

function isPathInside(parentPath, childPath) {
    const relativePath = path.relative(parentPath, childPath);

    return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

async function run(command, args, cwd) {
    console.log(`$ ${command} ${args.join(' ')}`);

    await new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            stdio: 'inherit',
        });

        child.on('error', reject);
        child.on('close', (code, signal) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`${command} exited with ${signal ? `signal ${signal}` : `code ${code}`}`));
        });
    });
}

function getYarnInvocation(args) {
    const yarnCliPath = process.env.npm_execpath;
    const isYarnCli = yarnCliPath && /^yarn(?:pkg)?(?:\.c?js)?$/i.test(path.basename(yarnCliPath));

    if (isYarnCli) {
        return {
            command: process.execPath,
            args: [yarnCliPath, ...args],
        };
    }

    assert.notEqual(
        process.platform,
        'win32',
        'On Windows, run this smoke test through Yarn Classic (yarn test:consumer) so its JavaScript CLI can be invoked safely.'
    );

    return {
        command: 'yarn',
        args,
    };
}

async function runYarn(args, cwd) {
    const invocation = getYarnInvocation(args);

    await run(invocation.command, invocation.args, cwd);
}

async function getYarnVersion() {
    const invocation = getYarnInvocation(['--version']);
    let stdout = '';

    await new Promise((resolve, reject) => {
        const child = spawn(invocation.command, invocation.args, {
            cwd: repoRoot,
            stdio: ['ignore', 'pipe', 'inherit'],
        });

        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            stdout += chunk;
        });
        child.on('error', reject);
        child.on('close', (code, signal) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`${invocation.command} --version exited with ${signal ? `signal ${signal}` : `code ${code}`}`));
        });
    });

    return stdout.trim();
}

async function assertExternalized(installedPackageDir) {
    const [esmBundle, umdBundle] = await Promise.all([
        fs.readFile(path.join(installedPackageDir, 'dist/graphic-walker.es.js'), 'utf8'),
        fs.readFile(path.join(installedPackageDir, 'dist/graphic-walker.umd.js'), 'utf8'),
    ]);
    const umdPrelude = umdBundle.slice(0, 4096);

    assert.match(esmBundle, /\bfrom\s*["']styled-components["']/, 'ESM bundle must keep styled-components external');
    assert.match(umdPrelude, /require\(["']styled-components["']\)/, 'UMD bundle must require styled-components');
    assert.match(umdPrelude, /define\(\[[^\]]*["']styled-components["']/, 'UMD AMD dependencies must include styled-components');
    assert.match(
        umdPrelude,
        /([$_A-Za-z][$_\w]*)\.GraphicWalker=\{\},[^)]*\1\.styled(?:,|\))/,
        'UMD global dependencies must map styled-components to the styled global'
    );

    console.log('Verified styled-components remains external in the packed ESM and UMD bundles.');
}

export async function runConsumerSmokeTest(options = {}) {
    const yarnVersion = await getYarnVersion();
    const sourceManifest = JSON.parse(await fs.readFile(path.join(packageDir, 'package.json'), 'utf8'));
    const expectedStyledComponentsRange = sourceManifest.dependencies?.['styled-components'];

    assert.match(yarnVersion, /^1\./, `This smoke test requires Yarn Classic, received ${yarnVersion}`);
    assert.equal(typeof expectedStyledComponentsRange, 'string', 'styled-components must be declared as a runtime dependency');
    assert(expectedStyledComponentsRange.length > 0, 'styled-components runtime dependency range must not be empty');
    console.log(`Using Yarn ${yarnVersion}.`);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gw-361-'));

    try {
        const [realRepoRoot, realTempDir] = await Promise.all([fs.realpath(repoRoot), fs.realpath(tempDir)]);

        assert(!isPathInside(realRepoRoot, realTempDir), `Consumer temp directory must be outside the repository: ${realTempDir}`);

        const tarballPath = path.join(tempDir, 'graphic-walker.tgz');
        const consumerDir = path.join(tempDir, 'consumer');
        const sourceDir = path.join(consumerDir, 'src');
        const yarnCacheDir = path.join(tempDir, 'yarn-cache');

        if (options.tarballPath) {
            const sourceTarball = path.resolve(options.tarballPath);
            await fs.copyFile(sourceTarball, tarballPath);
            console.log(`Using package tarball ${sourceTarball}.`);
        } else {
            try {
                await Promise.all([
                    fs.access(path.join(packageDir, 'dist/graphic-walker.es.js')),
                    fs.access(path.join(packageDir, 'dist/graphic-walker.umd.js')),
                ]);
            } catch {
                throw new Error('Graphic Walker build artifacts are missing. Run yarn build before yarn test:consumer.');
            }

            await runYarn(['pack', '--filename', tarballPath], packageDir);
        }

        const consumerPackage = {
            name: 'graphic-walker-vite-consumer-smoke',
            version: '0.0.0',
            private: true,
            type: 'module',
            scripts: {
                build: 'vite build',
            },
            dependencies: {
                '@kanaries/graphic-walker': 'file:../graphic-walker.tgz',
                react: '19.2.0',
                'react-dom': '19.2.0',
            },
            devDependencies: {
                vite: '4.5.0',
            },
        };

        await fs.mkdir(sourceDir, { recursive: true });
        await Promise.all([
            fs.writeFile(path.join(consumerDir, 'package.json'), `${JSON.stringify(consumerPackage, null, 2)}\n`),
            fs.writeFile(
                path.join(consumerDir, 'index.html'),
                '<!doctype html><html><body><div id="app"></div><script type="module" src="/src/main.js"></script></body></html>\n'
            ),
            fs.writeFile(
                path.join(sourceDir, 'main.js'),
                [
                    "import * as graphicWalker from '@kanaries/graphic-walker';",
                    '',
                    "const exportCount = Object.keys(graphicWalker).length;",
                    "document.querySelector('#app').textContent = String(exportCount);",
                    "console.log('Graphic Walker export count:', exportCount);",
                    '',
                ].join('\n')
            ),
        ]);

        // Keep identically versioned before/after tarballs from reusing Yarn Classic's
        // global cache during the negative-control and fixed-package runs.
        await runYarn(['install', '--non-interactive', '--production=false', '--cache-folder', yarnCacheDir], consumerDir);

        const installedPackageDir = path.join(consumerDir, 'node_modules/@kanaries/graphic-walker');
        const installedConsumerManifest = JSON.parse(await fs.readFile(path.join(consumerDir, 'package.json'), 'utf8'));
        assert(!installedConsumerManifest.dependencies?.['styled-components'], 'Consumer fixture must not declare styled-components');
        assert(!installedConsumerManifest.devDependencies?.['styled-components'], 'Consumer fixture must not declare styled-components');
        await assertExternalized(installedPackageDir);
        await runYarn(['build'], consumerDir);

        const resolvedStyledEntry = require.resolve('styled-components', {
            paths: [installedPackageDir],
        });
        const [realConsumerDir, realResolvedStyledEntry] = await Promise.all([fs.realpath(consumerDir), fs.realpath(resolvedStyledEntry)]);

        assert(isPathInside(realConsumerDir, realResolvedStyledEntry), `styled-components resolved outside the consumer tree: ${realResolvedStyledEntry}`);
        assert(!isPathInside(realRepoRoot, realResolvedStyledEntry), `styled-components resolved from the repository hoist: ${realResolvedStyledEntry}`);

        const installedManifest = JSON.parse(await fs.readFile(path.join(installedPackageDir, 'package.json'), 'utf8'));
        assert.equal(
            installedManifest.dependencies?.['styled-components'],
            expectedStyledComponentsRange,
            'Packed package must preserve the source styled-components runtime dependency range'
        );
        assert(!installedManifest.peerDependencies?.['styled-components'], 'styled-components must not remain a peer dependency');

        console.log(`Resolved styled-components from ${realResolvedStyledEntry}.`);
        console.log('Graphic Walker Vite consumer smoke test passed.');
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (isDirectRun) {
    runConsumerSmokeTest({ tarballPath: process.argv[2] }).catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
