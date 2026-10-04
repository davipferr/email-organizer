// Prisma CLI config. There are NO migrations in this project:
// the schema is applied with `prisma db push` when the backend starts.
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Local dev reads the root .env; in Docker the variables come from compose.
config({ path: ['../.env', '.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
