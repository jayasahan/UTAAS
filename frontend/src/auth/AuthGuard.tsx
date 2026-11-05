import type { ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from './session';
import type { StaffProfile } from './contracts';

function homeForRole(role: StaffProfile['role']): string {
  if (role === 'LECTURER') return '/';
  if (role === 'ADMIN') return '/admin';
  return '/officer';
}

export function AuthGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: readonly StaffProfile['role'][];
  children?: ReactNode;
}) {
  const session = useSession();
  const location = useLocation();

  if (session.status === 'signing-in' || session.status === 'signing-out')
    return (
      <main className="min-h-screen bg-canvas p-6 text-brand">
        <p
          role="status"
          className="mx-auto max-w-xl rounded-card border border-border bg-surface p-6"
        >
          {session.status === 'signing-in'
            ? 'Verifying your account…'
            : 'Signing out…'}
        </p>
      </main>
    );

  if (session.status !== 'authenticated' || !session.user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
          expired:
            session.status === 'expired' || session.status === 'unauthorized',
        }}
      />
    );
  }

  if (!allowedRoles.includes(session.user.role)) {
    const returnPath = homeForRole(session.user.role);
    return (
      <main className="min-h-screen bg-canvas px-5 py-12 text-brand sm:px-8">
        <section
          role="alert"
          className="mx-auto max-w-xl rounded-card border border-border bg-surface p-7 shadow-sm"
        >
          <h1 className="text-2xl font-bold">Access denied</h1>
          <p className="mt-3 text-sm text-ink">
            This account does not have access to this area.
          </p>
          <Link
            to={returnPath}
            className="mt-5 inline-flex rounded-control bg-action px-4 py-3 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            Go to your dashboard
          </Link>
        </section>
      </main>
    );
  }

  return children ?? <Outlet />;
}
