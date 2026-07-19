#!/usr/bin/env node
// Spawns the Stay22 API server and the vite dev server together, forwards
// their output, and tears both down together on exit/Ctrl-C.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const children = [];
let shuttingDown = false;

function run(name, command, args) {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
  child.on('exit', (code, signal) => {
    console.log(`[dev:all] ${name} exited (code=${code}, signal=${signal ?? 'none'})`);
    shutdown(code ?? 0);
  });
  child.on('error', (err) => {
    console.error(`[dev:all] ${name} failed to start:`, err);
    shutdown(1);
  });
  return child;
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child && !child.killed) child.kill('SIGTERM');
  }
  process.exitCode = code || 0;
  setTimeout(() => process.exit(process.exitCode), 300);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

children.push(run('server', process.execPath, [path.join(root, 'server', 'index.mjs')]));
children.push(run('vite', process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')]));
