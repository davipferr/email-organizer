// Parallel dev instances (scripts/dev.mjs slots) each get their own database in the same
// PostgreSQL, e.g. mail_organizer_slot1, so their fake accounts and pg-boss queues never mix.
// Used by both the app (env.ts) and the Prisma CLI (prisma.config.ts).
export function withDbSuffix(url: string, suffix = process.env['DB_SUFFIX']): string {
  if (!suffix) return url;
  if (!/^_[a-z0-9_]+$/.test(suffix)) throw new Error(`Invalid DB_SUFFIX "${suffix}"`);
  const parsed = new URL(url);
  parsed.pathname = `${parsed.pathname}${suffix}`;
  return parsed.toString();
}
