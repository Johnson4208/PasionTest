import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const windows = process.platform === 'win32';
const python = path.join(root, '.venv', windows ? 'Scripts/python.exe' : 'bin/python');
if (!existsSync(python)) {
  console.error('Create the project environment first: python -m venv .venv');
  console.error(windows
    ? 'Then run: .\\.venv\\Scripts\\python.exe -m pip install -r backend/requirements-documents.txt'
    : 'Then run: .venv/bin/python -m pip install -r backend/requirements-documents.txt');
  process.exit(1);
}

const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (windows) {
      // The virtual-environment launcher has a Python child on Windows.
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {stdio: 'ignore', windowsHide: true});
    } else child.kill('SIGTERM');
  }
}
function launch(label, executable, args) {
  const child = spawn(executable, args, {
    cwd: root, stdio: 'inherit', windowsHide: true,
    env: {...process.env, PYTHONUNBUFFERED: '1', PYTHONUTF8: '1'},
  });
  children.push(child);
  child.once('error', error => { console.error(`${label}: ${error.message}`); stop(1); });
  child.once('exit', (code, signal) => {
    if (!stopping) {
      console.error(`${label} stopped${signal ? ` (${signal})` : ` (exit ${code})`}.`);
      stop(code || 1);
    }
  });
}

process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
launch('Backend', python, ['-X', 'utf8', 'backend/server.py']);
launch('Frontend', process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--strictPort']);
