import { describe, expect, it } from 'vitest';
import { reviewHistoryFixtures } from './reviewHistoryFixtures';
import {
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
