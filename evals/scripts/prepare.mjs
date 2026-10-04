// Creates an isolated checkout for one eval case and prints {dir, base} as JSON.
//   node evals/scripts/prepare.mjs <case-id>
// - git worktree of HEAD under .claude/worktrees/<random> (neutral name: the agent must not
//   know it's being evaluated — agents behave differently when they do)
// - evals/ is left out (sparse checkout), so the rubric and expected answers aren't readable
// - node_modules linked from the main checkout, Prisma client copied
// - the case's setup.patch (a planted bug) is applied and committed with an ordinary message,
//   so `git status`/`git diff` look clean, like a bug that shipped earlier

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, symlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const caseId = process.argv[2];
const caseDir = path.join(root, 'evals', 'cases', caseId ?? '');
if (!caseId || !existsSync(path.join(caseDir, 'case.md'))) {
  console.error(`Unknown case "${caseId}". Cases live in evals/cases/<id>/case.md`);
  process.exit(1);
}

const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const id = randomBytes(4).toString('hex');
const dir = path.join(root, '.claude', 'worktrees', `wt-${id}`);
const branch = `wt-${id}`;

git(['worktree', 'add', '--no-checkout', '-b', branch, dir, 'HEAD']);
git(['sparse-checkout', 'set', '--no-cone', '/*', '!/evals/'], dir);
git(['checkout', branch], dir);

for (const pkg of ['backend', 'frontend']) {
  symlinkSync(path.join(root, pkg, 'node_modules'), path.join(dir, pkg, 'node_modules'), 'junction');
}
cpSync(path.join(root, 'backend', 'src', 'generated'), path.join(dir, 'backend', 'src', 'generated'), { recursive: true });

const patch = path.join(caseDir, 'setup.patch');
if (existsSync(patch)) {
  try {
    git(['apply', '--whitespace=nowarn', patch], dir);
  } catch (err) {
    console.error(`setup.patch for ${caseId} no longer applies to HEAD — update the case.\n${err.stderr ?? err.message}`);
    process.exit(1);
  }
  const message = readFileSync(path.join(caseDir, 'case.md'), 'utf8').match(/^setup_commit:\s*(.+)$/m)?.[1] ?? 'Tidy up';
  git(['-c', 'core.hooksPath=/dev/null', 'commit', '-qam', message], dir);
}

console.log(JSON.stringify({ dir, base: git(['rev-parse', 'HEAD'], dir), branch }));
