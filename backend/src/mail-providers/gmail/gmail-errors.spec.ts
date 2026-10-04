import { describe, expect, it } from 'vitest';
import { errorCode, errorMessage, errorStatus, isRateLimit, isRetryable } from './gmail-errors.js';

// The shape gaxios 7 throws: `status` and `response` only — Google's error body stays in
// response.data.error, nothing is copied to `err.errors`.
function gaxiosError(status: number, body: unknown) {
  return Object.assign(new Error('request failed'), { status, response: { status, data: body } });
}

const quotaMessage =
  "Quota exceeded for quota metric 'Total Query Cost' and limit 'Units per minute per user' of service 'gmail.googleapis.com'";

describe('gmail errors', () => {
  it.each([
    ['403 rateLimitExceeded', 403, 'rateLimitExceeded', 'PERMISSION_DENIED'],
    ['403 userRateLimitExceeded', 403, 'userRateLimitExceeded', 'PERMISSION_DENIED'],
    ['429 RESOURCE_EXHAUSTED', 429, 'rateLimitExceeded', 'RESOURCE_EXHAUSTED'],
  ])('%s is a retryable rate limit', (_, status, reason, apiStatus) => {
    const err = gaxiosError(status, {
      error: { code: status, message: quotaMessage, status: apiStatus, errors: [{ reason, message: quotaMessage }] },
    });
    expect(isRateLimit(err)).toBe(true);
    expect(isRetryable(err)).toBe(true);
    expect(errorMessage(err)).toBe(quotaMessage);
  });

  it('does not retry other 403s', () => {
    const err = gaxiosError(403, {
      error: { code: 403, message: 'Insufficient Permission', errors: [{ reason: 'insufficientPermissions' }] },
    });
    expect(isRateLimit(err)).toBe(false);
    expect(isRetryable(err)).toBe(false);
  });

  it('retries server errors without treating them as rate limits', () => {
    const err = gaxiosError(503, 'Service Unavailable');
    expect(isRetryable(err)).toBe(true);
    expect(isRateLimit(err)).toBe(false);
  });

  it('reads the status and the OAuth error code', () => {
    const err = gaxiosError(400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' });
    expect(errorStatus(err)).toBe(400);
    expect(errorCode(err)).toBe('invalid_grant');
  });
});
