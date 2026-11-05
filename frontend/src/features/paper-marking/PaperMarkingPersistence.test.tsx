import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SessionContext } from '../../auth/session';
import type { ApiClient } from '../../services/apiClient';
import { PaperMarkingClaimPage } from './PaperMarkingClaimPage';
import { academicOptionsFixture } from '../../test/academicOptionsFixture';

function makeClient(): ApiClient {
  return {
    get: vi.fn(async (path, decode) => {
      if (path === '/requests/paper-marking/options/form-dropdowns')
        return decode(academicOptionsFixture);
      const response =
        path === '/auth/me'
          ? {
              id: 'user-1',
              email: 'lecturer@example.test',
              fullName: 'Verified Name',
              role: 'LECTURER',
              departmentCode: 'ENG',
              departmentId: 'dept-1',
            }
          : { circularReference: 'verified-circular', rates: {} };
      return decode(response);
    }),
    post: vi.fn(async (_path, body, decode) =>
      decode({
        id: 'draft-1',
        trackingNumber: 'UT-2026-001',
        status: 'DRAFT',
        totalAmount: 0,
        formData: body,
      }),
    ),
    upload: vi.fn(async (_path, file, category, decode) =>
      decode({
        name: file.name,
        url: `/api/v1/requests/documents/test__${file.name}`,
        documentType: category,
        size: file.size,
        mimetype: file.type,
        requestId: null,
      }),
    ),
  };
}

describe('paper marking draft persistence UI', () => {
  it('creates a draft once and reports the backend-confirmed response', async () => {
    const user = userEvent.setup();
    const client = makeClient();
    render(
      <SessionContext.Provider
        value={{ status: 'authenticated', message: '', client, version: 1 }}
      >
        <MemoryRouter>
          <PaperMarkingClaimPage />
        </MemoryRouter>
      </SessionContext.Provider>,
    );
    expect(await screen.findByDisplayValue('Verified Name')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(
      await screen.findByText(/Draft saved on the server \(UT-2026-001\)/),
    ).toBeVisible();
    expect(client.post).toHaveBeenCalledTimes(1);
    const body = vi.mocked(client.post).mock.calls[0]?.[1] as {
      papers: unknown[];
      personal: { fullName: string };
    };
    expect(body.personal.fullName).toBe('Verified Name');
    expect(body.papers).toEqual([]);
  });

  it('restores an owned draft by ID before displaying editable fields', async () => {
    const user = userEvent.setup();
    const previous = window.location.href;
    window.history.replaceState({}, '', '/requests/new?draftId=draft-2');
    const client = makeClient();
    vi.mocked(client.get).mockImplementation(async (path, decode) => {
      if (path === '/requests/paper-marking/options/form-dropdowns')
        return decode({
          ...academicOptionsFixture,
          courseModules: [
            {
              code: 'EC5060',
              title: 'Saved Course',
              departmentCode: 'ENG',
              semester: 1,
            },
          ],
        });
      if (path === '/auth/me')
        return decode({
          id: 'user-1',
          email: 'lecturer@example.test',
          fullName: 'Profile Name',
          role: 'LECTURER',
          departmentCode: 'ENG',
          departmentId: 'dept-1',
        });
      if (path === '/requests/paper-marking/draft-2')
        return decode({
          id: 'draft-2',
          trackingNumber: 'UT-DRAFT-2',
          status: 'DRAFT',
          totalAmount: 4200,
          formData: {
            personal: {
              fullName: 'Saved Lecturer',
              designation: 'Lecturer',
              department: 'ENG',
              staffId: 'STAFF-1',
            },
            metadata: {
              academicYear: '2025/26',
              semester: 'Semester 1',
              degreeProgramme: 'BSc',
              courseCode: 'EC5060',
              courseTitle: 'Saved Course',
              examType: 'Final',
              examinerRole: 'First Examiner',
            },
            papers: [
              {
                id: 'row-9',
                title: 'Saved paper',
                durationHours: 3,
                assessmentUnit: 'hours',
                assessmentQuantity: 2,
                settingCount: 1,
              },
            ],
            supportingDocuments: [],
            declaration: false,
          },
        });
      return decode({ circularReference: 'verified-circular', rates: {} });
    });
    try {
      render(
        <MemoryRouter initialEntries={['/requests/new?draftId=draft-2']}>
          <SessionContext.Provider
            value={{ status: 'authenticated', message: '', client, version: 1 }}
          >
            <PaperMarkingClaimPage />
          </SessionContext.Provider>
        </MemoryRouter>,
      );
      expect(await screen.findByDisplayValue('Saved Lecturer')).toBeVisible();
      await user.click(screen.getByRole('button', { name: 'Continue →' }));
      expect(screen.getByDisplayValue('EC5060')).toBeVisible();
      expect(screen.getByDisplayValue('Saved Course')).toBeVisible();
      expect(screen.getByDisplayValue('Saved paper')).toBeVisible();
      expect(screen.getByText(/Draft reference: UT-DRAFT-2/)).toBeVisible();
    } finally {
      window.history.replaceState(
        {},
        '',
        new URL(previous).pathname + new URL(previous).search,
      );
    }
  });
});
