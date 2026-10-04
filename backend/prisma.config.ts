// Prisma CLI config. There are NO migrations in this project:
// the schema is applied with `prisma db push` when the backend starts.
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { withDbSuffix } from './src/config/database-url.js';

// Local dev reads the root .env (ENV_FILE points a worktree at the main checkout's);
// in Docker the variables come from compose.
config({ path: [process.env['ENV_FILE'], '../.env', '.env'].filter((p): p is string => !!p), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env['DATABASE_URL'] && withDbSuffix(process.env['DATABASE_URL']),
  },
});
