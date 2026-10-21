import { decodeOfficerClaimReview } from './contracts';

const requestId = 'b6a51b21-71e2-47d0-b5cb-965b8c4af922';
const trackingNumber = 'UTAAS-DEMO-0001';

// Fictional fixture for local visual checks. Never used by the live route.
export const syntheticOfficerReview = decodeOfficerClaimReview(
  {
    id: requestId,
    trackingNumber,
    status: 'UNDER_REVIEW',
    currentStageKey: 'HEAD_OF_DEPARTMENT',
    totalAmount: 18750,
    createdAt: '2026-10-21T08:30:00.000Z',
    applicant: { fullName: 'Dr. Asha Example' },
    formData: {
      personal: {
        fullName: 'Dr. Asha Example',
        designation: 'Senior Lecturer',
        department: 'Computer Science',
        staffId: 'SYNTHETIC-001',
        referenceTitle: 'Sample examination claim',
      },
      metadata: {
        academicYear: '2026',
        semester: 'Semester 1',
        degreeProgramme: 'BSc Computer Science',
        courseCode: 'CS 4101',
        courseTitle: 'Software Engineering',
        examType: 'End Semester',
        examinerRole: 'Internal examiner',
      },
      papers: [
        {
          title: 'Paper I',
          durationHours: 2,
          settingCount: 1,
          moderationCount: 1,
          translationCount: 0,
          scriptCount: 120,
          secondMarkingCount: 20,
          assessmentUnit: 'candidates',
          assessmentQuantity: 120,
        },
        {
          title: 'Paper II',
          durationHours: 1.5,
          settingCount: 1,
          moderationCount: 0,
          translationCount: 0,
          scriptCount: 80,
          secondMarkingCount: 10,
          assessmentUnit: 'hours',
          assessmentQuantity: 1.5,
        },
      ],
      feeCalculation: {
        currency: 'LKR',
        circularReference: 'Fictional sample only',
        items: [
          {
            key: 'sample-setting',
            label: 'Paper setting (sample)',
            unit: 'paper',
            rate: 12000,
            count: 1,
            subtotal: 12000,
          },
          {
            key: 'sample-marking',
            label: 'Script marking (sample)',
            unit: 'script',
            rate: 50,
            count: 135,
            subtotal: 6750,
          },
        ],
        totalAmount: 18750,
      },
      supportingDocuments: [
        {
          name: 'sample-marking-schedule.pdf',
          url: '/fictional-private-document-url',
          documentType: 'Marking schedule',
          size: 245760,
          mimetype: 'application/pdf',
        },
      ],
    },
  },
  {
    trackingNumber,
    requestType: 'Paper Setting & Marking Payment',
    status: 'UNDER_REVIEW',
    totalAmount: 18750,
    returningOfficerId: null,
    currentStage: {
      key: 'HEAD_OF_DEPARTMENT',
      name: 'Head of Department review',
      order: 1,
      assignedRole: 'HOD',
    },
    stages: [
      {
        key: 'HEAD_OF_DEPARTMENT',
        name: 'Head of Department review',
        order: 1,
        requiredRole: 'HOD',
        status: 'IN_PROGRESS',
        actorName: null,
        actorId: null,
        enteredAt: '2026-10-21T08:30:00.000Z',
        completedAt: null,
        comments: null,
      },
      {
        key: 'DEAN',
        name: 'Dean approval',
        order: 2,
        requiredRole: 'DEAN',
        status: 'PENDING',
        actorName: null,
        actorId: null,
        enteredAt: null,
        completedAt: null,
        comments: null,
      },
    ],
  },
  {
    requestId,
    trackingNumber,
    events: [
      {
        id: 'event-demo-1',
        actionType: 'SUBMITTED',
        actorName: 'Dr. Asha Example',
        actorRole: 'LECTURER',
        previousStatus: null,
        newStatus: 'UNDER_REVIEW',
        comment: 'Synthetic submission event',
        fieldDiff: null,
        createdAt: '2026-10-21T08:30:00.000Z',
      },
    ],
  },
  'HOD',
);
