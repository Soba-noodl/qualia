import { spawnSync } from 'node:child_process';

export interface GateCommand {
  cmd: string;
  args: string[];
}

export interface GateResult {
  ok: boolean;
  failedAt?: string;
  stderr?: string;
}

/**
 * Runs the autofix verifier gate. Each command is executed via spawnSync;
 * the first non-zero exit aborts and returns the failed command for diagnostics.
 *
 * The gate is intentionally synchronous — it runs between commit batches.
 */
export function runVerifierGate(commands: GateCommand[]): GateResult {
  for (const c of commands) {
    const r = spawnSync(c.cmd, c.args, { stdio: 'pipe', encoding: 'utf-8' });
    if (r.status !== 0) {
      return {
        ok: false,
        failedAt: `${c.cmd} ${c.args.join(' ')}`,
        stderr: (r.stderr ?? '') + (r.stdout ?? ''),
      };
    }
  }
  return { ok: true };
}

export const DEFAULT_GATE: GateCommand[] = [
  { cmd: 'npm', args: ['run', 'lint'] },
  { cmd: 'npm', args: ['run', 'build'] },
  { cmd: 'npx', args: ['tsc', '--noEmit'] },
  { cmd: 'npm', args: ['test', '--', '--run'] },
];
