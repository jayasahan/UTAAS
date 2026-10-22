import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SignInPage } from './SignInPage';
import { SessionContext } from '../auth/session';
import type { Session } from '../auth/session';
import type { StaffProfile } from '../auth/contracts';
import { ApiError } from '../services/apiClient';

const lecturer: StaffProfile = {
  id: '575160d8-6c21-4c2c-ad2e-fd141ec2ed59',
  email: 'lecturer@eng.ruh.ac.lk',
  fullName: 'Dr. Lecturer',
  role: 'LECTURER',
  departmentCode: 'COM',
  departmentId: 'aa5a5424-1a20-4ed5-b9b4-304512a62913',
};
const officer: StaffProfile = { ...lecturer, role: 'HOD' };

function renderPage(session: Session, path = '/login', state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <SessionContext.Provider value={session}>
        <Routes>
          <Route path="/login" element={<SignInPage />} />
          <Route path="/" element={<p>Lecturer dashboard</p>} />
          <Route path="/requests/new" element={<p>New request</p>} />
          <Route path="/officer" element={<p>Officer dashboard</p>} />
        </Routes>
      </SessionContext.Provider>
    </MemoryRouter>,
  );
}

function signInSession(login: NonNullable<Session['login']>): Session {
  return {
    status: 'signed-out',
    message: '',
    client: null,
    version: 0,
    user: null,
    login,
  };
}

describe('institutional sign-in page', () => {
  it('validates required fields locally and associates errors with their inputs', async () => {
    const login = vi.fn();
    renderPage(signInSession(login));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your email address.')).toBeVisible();
    expect(screen.getByText('Enter your password.')).toBeVisible();
    expect(screen.getByLabelText(/Email address/)).toHaveFocus();
    expect(screen.getByLabelText(/Email address/)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText(/Email address/)).toHaveAttribute(
      'aria-describedby',
      'login-email-error',
    );
    expect(login).not.toHaveBeenCalled();
  });

  it('submits email/password and redirects to the verified lecturer dashboard', async () => {
    const login = vi.fn().mockResolvedValue(lecturer);
    const user = userEvent.setup();
    renderPage(signInSession(login));
    await user.type(screen.getByLabelText(/Email address/), lecturer.email);
    await user.type(screen.getByLabelText(/Password/), 'entered-secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Lecturer dashboard')).toBeVisible();
    expect(login).toHaveBeenCalledWith(lecturer.email, 'entered-secret');
    expect(
      screen.queryByDisplayValue('entered-secret'),
    ).not.toBeInTheDocument();
  });

  it('preserves a same-role intended lecturer route after login', async () => {
    const login = vi.fn().mockResolvedValue(lecturer);
    const user = userEvent.setup();
    renderPage(signInSession(login), '/login', { from: '/requests/new' });
    await user.type(screen.getByLabelText(/Email address/), lecturer.email);
    await user.type(screen.getByLabelText(/Password/), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('New request')).toBeVisible();
  });

  it('uses role-specific landing and rejects a mismatched intended path', async () => {
    const login = vi.fn().mockResolvedValue(officer);
    const user = userEvent.setup();
    renderPage(signInSession(login), '/login', { from: '/requests/new' });
    await user.type(screen.getByLabelText(/Email address/), officer.email);
    await user.type(screen.getByLabelText(/Password/), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Officer dashboard')).toBeVisible();
  });

  it('shows a generic credential error and clears the password after failure', async () => {
    const login = vi.fn().mockRejectedValue(new ApiError('unauthorized'));
    const user = userEvent.setup();
    renderPage(signInSession(login));
    await user.type(
      screen.getByLabelText(/Email address/),
      'unknown@example.test',
    );
    await user.type(screen.getByLabelText(/Password/), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Check your email and password',
    );
    expect(screen.queryByDisplayValue('secret')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).not.toHaveTextContent(
      /account exists|not registered/i,
    );
  });

  it('toggles password visibility with an accessible pressed state', async () => {
    const user = userEvent.setup();
    renderPage(signInSession(vi.fn()));
    const password = screen.getByLabelText(/Password/);
    await user.type(password, 'secret');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(
      screen.getByRole('button', { name: 'Hide password' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
