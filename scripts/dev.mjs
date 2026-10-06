// Starts the backend or the frontend for one "slot", so several checkouts (worktrees) can run
// the app at the same time without clashing.
//   node scripts/dev.mjs <backend|frontend> [slot=0]
//
// slot 0: backend :3000, frontend :5173, database from .env as is (the normal setup)
// slot n: backend :3000+100n, frontend :5173+100n, database <name>_slot<n> (created and
//         schema-pushed on start), so fake accounts and job queues never mix between slots.
//
// In a worktree the .env of the main checkout is used (ENV_FILE) — it is never copied.

import { spawnSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [app, slotArg = '0'] = process.argv.slice(2);
const slot = Number(slotArg);
if (!['backend', 'frontend'].includes(app) || !Number.isInteger(slot) || slot < 0 || slot > 9) {
  console.error('Usage: node scripts/dev.mjs <backend|frontend> [slot 0-9]');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cwd = path.join(root, app);

// The main checkout owns .env; a worktree shares the same .git directory.
const commonGitDir = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).stdout.trim();
const mainRoot = path.dirname(commonGitDir);
const envFile = path.join(mainRoot, '.env');

if (!existsSync(path.join(cwd, 'node_modules'))) {
  console.error(`${app}/node_modules is missing in this checkout. Run: npm --prefix ${app} install`);
  process.exit(1);
}

const env = {
  ...process.env,
  ENV_FILE: envFile,
  PORT: String(3000 + 100 * slot),
  API_PORT: String(3000 + 100 * slot),
  VITE_PORT: String(5173 + 100 * slot),
  ...(slot > 0 ? { DB_SUFFIX: `_slot${slot}` } : {}),
};

const run = (command) => {
  const r = spawnSync(command, { cwd, env, shell: true, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (app === 'backend') {
  if (!existsSync(path.join(cwd, 'src', 'generated'))) run('npx prisma generate');
  // Creates the slot's database if needed and applies the schema (never with data loss).
  if (slot > 0) run('npx prisma db push');
}

console.log(`[slot ${slot}] ${app} on :${app === 'backend' ? env.PORT : env.VITE_PORT}${env.DB_SUFFIX ? `, database suffix ${env.DB_SUFFIX}` : ''}`);
const child = spawn(app === 'backend' ? 'npm run start:dev' : 'npx vite', { cwd, env, shell: true, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
