import { record, text } from '../../auth/contracts';
import { requestStatuses } from '../requests/contracts';
import type { RequestStatus } from '../requests/contracts';

export const officerQueueRoles = [
  'HOD',
  'DEAN',
  'EXAMINATION_OFFICER',
  'FINANCIAL_OFFICER',
  'ASSISTANT_BURSAR',
  'ADMIN',
] as const;

export interface PendingQueueItem {
  id: string;
  trackingNumber: string;
  requestType: string;
  applicantName: string;
  applicantEmail: string;
  departmentCode: string | null;
  status: RequestStatus;
  currentStageKey: string;
  totalAmount: number;
  metadata: Record<string, unknown>;
  submittedAt: string;
}

export interface PendingQueuePage {
  data: PendingQueueItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function nullableText(value: unknown): string | null {
  return value == null ? null : text(value);
}

function finiteAmount(value: unknown): number {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)
    throw new Error('Invalid queue amount');
  return amount;
}

function count(value: unknown, allowZero = true): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < (allowZero ? 0 : 1)
  )
    throw new Error('Invalid queue pagination');
  return value;
}

function timestamp(value: unknown): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result)))
    throw new Error('Invalid queue date');
  return result;
}

export function decodePendingQueue(value: unknown): PendingQueuePage {
  const response = record(value);
  const meta = record(response.meta);
  if (!Array.isArray(response.data)) throw new Error('Invalid queue list');

  return {
    data: response.data.map((value) => {
      const item = record(value);
      const id = text(item.id);
      const status = text(item.status);
      if (
        !uuidPattern.test(id) ||
        !requestStatuses.includes(status as RequestStatus)
      )
        throw new Error('Invalid queue item');
      if (status !== 'UNDER_REVIEW') throw new Error('Unexpected queue status');
      return {
        id,
        trackingNumber: text(item.trackingNumber),
        requestType: text(item.requestType),
        applicantName: text(item.applicantName),
        applicantEmail: text(item.applicantEmail),
        departmentCode: nullableText(item.departmentCode),
        status: status as RequestStatus,
        currentStageKey: text(item.currentStageKey),
        totalAmount: finiteAmount(item.totalAmount),
        metadata: item.metadata == null ? {} : record(item.metadata),
        submittedAt: timestamp(item.submittedAt),
      };
    }),
    meta: {
      total: count(meta.total),
      page: count(meta.page, false),
      limit: count(meta.limit, false),
      totalPages: count(meta.totalPages),
    },
  };
}
