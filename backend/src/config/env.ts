import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.url(),
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
}).refine((env) => !(env.DEV_LOGIN && env.NODE_ENV === 'production'), {
  message: 'DEV_LOGIN must never be enabled in production',
  path: ['DEV_LOGIN'],
});

export type Env = z.infer<typeof envSchema>;
