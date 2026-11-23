/**
 * Client-side error reporting.
 *
 * Anything that throws in the browser is forwarded to POST /api/client-errors so
 * it lands in the server log and the developer portal's error monitor. Without
 * this a crash is invisible unless somebody happens to have devtools open.
 *
 * Reporting must never make things worse: every step is wrapped, payloads are
 * clipped, and each distinct error is sent at most once per page load.
 */
const seen = new Set();
const MAX_UNIQUE = 15;

const clip = (value, max) => String(value ?? '').slice(0, max);

export function reportClientError({ kind = 'error', message, stack, componentStack } = {}) {
  try {
    const text = clip(message || 'Unknown client error', 500);
    const key = `${kind}:${text}`;
    if (seen.has(key) || seen.size >= MAX_UNIQUE) return;
    seen.add(key);

    const payload = JSON.stringify({
      kind: clip(kind, 20),
      message: text,
      stack: clip(stack, 2000),
      componentStack: clip(componentStack, 2000),
      route: clip(window.location?.pathname || '', 200),
      userAgent: clip(navigator.userAgent, 200),
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/client-errors', new Blob([payload], { type: 'application/json' }));
      return;
    }
    fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      credentials: 'same-origin',
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* telemetry is best-effort by design */
  }
}

/** Catches the failures React error boundaries cannot see: async throws and promise rejections. */
export function installGlobalErrorReporting() {
  if (typeof window === 'undefined' || window.__chardhoErrorReporting) return;
  window.__chardhoErrorReporting = true;

  window.addEventListener('error', (event) => {
    // Resource load failures (img/script) surface without an Error object.
    if (event.error) {
      reportClientError({ kind: 'window', message: event.message, stack: event.error.stack });
    } else if (event.target && event.target !== window) {
      reportClientError({ kind: 'resource', message: `Failed to load ${event.target.src || event.target.href || 'resource'}` });
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    reportClientError({
      kind: 'promise',
      message: reason?.message || (typeof reason === 'string' ? reason : 'Unhandled promise rejection'),
      stack: reason?.stack,
    });
  });
}
