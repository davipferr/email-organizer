// Reads the errors thrown by googleapis (gaxios). Google's error body is only available
// at response.data.error: { code, message, status, errors: [{ reason, message }] }.

type GoogleError = {
  status?: number;
  code?: number | string;
  message?: string;
  response?: { status?: number; data?: unknown };
};

type ErrorBody = { message?: string; status?: string; errors?: { reason?: string; message?: string }[] };

const RATE_LIMIT_REASONS = ['rateLimitExceeded', 'userRateLimitExceeded'];

function body(err: unknown): ErrorBody | undefined {
  const data = (err as GoogleError).response?.data as { error?: unknown } | undefined;
  return typeof data?.error === 'object' && data.error !== null ? (data.error as ErrorBody) : undefined;
}

export function errorStatus(err: unknown): number | undefined {
  const e = err as GoogleError;
  return e.response?.status ?? e.status ?? (typeof e.code === 'number' ? e.code : undefined);
}

// OAuth errors (e.g. invalid_grant) come as { error: 'invalid_grant' }.
export function errorCode(err: unknown): string | undefined {
  const data = (err as GoogleError).response?.data as { error?: unknown } | undefined;
  return typeof data?.error === 'string' ? data.error : undefined;
}

export function errorMessage(err: unknown): string | undefined {
  const b = body(err);
  return b?.errors?.[0]?.message ?? b?.message ?? (err as GoogleError).message;
}

// Gmail signals per-user quota with 429, or 403 + a rate-limit reason.
export function isRateLimit(err: unknown): boolean {
  const status = errorStatus(err);
  if (status === 429) return true;
  if (status !== 403) return false;
  const b = body(err);
  return b?.status === 'RESOURCE_EXHAUSTED' || (b?.errors ?? []).some((x) => RATE_LIMIT_REASONS.includes(x.reason ?? ''));
}

export function isRetryable(err: unknown): boolean {
  const status = errorStatus(err);
  return isRateLimit(err) || status === 500 || status === 502 || status === 503;
}
