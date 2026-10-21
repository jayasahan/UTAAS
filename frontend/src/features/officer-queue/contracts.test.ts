import { describe, expect, it } from 'vitest';
import { decodePendingQueue } from './contracts';

const requestId = 'b6a51b21-71e2-47d0-b5cb-965b8c4af922';
const entry = {
  id: requestId,
  trackingNumber: 'UTAAS-2026-0042',
  requestType: 'Paper Marking Payment',
  applicantName: 'Dr. Sample',
  applicantEmail: 'sample@example.test',
  departmentCode: 'CSE',
  status: 'UNDER_REVIEW',
  currentStageKey: 'HEAD_OF_DEPARTMENT',
  totalAmount: 1250,
  metadata: { courseCode: 'EC5406' },
  submittedAt: '2026-10-21T08:30:00.000Z',
};
const page = {
  data: [entry],
  meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
};

describe('decodePendingQueue', () => {
  it('decodes the verified queue fields and pagination', () => {
    expect(decodePendingQueue(page)).toEqual(page);
  });

  it('accepts an empty queue with zero pages', () => {
    expect(
      decodePendingQueue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      }).data,
    ).toEqual([]);
  });

  it.each([
    ['malformed UUID', { ...entry, id: 'sample-id' }],
    ['unsupported request status', { ...entry, status: 'APPROVED' }],
    ['invalid amount', { ...entry, totalAmount: Number.NaN }],
    ['invalid date', { ...entry, submittedAt: 'not-a-date' }],
  ])('rejects a queue item with %s', (_reason, item) => {
    expect(() => decodePendingQueue({ ...page, data: [item] })).toThrow();
  });

  it('rejects malformed pagination metadata', () => {
    expect(() =>
      decodePendingQueue({ ...page, meta: { ...page.meta, limit: 0 } }),
    ).toThrow('Invalid queue pagination');
  });
});
