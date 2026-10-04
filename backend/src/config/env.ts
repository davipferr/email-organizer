import { z } from 'zod';
import { withDbSuffix } from './database-url.js';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  // A DB_SUFFIX (set by scripts/dev.mjs for parallel instances) is appended to the name.
  DATABASE_URL: z.url().transform((url) => withDbSuffix(url)),
  // Public URL of the site, e.g. http://localhost:5173 or https://mail.example.com
  APP_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  // 32 bytes, base64-encoded — encrypts the provider tokens stored in the database
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'must be 32 bytes, base64-encoded'),
  SESSION_TTL_DAYS: z.coerce.number().default(30),
  // Local development only: enables /api/auth/dev-login with a fake in-memory mailbox, so the
  // app can be tested (by you or an agent) without a Google account or real email.
  DEV_LOGIN: z.stringbool().default(false),
})
  .refine((env) => !(env.DEV_LOGIN && env.NODE_ENV === 'production'), {
    message: 'DEV_LOGIN must never be enabled in production',
    path: ['DEV_LOGIN'],
  })
  .refine((env) => !(process.env['DB_SUFFIX'] && env.NODE_ENV === 'production'), {
    message: 'DB_SUFFIX is for local parallel instances only',
    path: ['DATABASE_URL'],
  });

export type Env = z.infer<typeof envSchema>;
