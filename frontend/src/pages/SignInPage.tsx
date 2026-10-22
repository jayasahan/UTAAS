import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/FormControls';
import { useSession } from '../auth/session';
import type { StaffProfile } from '../auth/contracts';
import { officerQueueRoles } from '../features/officer-queue/contracts';
import { ApiError } from '../services/apiClient';

function roleHome(role: StaffProfile['role']): string {
  return role === 'LECTURER' ? '/' : '/officer';
}

function intendedPath(
  value: unknown,
  role: StaffProfile['role'],
): string | null {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  )
    return null;
  const path = value.split(/[?#]/, 1)[0] ?? '';
  if (role === 'LECTURER')
    return path === '/' || path === '/requests' || path.startsWith('/requests/')
      ? value
      : null;
  return officerQueueRoles.includes(role) &&
    (path === '/officer' || path.startsWith('/officer/'))
    ? value
    : null;
}

function failureMessage(error: unknown): string {
  if (!(error instanceof ApiError))
    return 'Sign-in could not be completed. Try again later.';
  if (error.kind === 'unauthorized')
    return 'Sign-in failed. Check your email and password or contact your administrator.';
  if (error.kind === 'network')
    return 'The authentication service could not be reached. Check your connection and try again.';
  if (error.kind === 'unavailable')
    return 'Sign-in is unavailable because the API is not configured for this environment.';
  if (error.kind === 'invalid-response')
    return 'The authentication service returned an unexpected response. Try again later.';
  return 'Sign-in could not be completed. Try again later.';
}

export function SignInPage() {
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (session.status === 'authenticated' && session.user && !submitting)
    return <Navigate to={roleHome(session.user.role)} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const cleanEmail = email.trim();
    const nextEmailError = !cleanEmail
      ? 'Enter your email address.'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
        ? 'Enter a valid email address.'
        : '';
    const nextPasswordError = password ? '' : 'Enter your password.';
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError) {
      document.getElementById('login-email')?.focus();
      return;
    }
    if (nextPasswordError) {
      document.getElementById('login-password')?.focus();
      return;
    }
    if (!session.login) {
      setFormError('Sign-in is unavailable in this environment.');
      return;
    }

    setSubmitting(true);
    try {
      const profile = await session.login(cleanEmail, password);
      setPassword('');
      const state = location.state as { from?: unknown } | null;
      navigate(
        intendedPath(state?.from, profile.role) ?? roleHome(profile.role),
        {
          replace: true,
        },
      );
    } catch (error) {
      setPassword('');
      setFormError(failureMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  const expired = Boolean(
    (location.state as { expired?: boolean } | null)?.expired,
  );
  const signOutMessage =
    session.status === 'signed-out' && /signed out/i.test(session.message)
      ? session.message
      : '';

  return (
    <main className="min-h-screen bg-canvas text-brand lg:grid lg:grid-cols-[45.14%_1fr]">
      <section className="flex min-h-[250px] flex-col justify-center bg-brand px-7 py-10 text-white sm:px-12 lg:min-h-screen lg:justify-start lg:px-[clamp(3rem,5vw,5rem)] lg:pt-[7.4375rem]">
        <p className="text-sm font-bold tracking-wide text-slate-200">
          UNIVERSITY OF RUHUNA
        </p>
        <div className="mt-12 lg:mt-[6.125rem]">
          <p className="text-5xl font-bold tracking-wide sm:text-6xl lg:text-[4.25rem]">
            UTAAS
          </p>
          <p className="mt-4 text-lg sm:text-xl">
            Faculty administration, simplified.
          </p>
          <p className="mt-8 text-sm text-slate-200">
            Submit <span aria-hidden="true">•</span> Review{' '}
            <span aria-hidden="true">•</span> Approve{' '}
            <span aria-hidden="true">•</span> Audit
          </p>
        </div>
      </section>

      <section className="flex min-h-[calc(100vh-250px)] items-center justify-center px-5 py-10 sm:px-8 lg:min-h-screen lg:px-10">
        <div className="w-full max-w-[34.375rem] rounded-card bg-surface p-6 shadow-sm sm:p-10">
          <h1 className="text-3xl font-bold text-brand">Welcome back</h1>
          <p className="mt-3 text-sm text-muted">
            Sign in with your authorized faculty account.
          </p>
          {expired && (
            <p
              role="status"
              className="mt-5 rounded-control bg-warning-subtle p-3 text-sm text-warning-ink"
            >
              Your session expired. Sign in again to continue.
            </p>
          )}
          {signOutMessage && (
            <p
              role="status"
              className="mt-5 rounded-control bg-info-subtle p-3 text-sm text-info-ink"
            >
              {signOutMessage}
            </p>
          )}
          {session.status === 'unavailable' && session.message && (
            <p
              role="status"
              className="mt-5 rounded-control bg-warning-subtle p-3 text-sm text-warning-ink"
            >
              {session.message}
            </p>
          )}
          <form
            className="mt-8 space-y-6"
            onSubmit={(event) => void handleSubmit(event)}
            noValidate
          >
            <Input
              id="login-email"
              label="Email address"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailError('');
                setFormError('');
              }}
              error={emailError}
              placeholder="name@university.edu"
            />
            <div className="relative">
              <Input
                id="login-password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setPasswordError('');
                  setFormError('');
                }}
                error={passwordError}
                className="pr-20"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-2 top-[2.1rem] rounded px-2 py-2 text-xs font-semibold text-action hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {formError && (
              <p
                role="alert"
                className="rounded-control border border-danger/20 bg-red-50 p-3 text-sm font-semibold text-danger"
              >
                {formError}
              </p>
            )}
            <Button
              type="submit"
              pending={submitting || session.status === 'signing-in'}
              className="w-full"
            >
              Sign in
            </Button>
          </form>
          <p className="mt-8 text-xs leading-5 text-muted">
            Access is limited to accounts provisioned by the University of
            Ruhuna. Contact your administrator if you cannot sign in.
          </p>
        </div>
      </section>
    </main>
  );
}
