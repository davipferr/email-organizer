// Removes a case checkout created by prepare.mjs and its branch.
//   node evals/scripts/cleanup.mjs <dir> <branch>
// The node_modules junctions are unlinked first so the real folders are never touched.

import { execFileSync } from 'node:child_process';
import { existsSync, unlinkSync, lstatSync } from 'node:fs';
import path from 'node:path';

const [dir, branch] = process.argv.slice(2);
if (!dir || !branch || !/[\\/]\.claude[\\/]worktrees[\\/]wt-[0-9a-f]+$/.test(dir) || !/^wt-[0-9a-f]+$/.test(branch)) {
  console.error('Usage: node evals/scripts/cleanup.mjs <.claude/worktrees/wt-xxxx dir> <wt-xxxx branch>');
  process.exit(1);
}

for (const pkg of ['backend', 'frontend']) {
  const link = path.join(dir, pkg, 'node_modules');
  if (!existsSync(link)) continue;
  // A real folder here would mean deleting a copy we don't own — or worse, following a link
  // into the main checkout. Refuse instead of guessing.
  if (!lstatSync(link).isSymbolicLink()) {
    console.error(`${link} is not a link; not removing ${dir}. Inspect it by hand.`);
    process.exit(1);
  }
  unlinkSync(link);
}

const root = path.resolve(dir, '..', '..', '..');
execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: root });
execFileSync('git', ['branch', '-D', branch], { cwd: root, stdio: 'ignore' });
console.log(`removed ${dir}`);
