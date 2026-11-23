/**
 * Runs the API and the Vite dev server together.
 * Vite proxies /api to the API so the browser only ever talks to one origin.
 */
import { spawn } from 'node:child_process';

const procs = [];
function run(name, command, args, extraEnv = {}) {
  const child = spawn(command, args, { stdio: 'pipe', env: { ...process.env, ...extraEnv }, shell: false });
  child.stdout.on('data', (d) => process.stdout.write(`[${name}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[${name}] ${d}`));
  child.on('exit', (code) => {
    process.stdout.write(`[${name}] exited (${code})\n`);
    shutdown(code ?? 0);
  });
  procs.push(child);
  return child;
}

function shutdown(code) {
  for (const p of procs) { try { p.kill('SIGTERM'); } catch {} }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run('api', process.execPath, ['--disable-warning=ExperimentalWarning', '--env-file-if-exists=.env', 'server/index.js']);
run('web', process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0']);
