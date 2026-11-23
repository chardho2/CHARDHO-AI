/**
 * Root error boundary.
 *
 * A render error used to blank the whole page. Now the user gets a branded
 * recovery card, and the failure is reported to the server so it can actually be
 * fixed instead of being retyped from a screenshot.
 */
import { Component } from 'react';
import { reportClientError } from '../lib/errors.js';

export default class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    reportClientError({
      kind: 'render',
      message: error?.message,
      stack: error?.stack,
      componentStack: info?.componentStack,
    });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="grid min-h-screen place-items-center bg-[#05060f] px-6 text-slate-200">
        <div className="glass w-full max-w-lg rounded-2xl border border-white/10 p-8 text-center">
          <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20 ring-1 ring-white/10">
            <span className="text-xl">!</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white">This screen hit an error</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            The problem has been logged automatically. Reloading usually clears it — nothing you
            entered has been lost from the server.
          </p>
          <pre className="mt-4 max-h-24 overflow-auto rounded-lg bg-black/40 p-3 text-left text-[11px] leading-relaxed text-rose-300/90">
            {String(error?.message || error)}
          </pre>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110"
            >
              Reload the page
            </button>
            <a
              href="/"
              className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/5"
            >
              Back to home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
