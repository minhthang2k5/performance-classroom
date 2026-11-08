import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const children = [
  spawn(process.execPath, ['--watch', 'server/src/index.mjs'], { cwd: root, stdio: 'inherit', env: process.env, windowsHide: true }),
  spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--config', 'frontend/vite.config.mjs'], { cwd: root, stdio: 'inherit', env: process.env, windowsHide: true })
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach(child => child.kill());
  process.exitCode = code;
}
children.forEach(child => {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => stop(code || 0));
});
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
