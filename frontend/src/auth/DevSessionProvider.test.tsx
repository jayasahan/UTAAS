import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DevSessionProvider from './DevSessionProvider';
import { useSession } from './session';
import { PaperMarkingClaimPage } from '../features/paper-marking/PaperMarkingClaimPage';

// Mock-only session fixtures. Never supplied to a real backend or production bundle.
const profile = {
  id: 'fixture-id',
  email: 'fixture@example.test',
  fullName: 'Backend fixture lecturer',
  role: 'LECTURER',
  departmentCode: 'COM',
  departmentId: 'fixture-department',
};
const circular = {
  circularReference: 'TEST-CIRCULAR',
  rates: {
    PAPER_SETTING: {
      label: 'Fixture setting rate',
      unit: 'per paper',
      rate: 123,
    },
    PRACTICAL_ASSESSMENT: {
      label: 'Fixture candidate rule',
      unit: 'per candidate',
      rate: 8,
    },
  },
};
function loginResult(expires = Math.floor(Date.now() / 1000) + 3600) {
  return {
    accessToken: [
      btoa('{}'),
      btoa(JSON.stringify({ exp: expires })),
      'test-signature',
    ].join('.'),
    user: profile,
  };
}
function loginResultWithRole(role: string) {
  return { ...loginResult(), user: { ...profile, role } };
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status });
}
function sessionMock() {
  return vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('/auth/mock-login/LECTURER'))
      return Promise.resolve(json(loginResult(), 201));
    if (url.endsWith('/auth/me')) return Promise.resolve(json(profile));
    if (url.endsWith('/rates/circular')) return Promise.resolve(json(circular));
    throw new Error('Unexpected test request');
  });
}
function Probe() {
  const session = useSession();
  return (
    <p data-testid="session-state">
      {session.status}:{session.client ? 'client available' : 'no client'}
    </p>
  );
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('development authentication and read-only integration', () => {
  it('does not restore a logged-in session after the provider is reloaded', async () => {
    const fetcher = sessionMock();
    vi.stubGlobal('fetch', fetcher);
    const view = render(
      <DevSessionProvider>
        <Probe />
      </DevSessionProvider>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Sign in as development lecturer' }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('session-state')).toHaveTextContent(
        'authenticated:client available',
      ),
    );
    view.unmount();
    render(
      <DevSessionProvider>
        <Probe />
      </DevSessionProvider>,
    );
    expect(screen.getByTestId('session-state')).toHaveTextContent(
      'signed-out:no client',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('uses the selected verified mock-login role for development officer access', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/auth/mock-login/HOD'))
        return Promise.resolve(json(loginResultWithRole('HOD'), 201));
      throw new Error('Unexpected test request');
    });
    vi.stubGlobal('fetch', fetcher);
    render(
      <DevSessionProvider>
        <Probe />
      </DevSessionProvider>,
    );
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Development role' }),
      'HOD',
    );
    await user.click(
      screen.getByRole('button', { name: 'Sign in as development HOD' }),
    );
    expect(
      await screen.findByText(/Development Head of Department session active/),
    ).toBeVisible();
    expect(screen.getByTestId('session-state')).toHaveTextContent(
      'authenticated:client available',
    );
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/auth/mock-login/HOD',
      expect.objectContaining({ method: 'POST' }),
    );
  });
  it('ignores a late protected response after logout', async () => {
    let finish!: (value: Response) => void;
    const fetcher = sessionMock().mockImplementation((url: string) =>
      url.endsWith('/auth/me')
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : Promise.resolve(
            json(url.endsWith('/LECTURER') ? loginResult() : circular),
          ),
    );
    vi.stubGlobal('fetch', fetcher);
    const user = userEvent.setup({ delay: null });
    render(
      <MemoryRouter>
        <DevSessionProvider>
          <PaperMarkingClaimPage />
        </DevSessionProvider>
      </MemoryRouter>,
    );
    await user.click(
      screen.getByRole('button', { name: 'Sign in as development lecturer' }),
    );
    await screen.findByText('Loading authenticated staff profile');
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    await act(async () => {
      finish(json(profile));
    });
    expect(screen.getByRole('textbox', { name: 'Full name' })).toHaveValue('');
    expect(
      screen.queryByText('Backend profile retrieved (development persona)'),
    ).not.toBeInTheDocument();
  });
  it('calls the real contract paths and fills untouched fields without inventing missing identity', async () => {
    const fetcher = sessionMock();
    vi.stubGlobal('fetch', fetcher);
    const user = userEvent.setup({ delay: null });
    const view = render(
      <MemoryRouter>
        <DevSessionProvider>
          <PaperMarkingClaimPage />
        </DevSessionProvider>
      </MemoryRouter>,
    );
    expect(fetcher).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: 'Sign in as development lecturer' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Full name' })).toHaveValue(
        profile.fullName,
      ),
    );
    expect(screen.getByRole('textbox', { name: 'Department' })).toHaveValue(
      'COM',
    );
    expect(screen.getByRole('textbox', { name: 'Designation' })).toHaveValue(
      '',
    );
    expect(screen.getByRole('textbox', { name: 'Staff ID' })).toHaveValue('');
    expect(screen.getByText('Fixture setting rate')).toBeVisible();
    expect(screen.getByText('123 · per paper')).toBeVisible();
    expect(screen.getByText('8 · per candidate')).toBeVisible();
    const calls = fetcher.mock.calls as [string, RequestInit][];
    expect(calls.map((call) => new URL(call[0]).pathname)).toEqual([
      '/api/v1/auth/mock-login/LECTURER',
      '/api/v1/auth/me',
      '/api/v1/requests/paper-marking/rates/circular',
    ]);
    expect(calls[0]?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      headers: {},
    });
    expect(calls[1]?.[1]).toMatchObject({
      method: 'GET',
      credentials: 'omit',
      headers: {
        Authorization: expect.stringMatching(
          /^Bearer [^.]+\.[^.]+\.test-signature$/,
        ),
      },
    });
    expect(view.container.textContent).not.toContain(loginResult().accessToken);
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(screen.getByRole('textbox', { name: 'Full name' })).toHaveValue('');
    expect(screen.queryByText('Fixture setting rate')).not.toBeInTheDocument();
  });
  it('preserves user edits, including a deliberately empty field, during delayed profile loading', async () => {
    let resolveProfile!: (value: Response) => void;
    const fetcher = sessionMock().mockImplementation((url: string) => {
      if (url.endsWith('/auth/me'))
        return new Promise<Response>((resolve) => {
          resolveProfile = resolve;
        });
      return Promise.resolve(
        json(url.endsWith('/LECTURER') ? loginResult() : circular),
      );
    });
    vi.stubGlobal('fetch', fetcher);
    const user = userEvent.setup({ delay: null });
    render(
      <MemoryRouter>
        <DevSessionProvider>
          <PaperMarkingClaimPage />
        </DevSessionProvider>
      </MemoryRouter>,
    );
    await user.click(
      screen.getByRole('button', { name: 'Sign in as development lecturer' }),
    );
    expect(
      await screen.findByText('Loading authenticated staff profile'),
    ).toBeInTheDocument();
    const name = screen.getByRole('textbox', {
      name: 'Full name',
    });
    await user.type(name, 'Manual name');
    const department = screen.getByRole('textbox', {
      name: 'Department',
    });
    await user.type(department, 'Manual');
    await user.clear(department);
    await act(async () => {
      resolveProfile(json(profile));
    });
    await screen.findByText('Backend profile retrieved (development persona)');
    expect(name).toHaveValue('Manual name');
    expect(department).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(name).toHaveValue('Manual name');
  });
  it('clears the session after a protected endpoint returns 401', async () => {
    const fetcher = sessionMock().mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith('/auth/me')
          ? json({}, 401)
          : json(url.endsWith('/LECTURER') ? loginResult() : circular),
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    const user = userEvent.setup({ delay: null });
    render(
      <MemoryRouter>
        <DevSessionProvider>
          <Probe />
          <PaperMarkingClaimPage />
        </DevSessionProvider>
      </MemoryRouter>,
    );
    await user.click(
      screen.getByRole('button', { name: 'Sign in as development lecturer' }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('session-state')).toHaveTextContent(
        'unauthorized:no client',
      ),
    );
    expect(screen.queryByText('Fixture setting rate')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Sign in as development lecturer' }),
    ).toBeEnabled();
  });
  it('shows network errors and permits a read-only retry', async () => {
    let failed = true;
    const fetcher = sessionMock().mockImplementation((url: string) => {
      if (url.endsWith('/rates/circular') && failed)
        return Promise.reject(new Error('private network details'));
      return Promise.resolve(
        json(
          url.endsWith('/LECTURER')
            ? loginResult()
            : url.endsWith('/auth/me')
              ? profile
              : circular,
        ),
      );
    });
    vi.stubGlobal('fetch', fetcher);
    const user = userEvent.setup({ delay: null });
    render(
      <MemoryRouter>
        <DevSessionProvider>
          <PaperMarkingClaimPage />
        </DevSessionProvider>
      </MemoryRouter>,
    );
    await user.click(
      screen.getByRole('button', { name: 'Sign in as development lecturer' }),
    );
    const retry = await screen.findByRole('button', {
      name: 'Retry circular rates',
    });
    expect(
      screen.queryByText('private network details'),
    ).not.toBeInTheDocument();
    failed = false;
    await user.click(retry);
    expect(await screen.findByText('Fixture setting rate')).toBeVisible();
  });
  it('handles failed sign-in without creating a session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('private details')),
    );
    render(
      <DevSessionProvider>
        <Probe />
      </DevSessionProvider>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Sign in as development lecturer' }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('session-state')).toHaveTextContent(
        'error:no client',
      ),
    );
    expect(screen.queryByText('private details')).not.toBeInTheDocument();
  });
  it('expires an in-memory session and starts signed out after remount', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(json(loginResult(Math.floor(Date.now() / 1000) + 1))),
        ),
    );
    const view = render(
      <DevSessionProvider>
        <Probe />
      </DevSessionProvider>,
    );
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Sign in as development lecturer' }),
      );
    });
    expect(screen.getByTestId('session-state')).toHaveTextContent(
      'authenticated:client available',
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByTestId('session-state')).toHaveTextContent(
      'expired:no client',
    );
    view.unmount();
    render(
      <DevSessionProvider>
        <Probe />
      </DevSessionProvider>,
    );
    expect(screen.getByTestId('session-state')).toHaveTextContent(
      'signed-out:no client',
    );
  });
  it('keeps production/no-provider behavior unavailable and sends no requests', () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(
      <MemoryRouter>
        <PaperMarkingClaimPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByText(/Production authentication is not implemented/),
    ).toBeVisible();
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  });
});
