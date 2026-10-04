// Removes a case checkout created by prepare.mjs and its branch.
//   node evals/scripts/cleanup.mjs <dir> <branch>
// The node_modules junctions are unlinked first so the real folders are never touched.

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, rmSync, unlinkSync } from 'node:fs';
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
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Any link left inside (none expected) would make a recursive delete dangerous.
function hasLinks(d) {
  return readdirSync(d, { withFileTypes: true }).some((e) => {
    const p = path.join(d, e.name);
    return lstatSync(p).isSymbolicLink() || (e.isDirectory() && hasLinks(p));
  });
}

// On Windows a process that just exited (prisma, vitest) can hold files for a moment.
let removed = false;
for (let attempt = 0; attempt < 5 && !removed; attempt++) {
  try {
    execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: root, stdio: 'pipe' });
    removed = true;
  } catch {
    sleep(1000);
  }
}
if (!removed && existsSync(dir)) {
  if (hasLinks(dir)) {
    console.error(`${dir} still contains links; not deleting it. Inspect it by hand.`);
    process.exit(1);
  }
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
execFileSync('git', ['worktree', 'prune'], { cwd: root });
execFileSync('git', ['branch', '-D', branch], { cwd: root, stdio: 'ignore' });
console.log(`removed ${dir}`);
