import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('====================================================');
console.log(' Starting Nexus Finance Full-Stack Environment');
console.log('====================================================');

const isWin = process.platform === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

// 1. Launch Backend Server (Port 3001)
const serverProc = spawn(npxCmd, ['tsx', 'server/index.ts'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true,
});

// 2. Launch Vite Dev Server (Port 5173 with proxy to 3001)
const viteProc = spawn(npxCmd, ['vite'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true,
});

function cleanup() {
  console.log('\nShutting down full-stack processes...');
  serverProc.kill();
  viteProc.kill();
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
