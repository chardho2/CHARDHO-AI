import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

export function RequireAuth({ children }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageLoader label="Checking your session" />;
  if (status === 'twofa') return <Navigate to="/login?step=2fa" replace />;
  if (status !== 'authenticated' || !user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return children;
}

/**
 * Portal isolation on the client is a convenience only — the server
 * re-checks every request. This prevents a user from ever *seeing* a
 * portal that is not theirs, but it is not the security boundary.
 */
export function RequirePortal({ portal, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'founder' && user.portal !== portal) {
    return <Forbidden expected={portal} actual={user.portal} />;
  }
  return children;
}

export function RequirePermission({ permission, children }) {
  const { can } = useAuth();
  if (!can(...(Array.isArray(permission) ? permission : [permission]))) return <Forbidden />;
  return children;
}

export function FullPageLoader({ label = 'Loading' }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-cyan/25 border-t-cyan" />
        <div className="absolute inset-2 animate-pulse rounded-full bg-violet/25 blur-md" />
      </div>
      <p className="text-sm text-mist">{label}…</p>
    </div>
  );
}

export function Forbidden({ expected, actual }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
        403 · Access denied
      </div>
      <h1 className="text-3xl font-semibold">This portal is not yours</h1>
      <p className="mt-3 text-mist">
        {expected
          ? `Your role is ${actual}, so you cannot open the ${expected} portal. Every portal is isolated and the server enforces this on each request.`
          : 'You do not have the permission required for this section.'}
      </p>
      <a href="/portal" className="mt-6 rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15">
        Go to my dashboard
      </a>
    </div>
  );
}
