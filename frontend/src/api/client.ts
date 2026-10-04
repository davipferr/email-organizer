// Thin fetch wrapper for the backend. The session lives in an httpOnly cookie,
// so the browser never sees the Google tokens.

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(`API error ${status}`)
    this.status = status
    this.body = body
  }
}

// Readable message for notifications.
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const msg = (err.body as { message?: unknown } | undefined)?.message
    if (typeof msg === 'string') return msg
  }
  return 'Something went wrong. Try again.'
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })

  if (res.status === 401 && window.location.pathname !== '/login') {
    window.location.assign('/login')
  }

  const body = res.status === 204 ? undefined : await res.json().catch(() => undefined)
  if (!res.ok) throw new ApiError(res.status, body)
  return body as T
}

export const apiGet = <T>(path: string) => api<T>(path)
export const apiPost = <T>(path: string, data?: unknown) =>
  api<T>(path, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) })
export const apiPatch = <T>(path: string, data: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(data) })
export const apiDelete = <T>(path: string) => api<T>(path, { method: 'DELETE' })
