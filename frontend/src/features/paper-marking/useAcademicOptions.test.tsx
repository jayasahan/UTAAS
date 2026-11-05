import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { StaffProfile } from '../../auth/contracts';
import { SessionContext } from '../../auth/session';
import type { ApiClient } from '../../services/apiClient';
import { academicOptionsFixture } from '../../test/academicOptionsFixture';
import { useAcademicOptions } from './useAcademicOptions';

const profile: StaffProfile = {
  id: 'lecturer-1',
  fullName: 'Lecturer',
  email: 'lecturer@example.test',
  role: 'LECTURER',
  departmentId: 'verified-department',
  departmentCode: 'ENG',
};
function wrapper(client: ApiClient) {
  return function Provider({ children }: { children: ReactNode }) {
    return (
      <SessionContext.Provider
        value={{ status: 'authenticated', client, version: 1, message: '' }}
      >
        {children}
      </SessionContext.Provider>
    );
  };
}
function clientWithOptions(): ApiClient {
  return {
    get: vi.fn(async (_path, decode) => decode(academicOptionsFixture)),
    post: vi.fn(),
    upload: vi.fn(),
  };
}
function deferred() {
  let resolve: (value: unknown) => void = () => {
    throw new Error('Deferred promise not initialized');
  };
  const promise = new Promise<unknown>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('department-scoped academic options', () => {
  it('requests the authenticated department and numeric semester, retaining only that semester', async () => {
    const client = clientWithOptions();
    const { result } = renderHook(
      () => useAcademicOptions(profile, 'Semester 5'),
      { wrapper: wrapper(client) },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(client.get).toHaveBeenCalledWith(
      '/requests/paper-marking/options/form-dropdowns',
      expect.any(Function),
      expect.any(AbortSignal),
      { departmentId: 'verified-department', semester: '5' },
    );
    expect(result.current.courses.map((course) => course.code)).toEqual([
      'EC5060',
      'EC5070',
    ]);
  });

  it('refuses requests without an authenticated department or lecturer role', () => {
    const client = clientWithOptions();
    const view = renderHook(
      ({ staff }) => useAcademicOptions(staff, 'Semester 5'),
      {
        initialProps: {
          staff: {
            ...profile,
            departmentId: null,
            departmentCode: null,
          } as StaffProfile,
        },
        wrapper: wrapper(client),
      },
    );
    expect(view.result.current.status).toBe('unavailable');
    view.rerender({ staff: { ...profile, role: 'HOD' } });
    expect(client.get).not.toHaveBeenCalled();
  });

  it('supports the verified profile department code when an ID is unavailable', async () => {
    const client = clientWithOptions();
    const { result } = renderHook(
      () =>
        useAcademicOptions({ ...profile, departmentId: null }, 'Semester 6'),
      { wrapper: wrapper(client) },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(client.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Function),
      expect.any(AbortSignal),
      { departmentCode: 'ENG', semester: '6' },
    );
    expect(result.current.courses.map((course) => course.code)).toEqual([
      'EC6010',
    ]);
  });

  it('aborts old queries and ignores late responses after a semester and department change', async () => {
    const old = deferred();
    const latest = deferred();
    const client = clientWithOptions();
    vi.mocked(client.get).mockImplementation(
      async (_path, decode, _signal, query) =>
        decode(
          await (query?.departmentId === 'verified-department'
            ? old.promise
            : latest.promise),
        ),
    );
    const view = renderHook(
      ({ staff, semester }) => useAcademicOptions(staff, semester),
      {
        initialProps: { staff: profile, semester: 'Semester 5' },
        wrapper: wrapper(client),
      },
    );
    const oldSignal = vi.mocked(client.get).mock.calls[0]?.[2];
    view.rerender({
      staff: {
        ...profile,
        departmentId: 'next-department',
        departmentCode: 'EIE',
      },
      semester: 'Semester 6',
    });
    expect(oldSignal?.aborted).toBe(true);
    expect(view.result.current.courses).toEqual([]);
    await act(async () =>
      latest.resolve({ ...academicOptionsFixture, userDepartmentCode: 'EIE' }),
    );
    expect(view.result.current.courses.map((course) => course.code)).toEqual([
      'EC6010',
    ]);
    await act(async () => old.resolve(academicOptionsFixture));
    expect(view.result.current.courses.map((course) => course.code)).toEqual([
      'EC6010',
    ]);
  });

  it('keeps courses unavailable for legacy fallback data and mismatched department responses', async () => {
    const client = clientWithOptions();
    vi.mocked(client.get).mockImplementation(async (_path, decode) =>
      decode({ ...academicOptionsFixture, userDepartmentCode: 'OTHER' }),
    );
    const { result } = renderHook(
      () => useAcademicOptions(profile, 'Semester 5'),
      { wrapper: wrapper(client) },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.courses).toEqual([]);
    expect(result.current.courseMessage).toMatch(/could not be verified/);
  });
});
