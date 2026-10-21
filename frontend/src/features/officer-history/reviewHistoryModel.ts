import type { RequestStatus } from '../requests/contracts';

export type ReviewDecisionStatus = Extract<
  RequestStatus,
  'APPROVED' | 'RETURNED_FOR_CORRECTION' | 'REJECTED'
>;

export interface ReviewHistoryEvent {
  id: string;
  action: string;
  actor: string;
  role: string;
  occurredAt: string;
  summary: string;
}

export interface ReviewHistoryEntry {
  id: string;
  trackingNumber: string;
  applicant: string;
  claimType: string;
  department: string;
  decision: ReviewDecisionStatus;
  decisionDate: string;
  events: readonly ReviewHistoryEvent[];
}

export type ReviewHistoryDateRange = 'all' | 'this-month' | 'last-month';

export interface ReviewHistoryFilters {
  search: string;
  decision: ReviewDecisionStatus | 'all';
  department: string | 'all';
  dateRange: ReviewHistoryDateRange;
}

export const emptyReviewHistoryFilters: ReviewHistoryFilters = {
  search: '',
  decision: 'all',
  department: 'all',
  dateRange: 'all',
};

export function filterReviewHistory(
  entries: readonly ReviewHistoryEntry[],
  filters: ReviewHistoryFilters,
  referenceDate = new Date(),
): ReviewHistoryEntry[] {
  const query = filters.search.trim().toLocaleLowerCase();
  const thisMonthStart = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    1,
  );
  const nextMonthStart = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    1,
  );
  const lastMonthStart = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() - 1,
    1,
  );

  return entries.filter((entry) => {
    if (
      query &&
      !`${entry.trackingNumber} ${entry.applicant}`
        .toLocaleLowerCase()
        .includes(query)
    )
      return false;
    if (filters.decision !== 'all' && entry.decision !== filters.decision)
      return false;
    if (filters.department !== 'all' && entry.department !== filters.department)
      return false;

    if (filters.dateRange === 'all') return true;
    const decisionDate = new Date(entry.decisionDate);
    if (Number.isNaN(decisionDate.getTime())) return false;
    if (filters.dateRange === 'this-month')
      return decisionDate >= thisMonthStart && decisionDate < nextMonthStart;
    return decisionDate >= lastMonthStart && decisionDate < thisMonthStart;
  });
}
