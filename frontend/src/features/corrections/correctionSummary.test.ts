import { describe, expect, it } from 'vitest';
import type {
  AuditEvent,
  RequestDetail,
  RequestHistory,
  RequestTracking,
} from '../requests/contracts';
import { summarizeCorrection } from './correctionSummary';

const request: RequestDetail = {
  id: 'request-id',
  trackingNumber: 'UT-2026-001',
  status: 'RETURNED_FOR_CORRECTION',
  currentStageKey: 'LECTURER_CORRECTION',
  totalAmount: 120,
  createdAt: '2026-10-20T10:00:00.000Z',
  applicant: {
    fullName: 'Dr. Lecturer',
    department: { name: 'Computer Engineering', code: 'COM' },
  },
  formData: {
    metadata: { courseCode: 'EC5060', courseTitle: 'Software Engineering' },
    items: { paperSettingCount: 1, scriptMarkingCount: 20 },
    feeCalculation: {
      currency: 'LKR',
      totalAmount: 120,
      items: [
        {
          label: 'Marking of Answer Scripts',
          unit: 'per script',
          rate: 6,
          count: 20,
          subtotal: 120,
        },
      ],
    },
    supportingDocuments: [
      {
        name: 'marks-sheet.pdf',
        documentType: 'ATTENDANCE_MARKS_SHEET',
        url: 'https://private.example/document',
      },
    ],
  },
};

const tracking: RequestTracking = {
  trackingNumber: 'UT-2026-001',
  requestType: 'Paper Setting & Marking Claim',
  status: 'RETURNED_FOR_CORRECTION',
  totalAmount: 120,
  returningOfficerId: 'private-officer-id',
  currentStage: {
    key: 'LECTURER_CORRECTION',
    name: 'Lecturer Correction',
    order: 0,
    assignedRole: 'LECTURER',
  },
  stages: [
    {
      key: 'HEAD_OF_DEPARTMENT',
      name: 'Head of Department',
      order: 1,
      requiredRole: 'HOD',
      status: 'RETURNED',
      actorName: 'Officer Name',
      enteredAt: '2026-10-21T09:00:00.000Z',
      completedAt: '2026-10-21T10:00:00.000Z',
      comments: 'Please confirm script count.',
    },
  ],
};

const history: RequestHistory = {
  requestId: 'request-id',
  trackingNumber: 'UT-2026-001',
  events: [
    {
      id: 'return-event',
      actionType: 'RETURN',
      actorName: 'Dr. Reviewer',
      actorRole: 'HOD',
      previousStatus: 'UNDER_REVIEW',
      newStatus: 'RETURNED_FOR_CORRECTION',
      fieldDiff: null,
      comment: 'Please confirm script count.',
      createdAt: '2026-10-21T10:00:00.000Z',
    },
  ],
};

describe('summarizeCorrection', () => {
  it('maps verified applicant, academic, aggregate claim, fee and document fields', () => {
    const result = summarizeCorrection(request, tracking, history);
    expect(result.applicantFields).toContainEqual({
      label: 'Full name',
      value: 'Dr. Lecturer',
    });
    expect(result.academicFields).toContainEqual({
      label: 'Course code',
      value: 'EC5060',
    });
    expect(result.claimFields).toContainEqual({
      label: 'Script marking',
      value: '20 scripts',
    });
    expect(result.feeLines).toEqual([
      {
        label: 'Marking of Answer Scripts',
        unit: 'per script',
        rate: 6,
        quantity: 20,
        subtotal: 120,
      },
    ]);
    expect(result.feeTotal).toBe(120);
    expect(result.documents).toEqual([
      { label: 'ATTENDANCE MARKS SHEET', value: 'marks-sheet.pdf' },
    ]);
    expect(JSON.stringify(result)).not.toContain('private.example');
    expect(JSON.stringify(result)).not.toContain('private-officer-id');
  });

  it('uses the latest return event without inventing a correction section', () => {
    const previousEvent = history.events[0];
    if (!previousEvent) throw new Error('Missing return event fixture');
    const newer: AuditEvent = {
      ...previousEvent,
      id: 'newer',
      comment: 'Correct the course title.',
      createdAt: '2026-10-22T10:00:00.000Z',
    };
    const result = summarizeCorrection(request, tracking, {
      ...history,
      events: [...history.events, newer],
    });
    expect(result.comment).toBe('Correct the course title.');
    expect(result.returningRole).toBe('Head of Department');
    expect(result.returnedAt).toBe('2026-10-22T10:00:00.000Z');
  });

  it('handles absent or malformed optional data without generating values', () => {
    const incomplete = summarizeCorrection(
      {
        ...request,
        applicant: null,
        formData: {
          items: { paperSettingCount: -1 },
          supportingDocuments: [{ url: 'secret' }],
        },
      },
      null,
      null,
    );
    expect(incomplete.applicantFields).toEqual([]);
    expect(incomplete.academicFields).toEqual([]);
    expect(incomplete.claimFields).toEqual([]);
    expect(incomplete.documents).toEqual([]);
    expect(incomplete.feeTotal).toBeNull();
    expect(incomplete.comment).toBeNull();
    expect(incomplete.returningRole).toBeNull();
  });
});
