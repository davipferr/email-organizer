// Stop hook: Claude can't finish a turn that changed code while `npm run check` fails —
// the failure is sent back and Claude keeps working. Skipped when no code changed, or
// when the exact same working tree already passed (cached in .claude/.cache/).
// Test: echo '{}' | node .claude/hooks/stop-check.mjs

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const cacheFile = path.join(root, '.claude', '.cache', 'last-check.json');
const CODE = /\.(ts|tsx|mts|mjs|js|json|prisma)$/;

let input = '';
for await (const chunk of process.stdin) input += chunk;
const { stop_hook_active: alreadyContinued } = JSON.parse(input || '{}');

const sh = (command) => spawnSync(command, { cwd: root, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// Changed or new files that are code (docs-only turns don't need the check).
const changed = sh('git status --porcelain --untracked-files=all')
  .stdout.split('\n')
  .map((l) => l.slice(3).trim().replace(/^"|"$/g, ''))
  .filter((f) => f && CODE.test(f.split(' -> ').pop()));
if (!changed.length) process.exit(0);

// Fingerprint of the working tree: tracked diff + untracked files' size/mtime.
const hash = createHash('sha1').update(sh('git diff HEAD').stdout);
for (const f of sh('git ls-files -o --exclude-standard').stdout.split('\n').filter(Boolean)) {
  try {
    const s = statSync(path.join(root, f));
    hash.update(`${f}:${s.size}:${s.mtimeMs}`);
  } catch {}
}
const fingerprint = hash.digest('hex');

try {
  if (JSON.parse(readFileSync(cacheFile, 'utf8')).passed === fingerprint) process.exit(0);
} catch {}

const check = sh('npm run check');
if (check.status === 0) {
  mkdirSync(path.dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, JSON.stringify({ passed: fingerprint }));
  process.exit(0);
}

const output = `${check.stdout}${check.stderr}`
  .split('\n')
  .filter((l) => /error|fail|✗|×|FAIL|AssertionError|expected/i.test(l))
  .slice(0, 40)
  .join('\n');

if (alreadyContinued) {
  // Already sent back once this turn: don't loop forever, tell the user instead.
  console.log(JSON.stringify({ systemMessage: `npm run check is still failing:\n${output}` }));
} else {
  console.log(
    JSON.stringify({
      decision: 'block',
      reason: `[project check] npm run check fails — fix it before finishing (or explain to the user why it can't pass):\n${output}`,
    }),
  );
}
