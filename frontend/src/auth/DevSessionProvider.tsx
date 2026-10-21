import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../components/common/Button';
import {
  apiBaseUrl,
  ApiError,
  createApiClient,
  requestJson,
} from '../services/apiClient';
import { decodeProfile, record, text } from './contracts';
import type { StaffProfile } from './contracts';
import { SessionContext } from './session';
import type { Session, SessionStatus } from './session';

// Imported only from the DEV branch in main.tsx. Never production authentication.
export default function DevSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const token = useRef<string | null>(null);
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [session, setSession] = useState<Session>({
    status: 'signed-out',
    message:
      'Sign in with a backend development persona to load verified role and identity.',
    client: null,
    version: 0,
  });
  function clear(status: SessionStatus, message: string) {
    generation.current++;
    token.current = null;
    pending.current?.abort();
    clearTimeout(timer.current);
    setSession({ status, message, client: null, version: generation.current });
  }
  useEffect(
    () => () => {
      generation.current++;
      token.current = null;
      pending.current?.abort();
      clearTimeout(timer.current);
    },
    [],
  );
  const [selectedRole, setSelectedRole] =
    useState<StaffProfile['role']>('LECTURER');
  const roleLabels: Record<StaffProfile['role'], string> = {
    LECTURER: 'Lecturer',
    HOD: 'Head of Department',
    DEAN: 'Dean',
    EXAMINATION_OFFICER: 'Examination Officer',
    FINANCIAL_OFFICER: 'Financial Officer',
    ASSISTANT_BURSAR: 'Assistant Bursar',
    ADMIN: 'Administrator',
  };
  const roleButtonLabels: Record<StaffProfile['role'], string> = {
    LECTURER: 'lecturer',
    HOD: 'HOD',
    DEAN: 'Dean',
    EXAMINATION_OFFICER: 'Examination Officer',
    FINANCIAL_OFFICER: 'Financial Officer',
    ASSISTANT_BURSAR: 'Assistant Bursar',
    ADMIN: 'Administrator',
  };
  async function signIn(role: StaffProfile['role']) {
    if (!import.meta.env.DEV) return;
    clear('signing-in', 'Signing in to the development backend…');
    const attempt = generation.current;
    const controller = new AbortController();
    pending.current = controller;
    try {
      const login = await requestJson(
        apiBaseUrl(),
        `/auth/mock-login/${role}`,
        (value) => {
          const data = record(value);
          const profile = decodeProfile(data.user);
          if (profile.role !== role) throw new Error('Invalid role response');
          const accessToken = text(data.accessToken);
          const parts = accessToken.split('.');
          if (parts.length !== 3) throw new Error('Invalid session');
          const payload = record(
            JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'))),
          );
          if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp))
            throw new Error('Invalid expiry');
          return { accessToken, expiresAt: payload.exp * 1000 };
        },
        { method: 'POST', signal: controller.signal },
      );
      if (controller.signal.aborted || attempt !== generation.current) return;
      if (login.expiresAt <= Date.now()) {
        clear('expired', 'The development session has expired. Sign in again.');
        return;
      }
      token.current = login.accessToken;
      const expire = () => {
        if (attempt !== generation.current) return;
        const remaining = login.expiresAt - Date.now();
        if (remaining <= 0)
          clear(
            'expired',
            'The development session has expired. Sign in again.',
          );
        else
          timer.current = setTimeout(expire, Math.min(remaining, 2147483647));
      };
      expire();
      const client = createApiClient(
        apiBaseUrl(),
        () => token.current,
        () => {
          if (attempt === generation.current)
            clear(
              'unauthorized',
              'The development session is unauthorized or no longer valid. Sign in again.',
            );
        },
      );
      setSession({
        status: 'authenticated',
        message: `Development ${roleLabels[role]} session active. Authorization is checked from the profile and by the backend.`,
        client,
        version: attempt,
      });
    } catch (error) {
      if (controller.signal.aborted || attempt !== generation.current) return;
      const failure =
        error instanceof ApiError ? error : new ApiError('invalid-response');
      clear(
        failure.kind === 'unauthorized'
          ? 'unauthorized'
          : failure.kind === 'unavailable'
            ? 'unavailable'
            : 'error',
        failure.message,
      );
    }
  }
  return (
    <SessionContext.Provider value={session}>
      <aside
        aria-label="Development authentication"
        className="border-b border-border bg-blue-50 p-4 text-brand"
      >
        <p className="font-bold">Development-only sign-in</p>
        <p role="status" className="my-2 text-sm">
          {session.message}
        </p>
        <div className="flex flex-wrap gap-3">
          {session.status !== 'authenticated' && (
            <label className="grid gap-1 text-sm font-semibold">
              Development role
              <select
                aria-label="Development role"
                className="min-h-11 rounded-control border border-border bg-white px-3 text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
                value={selectedRole}
                onChange={(event) =>
                  setSelectedRole(event.target.value as StaffProfile['role'])
                }
              >
                {Object.entries(roleLabels).map(([role, label]) => (
                  <option key={role} value={role}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {session.status !== 'authenticated' && (
            <Button
              pending={session.status === 'signing-in'}
              onClick={() => void signIn(selectedRole)}
            >
              Sign in as development {roleButtonLabels[selectedRole]}
            </Button>
          )}
          {(session.status === 'authenticated' ||
            session.status === 'signing-in') && (
            <Button
              variant="ghost"
              onClick={() =>
                clear(
                  'signed-out',
                  'Signed out. In-memory authentication and verified data were cleared.',
                )
              }
            >
              Log out
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs">
          Local development only. Reloading clears the in-memory session. The
          backend remains authoritative for each role and request.
        </p>
      </aside>
      {children}
    </SessionContext.Provider>
  );
}
