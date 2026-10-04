import { describe, expect, it } from 'vitest';
import { envSchema } from './env.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
  APP_URL: 'http://localhost:5173',
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret',
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
};

describe('envSchema DEV_LOGIN', () => {
  it('is off by default', () => {
    expect(envSchema.parse(base).DEV_LOGIN).toBe(false);
  });

  it('can be enabled in development', () => {
    expect(envSchema.parse({ ...base, DEV_LOGIN: 'true' }).DEV_LOGIN).toBe(true);
  });

  it('refuses to start in production with DEV_LOGIN enabled', () => {
    expect(() => envSchema.parse({ ...base, NODE_ENV: 'production', DEV_LOGIN: 'true' })).toThrow(/never be enabled/);
  });
});
