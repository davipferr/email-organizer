// PreToolUse hook for Bash/PowerShell: blocks commands that break this project's
// non-negotiables (see CLAUDE.md). Deny = the command never runs and Claude is told why;
// ask = the user gets a confirmation prompt even in auto/accept modes.
// Test: echo '{"tool_name":"Bash","tool_input":{"command":"cat .env"}}' | node .claude/hooks/guard-commands.mjs

const RULES = [
  {
    decision: 'deny',
    test: /(^|[\s'"`=/\\(<>|;&])\.env(?![\w.-])/,
    reason: 'The .env file holds secrets: never read or edit it. Use .env.example for variable names, and ask the user to change .env.',
  },
  {
    decision: 'deny',
    test: /prisma\s+db\s+push\b.*(--accept-data-loss|--force-reset)/,
    reason: '`db push` refused because the change would lose data. Do not force it: stop and explain the schema change to the user (no migrations in this project).',
  },
  {
    decision: 'deny',
    test: /prisma\s+migrate\b/,
    reason: 'This project has no migrations. Edit prisma/schema.prisma and run `npm --prefix backend run db:push`.',
  },
  {
    decision: 'deny',
    test: /docker(-compose|\s+compose)\b.*\bdown\b.*(\s-v\b|--volumes)|docker\s+(volume\s+(rm|prune)|system\s+prune)/,
    reason: 'This would delete the database volume. Ask the user to do it themselves if they really want to.',
  },
  {
    decision: 'deny',
    test: /git\s+push\b.*(\s-f\b|--force)/,
    reason: 'Force-pushing rewrites shared history. Ask the user.',
  },
  {
    decision: 'deny',
    test: /git\s+(commit|push|merge|rebase|cherry-pick)\b[^\n]*--no-verify\b|git\s+-c\s+core\.hooksPath=/,
    reason: 'Skipping git hooks bypasses the pre-commit check. Fix what the hook reports instead.',
  },
  {
    decision: 'ask',
    test: /git\s+(reset\s+--hard|clean\s+-[a-z]*f|checkout\s+--\s|restore\s)/,
    reason: 'This discards uncommitted work.',
  },
];

let input = '';
for await (const chunk of process.stdin) input += chunk;

const command = JSON.parse(input || '{}').tool_input?.command ?? '';
const hit = RULES.find((r) => r.test.test(command));

if (hit) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: hit.decision,
        permissionDecisionReason: `[project guard] ${hit.reason}`,
      },
    }),
  );
}
