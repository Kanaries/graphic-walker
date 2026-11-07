import os from 'node:os';
import { execFileSync } from 'node:child_process';
export function machineMetadata() {
    const git = (args) => { try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return 'unavailable'; } };
    return {
        timestamp: new Date().toISOString(), node: process.version, v8: process.versions.v8,
        platform: os.platform(), release: os.release(), architecture: os.arch(),
        cpuModel: os.cpus()[0]?.model, logicalCPUs: os.cpus().length, totalMemoryBytes: os.totalmem(),
        gitCommit: git(['rev-parse', 'HEAD']), gitDirty: git(['status', '--porcelain']).length > 0,
    };
}
