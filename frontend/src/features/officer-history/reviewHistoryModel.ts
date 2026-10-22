import type { RequestStatus } from '../requests/contracts';
import { record, text } from '../../auth/contracts';

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
  departmentCode?: string | null;
  decision: ReviewDecisionStatus;
  decisionDate: string;
  totalAmount?: number;
  events: readonly ReviewHistoryEvent[];
}

export interface ReviewHistorySummaryCounts {
  approved: number;
  returned: number;
  rejected: number;
}

export interface ReviewHistoryPage {
  data: ReviewHistoryEntry[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    summaryCounts: ReviewHistorySummaryCounts;
  };
}

export type ReviewHistoryScope = 'personal' | 'role';

export interface ReviewHistoryQueryInput {
  page: number;
  limit: number;
  decision: ReviewDecisionStatus | 'all';
  search: string;
  scope: ReviewHistoryScope;
}

const decisions: readonly ReviewDecisionStatus[] = [
  'APPROVED',
  'RETURNED_FOR_CORRECTION',
  'REJECTED',
];

function nonNegativeCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
    throw new Error('Invalid review-history count');
  return value;
}

function validTimestamp(value: unknown): string {
  const timestamp = text(value);
  if (!Number.isFinite(Date.parse(timestamp)))
    throw new Error('Invalid review-history timestamp');
  return timestamp;
}

function nullableText(value: unknown): string | null {
  return value == null ? null : text(value);
}

function decodeEvent(value: unknown): ReviewHistoryEvent {
  const event = record(value);
  return {
    id: text(event.id),
    action: text(event.action),
    actor: text(event.actor),
    role: text(event.role),
    occurredAt: validTimestamp(event.occurredAt),
    summary: text(event.summary),
  };
}

function decodeEntry(value: unknown): ReviewHistoryEntry {
  const entry = record(value);
  const decision = text(entry.decision);
  const totalAmount = entry.totalAmount;
  if (!decisions.includes(decision as ReviewDecisionStatus))
    throw new Error('Invalid review-history decision');
  if (
    typeof totalAmount !== 'number' ||
    !Number.isFinite(totalAmount) ||
    totalAmount < 0
  )
    throw new Error('Invalid review-history amount');
  if (!Array.isArray(entry.events))
    throw new Error('Invalid review-history events');

  return {
    id: text(entry.id),
    trackingNumber: text(entry.trackingNumber),
    applicant: text(entry.applicant),
    claimType: text(entry.claimType),
    department: text(entry.department),
    departmentCode: nullableText(entry.departmentCode),
    decision: decision as ReviewDecisionStatus,
    decisionDate: validTimestamp(entry.decisionDate),
    totalAmount,
    events: entry.events.map(decodeEvent),
  };
}

/** Decode only the fields returned by GET /requests/review-history. */
export function decodeReviewHistoryPage(value: unknown): ReviewHistoryPage {
  const response = record(value);
  const meta = record(response.meta);
  const counts = record(meta.summaryCounts);
  if (!Array.isArray(response.data))
    throw new Error('Invalid review-history entries');
  const page = nonNegativeCount(meta.page);
  const limit = nonNegativeCount(meta.limit);
  const total = nonNegativeCount(meta.total);
  const totalPages = nonNegativeCount(meta.totalPages);
  if (page < 1 || limit < 1)
    throw new Error('Invalid review-history pagination');

  return {
    data: response.data.map(decodeEntry),
    meta: {
      total,
      page,
      limit,
      totalPages,
      summaryCounts: {
        approved: nonNegativeCount(counts.approved),
        returned: nonNegativeCount(counts.returned),
        rejected: nonNegativeCount(counts.rejected),
      },
    },
  };
}

/** Build only query parameters supported by the verified backend contract. */
export function buildReviewHistoryQuery({
  page,
  limit,
  decision,
  search,
  scope,
}: ReviewHistoryQueryInput): Readonly<Record<string, string>> {
  const trimmedSearch = search.trim();
  return {
    page: String(page),
    limit: String(limit),
    decision,
    scope,
    ...(trimmedSearch ? { search: trimmedSearch } : {}),
  };
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
