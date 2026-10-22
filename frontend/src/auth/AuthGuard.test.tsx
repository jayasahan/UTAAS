import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthGuard } from './AuthGuard';
import { SessionContext } from './session';
import type { Session } from './session';
import type { StaffProfile } from './contracts';

const profile = (role: StaffProfile['role']): StaffProfile => ({
  id: '7b5c2a70-ffbc-4b6f-846b-9683899bf11a',
  email: `${role.toLowerCase()}@eng.ruh.ac.lk`,
  fullName: 'Verified Staff Member',
  role,
  departmentCode: 'COM',
  departmentId: '4d3782aa-4e85-4d0b-9480-94ebfd4c4f93',
});

function renderGuard(
  session: Session,
  path: string,
  roles: readonly StaffProfile['role'][],
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionContext.Provider value={session}>
        <Routes>
          <Route path="/login" element={<p>Sign-in page</p>} />
          <Route element={<AuthGuard allowedRoles={roles} />}>
            <Route
              path="/lecturer"
              element={<p>Lecturer protected content</p>}
            />
            <Route path="/officer" element={<p>Officer protected content</p>} />
          </Route>
        </Routes>
      </SessionContext.Provider>
    </MemoryRouter>,
  );
}

function sessionFor(
  user: StaffProfile | null,
  status: Session['status'] = 'authenticated',
): Session {
  return { status, message: '', client: null, version: 1, user };
}

describe('role-based route guard', () => {
  it('redirects signed-out direct navigation to sign-in without rendering protected content', () => {
    renderGuard(sessionFor(null, 'signed-out'), '/lecturer', ['LECTURER']);
    expect(screen.getByText('Sign-in page')).toBeVisible();
    expect(
      screen.queryByText('Lecturer protected content'),
    ).not.toBeInTheDocument();
  });

  it('allows a lecturer route and denies an officer route to a lecturer', () => {
    const lecturerSession = sessionFor(profile('LECTURER'));
    const allowed = renderGuard(lecturerSession, '/lecturer', ['LECTURER']);
    expect(screen.getByText('Lecturer protected content')).toBeVisible();
    allowed.unmount();

    renderGuard(lecturerSession, '/officer', ['HOD', 'DEAN', 'ADMIN']);
    expect(screen.getByRole('alert')).toHaveTextContent('Access denied');
    expect(
      screen.getByRole('link', { name: 'Go to your dashboard' }),
    ).toHaveAttribute('href', '/');
    expect(
      screen.queryByText('Officer protected content'),
    ).not.toBeInTheDocument();
  });

  it.each([
    'HOD',
    'DEAN',
    'EXAMINATION_OFFICER',
    'FINANCIAL_OFFICER',
    'ASSISTANT_BURSAR',
    'ADMIN',
  ] as const)(
    'allows the existing officer area for %s and denies lecturer-only routes',
    (role) => {
      const officerSession = sessionFor(profile(role));
      const allowed = renderGuard(officerSession, '/officer', [
        'HOD',
        'DEAN',
        'EXAMINATION_OFFICER',
        'FINANCIAL_OFFICER',
        'ASSISTANT_BURSAR',
        'ADMIN',
      ]);
      expect(screen.getByText('Officer protected content')).toBeVisible();
      allowed.unmount();

      renderGuard(officerSession, '/lecturer', ['LECTURER']);
      expect(screen.getByRole('alert')).toHaveTextContent('Access denied');
      expect(
        screen.queryByText('Lecturer protected content'),
      ).not.toBeInTheDocument();
    },
  );

  it('does not expose a protected route if session verification has not completed', () => {
    renderGuard(sessionFor(profile('LECTURER'), 'initializing'), '/lecturer', [
      'LECTURER',
    ]);
    expect(screen.getByText('Sign-in page')).toBeVisible();
    expect(
      screen.queryByText('Lecturer protected content'),
    ).not.toBeInTheDocument();
  });
});
