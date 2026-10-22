import type { ReviewHistoryEntry } from './reviewHistoryModel';

/**
 * Fictional development-only records for visual and interaction checks.
 * This data is never read by the production history route.
 */
export const reviewHistoryFixtures: readonly ReviewHistoryEntry[] = [
  {
    id: 'demo-approved-021',
    trackingNumber: 'UTAAS-DEMO-021',
    applicant: 'Dr. Example Fernando',
    claimType: 'Paper Setting & Marking Payment',
    department: 'Civil & Environmental Engineering',
    decision: 'APPROVED',
    decisionDate: '2026-10-10T12:20:00.000Z',
    events: [
      {
        id: 'demo-021-submit',
        action: 'Submitted',
        actor: 'Sample Lecturer',
        role: 'Lecturer',
        occurredAt: '2026-10-10T08:45:00.000Z',
        summary: 'Fictional claim and documents received.',
      },
      {
        id: 'demo-021-approve',
        action: 'Approved',
        actor: 'Sample Head of Department',
        role: 'HOD',
        occurredAt: '2026-10-10T12:20:00.000Z',
        summary: 'Fictional department review completed.',
      },
    ],
  },
  {
    id: 'demo-returned-022',
    trackingNumber: 'UTAAS-DEMO-022',
    applicant: 'Dr. Example Perera',
    claimType: 'Paper Setting & Marking Payment',
    department: 'Civil & Environmental Engineering',
    decision: 'RETURNED_FOR_CORRECTION',
    decisionDate: '2026-10-09T14:10:00.000Z',
    events: [
      {
        id: 'demo-022-return',
        action: 'Returned for correction',
        actor: 'Sample Examination Officer',
        role: 'Examination Officer',
        occurredAt: '2026-10-09T14:10:00.000Z',
        summary: 'Fictional note: duty roster required.',
      },
    ],
  },
  {
    id: 'demo-approved-024',
    trackingNumber: 'UTAAS-DEMO-024',
    applicant: 'Dr. Example Silva',
    claimType: 'Paper Setting & Marking Payment',
    department: 'Computer Engineering',
    decision: 'APPROVED',
    decisionDate: '2026-10-08T09:35:00.000Z',
    events: [
      {
        id: 'demo-024-submit',
        action: 'Submitted',
        actor: 'Sample Lecturer',
        role: 'Lecturer',
        occurredAt: '2026-10-07T08:05:00.000Z',
        summary: 'Fictional Paper Marking claim submitted.',
      },
      {
        id: 'demo-024-approve',
        action: 'Approved',
        actor: 'Sample Dean',
        role: 'Dean',
        occurredAt: '2026-10-08T09:35:00.000Z',
        summary: 'Fictional faculty review completed.',
      },
    ],
  },
  {
    id: 'demo-approved-025',
    trackingNumber: 'UTAAS-DEMO-025',
    applicant: 'Dr. Example Amarasinghe',
    claimType: 'Paper Setting & Marking Payment',
    department: 'Computer Engineering',
    decision: 'APPROVED',
    decisionDate: '2026-09-07T11:00:00.000Z',
    events: [
      {
        id: 'demo-025-submit',
        action: 'Submitted',
        actor: 'Sample Lecturer',
        role: 'Lecturer',
        occurredAt: '2026-09-06T08:15:00.000Z',
        summary: 'Fictional reimbursement request submitted.',
      },
      {
        id: 'demo-025-approve',
        action: 'Approved',
        actor: 'Sample Financial Officer',
        role: 'Financial Officer',
        occurredAt: '2026-09-07T11:00:00.000Z',
        summary: 'Fictional financial review completed.',
      },
    ],
  },
];
