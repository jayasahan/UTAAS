import { describe, expect, it } from 'vitest';
import {
  countRecentRequestStatuses,
  latestDraftHref,
  latestTrackableRequestHref,
  recentRequestTitle,
  requestHref,
} from './dashboardData';
import type { RequestListItem } from '../requests/contracts';

function item(
  status: RequestListItem['status'],
  overrides: Partial<RequestListItem> = {},
): RequestListItem {
  return {
    id: 'id-' + status,
    trackingNumber: 'UT-2026-001',
    requestType: 'Paper Setting & Marking Claim',
    status,
    currentStageKey: 'HEAD_OF_DEPARTMENT',
    totalAmount: 0,
    metadata: {},
    createdAt: '2026-10-20T10:00:00.000Z',
    ...overrides,
  };
}

describe('lecturer dashboard data helpers', () => {
  it('groups only the supplied recent statuses without treating drafts or rejections as pending', () => {
    const counts = countRecentRequestStatuses([
      item('DRAFT'),
      item('SUBMITTED'),
      item('UNDER_REVIEW'),
      item('RETURNED_FOR_CORRECTION'),
      item('APPROVED'),
      item('SETTLED'),
      item('REJECTED'),
    ]);

    expect(counts).toEqual({ pending: 2, returned: 1, completed: 2 });
  });

  it('uses verified course metadata as the recent title and falls back to claim type', () => {
    expect(
      recentRequestTitle(
        item('UNDER_REVIEW', {
          metadata: { courseCode: 'CS101', courseTitle: 'Programming' },
        }),
      ),
    ).toBe('CS101 · Programming');
    expect(
      recentRequestTitle(
        item('UNDER_REVIEW', { metadata: { courseTitle: 'Programming' } }),
      ),
    ).toBe('Programming');
    expect(
      recentRequestTitle(
        item('UNDER_REVIEW', {
          metadata: { courseCode: '  ', courseTitle: ' Programming ' },
        }),
      ),
    ).toBe('Programming');
    expect(
      recentRequestTitle(
        item('UNDER_REVIEW', {
          metadata: { referenceTitle: 'Unverified private title' },
        }),
      ),
    ).toBe('Paper Setting & Marking Claim');
  });

  it('routes drafts to resume and submitted requests to existing details', () => {
    const draft = item('DRAFT', { id: 'draft/id' });
    const request = item('UNDER_REVIEW', { id: 'request id' });

    expect(requestHref(draft)).toBe('/requests/new?draftId=draft%2Fid');
    expect(requestHref(request)).toBe('/requests/request%20id');
    expect(latestDraftHref([request, draft])).toBe(
      '/requests/new?draftId=draft%2Fid',
    );
    expect(latestTrackableRequestHref([draft, request])).toBe(
      '/requests/request%20id',
    );
    expect(latestDraftHref([request])).toBeNull();
    expect(latestTrackableRequestHref([draft])).toBeNull();
  });
});
