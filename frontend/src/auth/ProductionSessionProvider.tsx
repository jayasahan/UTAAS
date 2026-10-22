import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
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
import {
  ApiError,
  apiBaseUrl,
  createApiClient,
  requestJson,
} from '../services/apiClient';

function safeLoginFailure(error: unknown): string {
  const kind = error instanceof ApiError ? error.kind : 'server';
  if (kind === 'unauthorized')
    return 'Sign-in failed. Check your email and password or contact your administrator.';
  if (kind === 'network')
    return 'The authentication service could not be reached. Check your connection and try again.';
  if (kind === 'unavailable')
    return 'Sign-in is unavailable because the API is not configured for this environment.';
  if (kind === 'invalid-response')
    return 'The authentication service returned an unexpected response. Try again later.';
  return 'Sign-in could not be completed. Try again later.';
}

export function ProductionSessionProvider({
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
    message: '',
    client: null,
    version: 0,
    user: null,
  });

  const clearSession = useCallback((status: SessionStatus, message: string) => {
    generation.current += 1;
    token.current = null;
    pending.current?.abort();
    pending.current = null;
    clearTimeout(timer.current);
    setSession({
      status,
      message,
      client: null,
      version: generation.current,
      user: null,
    });
  }, []);

  useEffect(
    () => () => {
      generation.current += 1;
      token.current = null;
      pending.current?.abort();
      clearTimeout(timer.current);
    },
    [],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<StaffProfile> => {
      if (pending.current) throw new ApiError('server');
      generation.current += 1;
      const attempt = generation.current;
      token.current = null;
      clearTimeout(timer.current);
      const controller = new AbortController();
      pending.current = controller;
      setSession({
        status: 'signing-in',
        message: 'Verifying your account…',
        client: null,
        version: attempt,
        user: null,
      });

      try {
        const result = await requestJson(
          apiBaseUrl(),
          '/auth/login',
          decodeAuthResponse,
          {
            method: 'POST',
            body: { email: email.trim(), password },
            signal: controller.signal,
          },
        );
        const expiresAt = jwtExpiresAt(result.accessToken);
        if (expiresAt <= Date.now()) throw new ApiError('unauthorized');
        token.current = result.accessToken;
        const client = createApiClient(
          apiBaseUrl(),
          () => token.current,
          () => {
            if (attempt === generation.current && token.current)
              clearSession(
                'expired',
                'Your session is no longer valid. Sign in again to continue.',
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
          const remaining = expiresAt - Date.now();
          if (remaining <= 0) {
            clearSession(
              'expired',
              'Your session has expired. Sign in again to continue.',
            );
          } else {
            timer.current = setTimeout(expire, Math.min(remaining, 2147483647));
          }
        };
        expire();
        if (attempt !== generation.current) throw new ApiError('unauthorized');
        pending.current = null;
        setSession({
          status: 'authenticated',
          message: '',
          client,
          version: attempt,
          user: profile,
        });
        return profile;
      } catch (error) {
        if (attempt === generation.current && !controller.signal.aborted) {
          token.current = null;
          pending.current = null;
          clearTimeout(timer.current);
          const failureStatus: SessionStatus =
            error instanceof ApiError && error.kind === 'unavailable'
              ? 'unavailable'
              : error instanceof ApiError && error.kind === 'unauthorized'
                ? 'signed-out'
                : 'error';
          setSession({
            status: failureStatus,
            message: safeLoginFailure(error),
            client: null,
            version: attempt,
            user: null,
          });
        }
        throw error;
      } finally {
        if (pending.current === controller) pending.current = null;
      }
    },
    [clearSession],
  );

  const logout = useCallback(async (): Promise<boolean> => {
    const accessToken = token.current;
    generation.current += 1;
    const attempt = generation.current;
    pending.current?.abort();
    pending.current = null;
    token.current = null;
    clearTimeout(timer.current);
    setSession({
      status: 'signing-out',
      message: 'Signing out…',
      client: null,
      version: attempt,
      user: null,
    });

    let serverRevoked = false;
    if (accessToken) {
      try {
        await requestJson(apiBaseUrl(), '/auth/logout', decodeLogoutResponse, {
          method: 'POST',
          token: accessToken,
        });
        serverRevoked = true;
      } catch {
        // The local token is cleared regardless; never claim server revocation on failure.
      }
    }
    if (attempt === generation.current) {
      setSession({
        status: 'signed-out',
        message: serverRevoked
          ? 'You have been signed out.'
          : 'You are signed out on this device. Server session revocation could not be confirmed.',
        client: null,
        version: attempt,
        user: null,
      });
    }
    return serverRevoked;
  }, []);

  return (
    <SessionContext.Provider value={{ ...session, login, logout }}>
      {children}
    </SessionContext.Provider>
  );
}
