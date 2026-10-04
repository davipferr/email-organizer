// Run with: node --test ".claude/hooks/*.test.mjs"  (part of npm test)
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const guard = fileURLToPath(new URL('./guard-commands.mjs', import.meta.url));

function decide(command) {
  const r = spawnSync(process.execPath, [guard], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
  });
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecision : 'allow';
}

const cases = {
  deny: [
    'cat .env',
    'Get-Content ..\\.env',
    'echo X >> .env',
    'node --env-file=.env x.js',
    'npx prisma db push --accept-data-loss',
    'npx prisma db push --force-reset',
    'npx prisma migrate dev',
    'docker compose -f docker-compose.dev.yml down -v',
    'docker volume rm email-organization_pgdata-dev',
    'git push --force origin main',
    'git push -f',
    'git commit --no-verify -m x',
    'git -c core.hooksPath=/dev/null commit -m x',
  ],
  ask: ['git reset --hard HEAD~1', 'git clean -fd', 'git checkout -- src/main.ts'],
  allow: [
    'cat .env.example',
    'node -e "process.env.PORT"',
    'npm --prefix backend run db:push',
    'docker compose down',
    'git push origin main',
    'git status',
    'npm run check',
    'echo "use --no-verify only in emergencies" > notes.txt',
  ],
};

for (const [expected, commands] of Object.entries(cases)) {
  for (const command of commands) {
    test(`${expected}: ${command}`, () => assert.equal(decide(command), expected));
  }
}
