// Collects what the agent did in a case checkout, for the judge. Prints JSON.
//   node evals/scripts/collect.mjs <dir> <base-commit>
// diff: everything changed since <base> (committed or not, new files included)
// check: result of `npm run check` inside the checkout

import { execFileSync, spawnSync } from 'node:child_process';

const [dir, base] = process.argv.slice(2);
if (!dir || !base) {
  console.error('Usage: node evals/scripts/collect.mjs <dir> <base-commit>');
  process.exit(1);
}

const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

git('add', '-A', '--intent-to-add');
const stat = git('diff', base, '--stat');
const diff = git('diff', base, '--', '.', ':(exclude)**/package-lock.json');

const check = spawnSync('npm run check', { cwd: dir, shell: true, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const out = `${check.stdout}${check.stderr}`;
const failures = out.split('\n').filter((l) => /error|fail|✖|FAIL/i.test(l) && !/^\s*ℹ fail 0/.test(l));

const MAX = 40_000;
console.log(
  JSON.stringify(
    {
      changedFiles: stat.trim() || '(no changes)',
      diff: diff.length > MAX ? `${diff.slice(0, MAX)}\n… (diff truncated, ${diff.length} chars)` : diff,
      check: { ok: check.status === 0, failures: failures.slice(0, 30) },
    },
    null,
    2,
  ),
);
