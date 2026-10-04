// Waits until the frontend serves the app and proxies a healthy backend.
// Usage: node .claude/skills/verify/wait-for-app.mjs [timeoutSeconds=90] [slot=0]
// Slot n = frontend on 5173+100n (see scripts/dev.mjs).
// Exit 0 when ready; exit 1 with the last error after the timeout.

const timeoutMs = Number(process.argv[2] ?? 90) * 1000;
const base = `http://localhost:${5173 + 100 * Number(process.argv[3] ?? 0)}`;
const started = Date.now();
let last = '';

async function ok(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) last = `${url} → ${res.status}`;
    return res.ok;
  } catch (err) {
    last = `${url} → ${err.cause?.code ?? err.message}`;
    return false;
  }
}

let ready = false;
while (!ready && Date.now() - started < timeoutMs) {
  // Through the Vite proxy, so this checks frontend, backend and database at once.
  ready = (await ok(`${base}/`)) && (await ok(`${base}/api/health`));
  if (!ready) await new Promise((r) => setTimeout(r, 1000));
}

// exitCode instead of process.exit(): exiting while fetch handles close crashes Node on Windows.
if (ready) {
  console.log(`App ready after ${Math.round((Date.now() - started) / 1000)}s`);
} else {
  console.error(`App not ready after ${timeoutMs / 1000}s. Last error: ${last}`);
  console.error('Is PostgreSQL up (docker compose -f docker-compose.dev.yml up -d)? Check preview_logs for the backend.');
  process.exitCode = 1;
}
