import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductionSessionProvider } from './ProductionSessionProvider';
import { useSession } from './session';

const profile = {
  id: 'e2c8928d-8a1f-4f65-9e85-b0a7824a0287',
  email: 'lecturer@eng.ruh.ac.lk',
  fullName: 'Dr. Lecturer',
  role: 'LECTURER' as const,
  departmentCode: 'COM',
  departmentId: 'a63bdd09-cc0a-4f65-8780-6c700f321ae2',
};

function base64Url(value: unknown) {
  return btoa(JSON.stringify(value))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function loginBody(exp = Math.floor(Date.now() / 1000) + 3600) {
  return {
    accessToken: `${base64Url({ alg: 'none' })}.${base64Url({ exp })}.signature`,
    user: profile,
  };
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function Probe() {
  const session = useSession();
  return (
    <div>
      <p data-testid="status">{session.status}</p>
      <p data-testid="profile">{session.user?.fullName ?? 'no user'}</p>
      <p data-testid="message">{session.message}</p>
      <button
        type="button"
        onClick={() =>
          void session.login?.(profile.email, 'secret').catch(() => undefined)
        }
      >
        Log in
      </button>
      <button type="button" onClick={() => void session.logout?.()}>
        Log out
      </button>
      <p data-testid="client">{session.client ? 'client' : 'none'}</p>
    </div>
  );
}

function renderProvider() {
  return render(
    <ProductionSessionProvider>
      <Probe />
    </ProductionSessionProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('production authentication session', () => {
  it('starts signed out after a reload and does not restore a token from browser storage', () => {
    const fetcher = vi.fn();
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    vi.stubGlobal('fetch', fetcher);
    renderProvider();
    expect(screen.getByTestId('status')).toHaveTextContent('signed-out');
    expect(screen.getByTestId('client')).toHaveTextContent('none');
    expect(fetcher).not.toHaveBeenCalled();
    expect(storageWrite).not.toHaveBeenCalled();
  });

  it('verifies login identity through /auth/me and keeps the token out of UI and storage', async () => {
    const token = loginBody();
    const requests: RequestInit[] = [];
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init) requests.push(init);
      const path = new URL(String(input)).pathname;
      return Promise.resolve(
        path.endsWith('/auth/login')
          ? json(token)
          : path.endsWith('/auth/me')
            ? json(profile)
            : json({}),
      );
    });
    vi.stubGlobal('fetch', fetcher);
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
    );
    expect(screen.getByTestId('profile')).toHaveTextContent(profile.fullName);
    expect(document.body.textContent).not.toContain(token.accessToken);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const loginInit = requests[0];
    const profileInit = requests[1];
    expect(loginInit).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: profile.email, password: 'secret' }),
    });
    expect(profileInit).toMatchObject({
      method: 'GET',
      credentials: 'omit',
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
  });

  it('rejects an auth profile that differs from the verified current user', async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        new URL(String(input)).pathname.endsWith('/auth/login')
          ? json(loginBody())
          : json({ ...profile, id: 'different-user' }),
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('error'),
    );
    expect(screen.getByTestId('profile')).toHaveTextContent('no user');
    expect(screen.getByTestId('client')).toHaveTextContent('none');
  });

  it('handles invalid credentials without exposing account existence', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ message: 'denied' }, 401));
    vi.stubGlobal('fetch', fetcher);
    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('signed-out'),
    );
    expect(screen.getByTestId('message')).toHaveTextContent(
      'Check your email and password',
    );
    expect(screen.getByTestId('message')).not.toHaveTextContent(
      /registered|account exists/i,
    );
  });

  it('clears a token immediately when the current-user verification returns 401', async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        new URL(String(input)).pathname.endsWith('/auth/login')
          ? json(loginBody())
          : json({ message: 'unauthorized' }, 401),
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('expired'),
    );
    expect(screen.getByTestId('profile')).toHaveTextContent('no user');
    expect(screen.getByTestId('client')).toHaveTextContent('none');
  });

  it('reports a network failure without retaining partial authentication state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('network unavailable')),
    );
    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('error'),
    );
    expect(screen.getByTestId('message')).toHaveTextContent(
      'authentication service could not be reached',
    );
    expect(screen.getByTestId('profile')).toHaveTextContent('no user');
    expect(screen.getByTestId('client')).toHaveTextContent('none');
  });

  it('clears the local session whether logout revocation succeeds or the server is unavailable', async () => {
    let logoutFails = false;
    const token = loginBody();
    const requests: RequestInit[] = [];
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init) requests.push(init);
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/auth/login')) return Promise.resolve(json(token));
      if (path.endsWith('/auth/me')) return Promise.resolve(json(profile));
      if (path.endsWith('/auth/logout')) {
        if (logoutFails) return Promise.reject(new TypeError('network'));
        return Promise.resolve(json({ success: true, message: 'Logged out' }));
      }
      return Promise.resolve(json({}));
    });
    vi.stubGlobal('fetch', fetcher);
    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('signed-out'),
    );
    expect(requests[2]).toMatchObject({
      method: 'POST',
      headers: { Authorization: `Bearer ${token.accessToken}` },
      credentials: 'omit',
    });
    expect(screen.getByTestId('profile')).toHaveTextContent('no user');

    logoutFails = true;
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() =>
      expect(screen.getByTestId('message')).toHaveTextContent(
        'Server session revocation could not be confirmed',
      ),
    );
    expect(screen.getByTestId('client')).toHaveTextContent('none');
  });

  it('expires the in-memory session at the JWT expiry time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T00:00:00Z'));
    const token = loginBody(Math.floor(Date.now() / 1000) + 30);
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) =>
        Promise.resolve(
          new URL(String(input)).pathname.endsWith('/auth/login')
            ? json(token)
            : json(profile),
        ),
      ),
    );
    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.getByTestId('status')).toHaveTextContent('expired');
    expect(screen.getByTestId('client')).toHaveTextContent('none');
  });
});
