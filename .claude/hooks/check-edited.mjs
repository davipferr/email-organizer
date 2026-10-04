// PostToolUse hook for Edit/Write: lints the edited file and typechecks its package, then
// feeds problems back to Claude right away (non-blocking — mid-change errors are normal).
// Only errors in the edited file are listed; errors elsewhere are just counted.
// Test: echo '{"tool_input":{"file_path":"frontend/src/main.tsx"}}' | node .claude/hooks/check-edited.mjs

import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

let input = '';
for await (const chunk of process.stdin) input += chunk;
const filePath = JSON.parse(input || '{}').tool_input?.file_path;
if (!filePath) process.exit(0);

const rel = path.relative(root, path.resolve(root, filePath)).split(path.sep).join('/');
const match = rel.match(/^(backend|frontend)\/src\/.+\.(ts|tsx)$/);
if (!match || rel.includes('/generated/')) process.exit(0);

const pkg = match[1];
const cwd = path.join(root, pkg);
const fileInPkg = rel.slice(pkg.length + 1);

// One command string (not cmd + args) because shell: true is needed for npx on Windows.
const run = (command) => {
  const r = spawnSync(command, { cwd, shell: true, encoding: 'utf8', timeout: 60_000 });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};

const problems = [];

const lint = run(`npx --no-install oxlint --deny-warnings "${fileInPkg}"`);
if (!lint.ok) {
  const lines = lint.out.split('\n').filter((l) => /(error|warning) /.test(l));
  problems.push(`Lint (${pkg}/${fileInPkg}):\n${lines.slice(0, 15).join('\n')}`);
}

const tsc = run(`npx --no-install tsc ${pkg === 'frontend' ? '-b' : '--noEmit'} --pretty false`);
if (!tsc.ok) {
  const errors = tsc.out.split('\n').filter((l) => /error TS\d+/.test(l));
  const here = errors.filter((l) => l.replace(/\\/g, '/').includes(fileInPkg));
  const elsewhere = errors.length - here.length;
  if (here.length || elsewhere) {
    problems.push(
      `Typecheck (${pkg}): ${here.length} error(s) in this file${elsewhere ? `, ${elsewhere} elsewhere in ${pkg}` : ''}` +
        (here.length ? `:\n${here.slice(0, 15).join('\n')}` : ''),
    );
  }
}

if (problems.length) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `[project check after editing ${rel}] Fix these before finishing (expected only if the change is mid-way):\n\n${problems.join('\n\n')}`,
      },
    }),
  );
}
