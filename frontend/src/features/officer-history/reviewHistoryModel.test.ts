import { describe, expect, it } from 'vitest';
import { reviewHistoryFixtures } from './reviewHistoryFixtures';
import {
  buildReviewHistoryQuery,
  decodeReviewHistoryPage,
  emptyReviewHistoryFilters,
  filterReviewHistory,
} from './reviewHistoryModel';

const referenceDate = new Date('2026-10-21T12:00:00.000Z');

describe('officer review history preview filters', () => {
  it('searches only sample tracking references and applicant names', () => {
    const result = filterReviewHistory(
      reviewHistoryFixtures,
      { ...emptyReviewHistoryFilters, search: 'example perera' },
      referenceDate,
    );
    expect(result.map((entry) => entry.trackingNumber)).toEqual([
      'UTAAS-DEMO-022',
    ]);
  });

  it('filters decisions and departments without changing fixture records', () => {
    const returned = filterReviewHistory(
      reviewHistoryFixtures,
      {
        ...emptyReviewHistoryFilters,
        decision: 'RETURNED_FOR_CORRECTION',
      },
      referenceDate,
    );
    expect(returned).toHaveLength(1);
    expect(returned[0]!.trackingNumber).toBe('UTAAS-DEMO-022');

    const department = filterReviewHistory(
      reviewHistoryFixtures,
      {
        ...emptyReviewHistoryFilters,
        department: 'Computer Engineering',
      },
      referenceDate,
    );
    expect(department.map((entry) => entry.trackingNumber)).toEqual([
      'UTAAS-DEMO-024',
      'UTAAS-DEMO-025',
    ]);
    expect(reviewHistoryFixtures).toHaveLength(4);
  });

  it('filters the local preview by this month and last month', () => {
    const current = filterReviewHistory(
      reviewHistoryFixtures,
      { ...emptyReviewHistoryFilters, dateRange: 'this-month' },
      referenceDate,
    );
    const previous = filterReviewHistory(
      reviewHistoryFixtures,
      { ...emptyReviewHistoryFilters, dateRange: 'last-month' },
      referenceDate,
    );
    expect(current).toHaveLength(3);
    expect(previous.map((entry) => entry.trackingNumber)).toEqual([
      'UTAAS-DEMO-025',
    ]);
  });

  it('returns an empty set for a search with no match', () => {
    expect(
      filterReviewHistory(
        reviewHistoryFixtures,
        { ...emptyReviewHistoryFilters, search: 'no matching sample' },
        referenceDate,
      ),
    ).toEqual([]);
  });
});

const backendHistory = {
  data: [
    {
      id: '59ca45ea-b576-4e81-8524-7bf48e747275',
      trackingNumber: 'UTR-2026-0001',
      applicant: 'Dr. Kamal Perera',
      claimType: 'Paper Setting & Marking Claim',
      department: 'Computer Engineering',
      departmentCode: 'COM',
      decision: 'APPROVED',
      decisionDate: '2026-10-21T14:30:00.000Z',
      totalAmount: 29900,
      events: [
        {
          id: 'b8e9f5e1-8f0a-4c5b-b9d1-8f0a4c5bb9d1',
          action: 'APPROVE',
          actor: 'Dr. Jane Smith',
          role: 'HOD',
          occurredAt: '2026-10-21T14:30:00.000Z',
          summary: 'Approved and recommended for faculty review',
        },
      ],
    },
  ],
  meta: {
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
    summaryCounts: { approved: 4, returned: 1, rejected: 0 },
  },
};

describe('verified officer review-history API contract', () => {
  it('decodes historical decisions, department, audit events, and API counts', () => {
    const decoded = decodeReviewHistoryPage(backendHistory);
    expect(decoded.data[0]).toMatchObject({
      trackingNumber: 'UTR-2026-0001',
      applicant: 'Dr. Kamal Perera',
      department: 'Computer Engineering',
      departmentCode: 'COM',
      decision: 'APPROVED',
      totalAmount: 29900,
      events: [
        expect.objectContaining({
          action: 'APPROVE',
          actor: 'Dr. Jane Smith',
        }),
      ],
    });
    expect(decoded.meta.summaryCounts).toEqual({
      approved: 4,
      returned: 1,
      rejected: 0,
    });
  });

  it('accepts a historical return decision independent of the current request status', () => {
    const returned = decodeReviewHistoryPage({
      ...backendHistory,
      data: [
        {
          ...backendHistory.data[0],
          decision: 'RETURNED_FOR_CORRECTION',
        },
      ],
    });
    expect(returned.data[0]!.decision).toBe('RETURNED_FOR_CORRECTION');
  });

  it('rejects malformed decision dates and unsupported decisions', () => {
    expect(() =>
      decodeReviewHistoryPage({
        ...backendHistory,
        data: [{ ...backendHistory.data[0], decisionDate: 'not-a-date' }],
      }),
    ).toThrow('Invalid review-history timestamp');
    expect(() =>
      decodeReviewHistoryPage({
        ...backendHistory,
        data: [{ ...backendHistory.data[0], decision: 'UNDER_REVIEW' }],
      }),
    ).toThrow('Invalid review-history decision');
  });

  it('rejects malformed summary counts and pagination metadata', () => {
    expect(() =>
      decodeReviewHistoryPage({
        ...backendHistory,
        meta: {
          ...backendHistory.meta,
          summaryCounts: { approved: -1, returned: 0, rejected: 0 },
        },
      }),
    ).toThrow('Invalid review-history count');
    expect(() =>
      decodeReviewHistoryPage({
        ...backendHistory,
        meta: { ...backendHistory.meta, page: 0 },
      }),
    ).toThrow('Invalid review-history pagination');
  });

  it('builds only supported query fields and keeps personal scope explicit by default', () => {
    expect(
      buildReviewHistoryQuery({
        page: 1,
        limit: 10,
        decision: 'all',
        search: '  UTR-2026  ',
        scope: 'personal',
      }),
    ).toEqual({
      page: '1',
      limit: '10',
      decision: 'all',
      scope: 'personal',
      search: 'UTR-2026',
    });
    expect(
      buildReviewHistoryQuery({
        page: 2,
        limit: 10,
        decision: 'APPROVED',
        search: '',
        scope: 'role',
      }),
    ).toEqual({
      page: '2',
      limit: '10',
      decision: 'APPROVED',
      scope: 'role',
    });
  });
});
