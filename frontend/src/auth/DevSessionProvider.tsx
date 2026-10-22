import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../components/common/Button';
import {
  apiBaseUrl,
  ApiError,
  createApiClient,
  requestJson,
} from '../services/apiClient';
import {
  decodeAuthResponse,
  decodeLogoutResponse,
  decodeProfile,
  jwtExpiresAt,
  profilesMatch,
} from './contracts';
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
    user: null,
  });
  function clear(status: SessionStatus, message: string) {
    generation.current++;
    token.current = null;
    pending.current?.abort();
    clearTimeout(timer.current);
    setSession({
      status,
      message,
      client: null,
      version: generation.current,
      user: null,
    });
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
          const decoded = decodeAuthResponse(value);
          const profile = decoded.user;
          if (profile.role !== role) throw new Error('Invalid role response');
          return {
            ...decoded,
            expiresAt: jwtExpiresAt(decoded.accessToken),
          };
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
      if (attempt !== generation.current) return;
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
        user: login.user,
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

  async function login(email: string, password: string): Promise<StaffProfile> {
    if (pending.current) throw new ApiError('server');
    clear('signing-in', 'Signing in to the development backend…');
    const attempt = generation.current;
    const controller = new AbortController();
    pending.current = controller;
    try {
      const result = await requestJson(
        apiBaseUrl(),
        '/auth/login',
        (value) => {
          const decoded = decodeAuthResponse(value);
          return { ...decoded, expiresAt: jwtExpiresAt(decoded.accessToken) };
        },
        {
          method: 'POST',
          body: { email: email.trim(), password },
          signal: controller.signal,
        },
      );
      if (result.expiresAt <= Date.now()) throw new ApiError('unauthorized');
      token.current = result.accessToken;
      const client = createApiClient(
        apiBaseUrl(),
        () => token.current,
        () => {
          if (attempt === generation.current)
            clear(
              'unauthorized',
              'The session is no longer valid. Sign in again.',
            );
        },
      );
      const profile = await client.get(
        '/auth/me',
        decodeProfile,
        controller.signal,
      );
      if (!profilesMatch(result.user, profile))
        throw new ApiError('invalid-response');
      if (controller.signal.aborted || attempt !== generation.current)
        throw new DOMException('Sign-in cancelled', 'AbortError');
      const expire = () => {
        if (attempt !== generation.current) return;
        const remaining = result.expiresAt - Date.now();
        if (remaining <= 0)
          clear(
            'expired',
            'The development session has expired. Sign in again.',
          );
        else
          timer.current = setTimeout(expire, Math.min(remaining, 2147483647));
      };
      expire();
      if (attempt !== generation.current) throw new ApiError('unauthorized');
      pending.current = null;
      setSession({
        status: 'authenticated',
        message: 'Authenticated development session active.',
        client,
        version: attempt,
        user: profile,
      });
      return profile;
    } catch (error) {
      if (!controller.signal.aborted && attempt === generation.current) {
        clear(
          error instanceof ApiError && error.kind === 'unauthorized'
            ? 'unauthorized'
            : error instanceof ApiError && error.kind === 'unavailable'
              ? 'unavailable'
              : 'error',
          error instanceof ApiError
            ? error.message
            : 'Sign-in could not be completed.',
        );
      }
      throw error;
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }

  async function logout(): Promise<boolean> {
    const accessToken = token.current;
    clear('signing-out', 'Signing out of the development backend…');
    let serverRevoked = false;
    if (accessToken) {
      try {
        await requestJson(apiBaseUrl(), '/auth/logout', decodeLogoutResponse, {
          method: 'POST',
          token: accessToken,
        });
        serverRevoked = true;
      } catch {
        // Development sign-out still clears the local persona if the backend is unavailable.
      }
    }
    clear(
      'signed-out',
      serverRevoked
        ? 'Signed out. The development backend revoked this session.'
        : 'Signed out locally. Development backend revocation could not be confirmed.',
    );
    return serverRevoked;
  }
  return (
    <SessionContext.Provider value={{ ...session, login, logout }}>
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
            <Button variant="ghost" onClick={() => void logout()}>
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
