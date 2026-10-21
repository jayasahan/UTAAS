import { describe, expect, it } from 'vitest';
import { decodeOfficerClaimReview, type OfficerClaimReview } from './contracts';

const requestId = 'b6a51b21-71e2-47d0-b5cb-965b8c4af922';
const trackingNumber = 'UTAAS-2026-0042';

function responses() {
  return {
    detail: {
      id: requestId,
      trackingNumber,
      status: 'UNDER_REVIEW',
      currentStageKey: 'HEAD_OF_DEPARTMENT',
      totalAmount: 1500,
      createdAt: '2026-10-21T08:30:00.000Z',
      applicant: { fullName: 'Dr. Example Applicant' },
      formData: {
        personal: { fullName: 'Dr. Example Applicant', staffId: null },
        metadata: { courseCode: 'CS4101' },
        papers: [
          {
            title: 'Paper I',
            assessmentUnit: 'candidates',
            assessmentQuantity: 50,
          },
          { title: 'Paper II', assessmentUnit: 'hours', assessmentQuantity: 2 },
        ],
        feeCalculation: {
          items: [
            {
              key: 'marking',
              label: 'Marking',
              unit: 'script',
              rate: 30,
              count: 50,
              subtotal: 1500,
            },
          ],
        },
        supportingDocuments: [
          {
            name: 'schedule.pdf',
            url: '/api/v1/requests/documents/lecturer__c9fe8b42-0a12-4f54-8760-4bb1a6d9a700-schedule.pdf',
            documentType: 'Marking schedule',
            size: 1024,
            mimetype: 'application/pdf',
          },
        ],
      },
    },
    tracking: {
      trackingNumber,
      requestType: 'Paper Setting & Marking Payment',
      status: 'UNDER_REVIEW',
      totalAmount: 1500,
      returningOfficerId: null,
      currentStage: {
        key: 'HEAD_OF_DEPARTMENT',
        name: 'HOD review',
        order: 1,
        assignedRole: 'HOD',
      },
      stages: [
        {
          key: 'HEAD_OF_DEPARTMENT',
          name: 'HOD review',
          order: 1,
          requiredRole: 'HOD',
          status: 'IN_PROGRESS',
          actorName: null,
          enteredAt: '2026-10-21T08:30:00.000Z',
          completedAt: null,
          comments: null,
        },
      ],
    },
    history: { requestId, trackingNumber, events: [] },
  };
}

function decode(value = responses()): OfficerClaimReview {
  return decodeOfficerClaimReview(
    value.detail,
    value.tracking,
    value.history,
    'HOD',
  );
}

describe('officer claim review contract decoder', () => {
  it('preserves paper rows and exposes only a validated opaque document filename', () => {
    const review = decode();
    expect(review.papers).toHaveLength(2);
    expect(review.papers.map((paper) => paper.assessmentUnit)).toEqual([
      'candidates',
      'hours',
    ]);
    expect(review.documents).toEqual([
      {
        name: 'schedule.pdf',
        documentType: 'Marking schedule',
        size: 1024,
        mimeType: 'application/pdf',
        downloadFilename:
          'lecturer__c9fe8b42-0a12-4f54-8760-4bb1a6d9a700-schedule.pdf',
      },
    ]);
    expect(review.documents[0]).not.toHaveProperty('url');
    expect(review.feeLines[0]?.subtotal).toBe(1500);
    expect(review.totalAmount).toBe(1500);
    expect(review.tracking.stages[0]?.status).toBe('IN_PROGRESS');
  });

  it.each([
    'https://outside.example/private.pdf',
    '/api/v1/requests/documents/../other-request.pdf',
    '/api/v1/requests/documents/%2fprivate.pdf',
    '/api/v1/requests/documents/a?redirect=outside',
  ])('does not expose a download filename for an untrusted URL: %s', (url) => {
    const value = responses();
    value.detail.formData.supportingDocuments[0]!.url = url;
    expect(decode(value).documents[0]?.downloadFilename).toBeNull();
  });

  it('represents absent optional claim sections as empty or not provided', () => {
    const value = responses();
    value.detail.formData.papers = [];
    value.detail.formData.supportingDocuments = [];
    value.detail.formData.feeCalculation.items = [];
    const review = decode(value);
    expect(review.papers).toEqual([]);
    expect(review.documents).toEqual([]);
    expect(review.feeLines).toEqual([]);
    expect(review.personal.designation).toBeNull();
    expect(review.academic.courseTitle).toBeNull();
  });

  it('rejects inconsistent IDs, statuses and invalid paper quantities', () => {
    const mismatch = responses();
    mismatch.history.requestId = 'a1b2c3d4-e5f6-4789-8a01-123456789abc';
    expect(() => decode(mismatch)).toThrow('Mismatched claim review responses');

    const badStatus = responses();
    badStatus.tracking.status = 'APPROVED';
    expect(() => decode(badStatus)).toThrow(
      'Mismatched claim review responses',
    );

    const badQuantity = responses();
    badQuantity.detail.formData.papers[0]!.assessmentQuantity =
      Number.POSITIVE_INFINITY;
    expect(() => decode(badQuantity)).toThrow('Invalid claim review quantity');

    const badUnit = responses();
    badUnit.detail.formData.papers[0]!.assessmentUnit = 'students';
    expect(() => decode(badUnit)).toThrow('Invalid assessment unit');
  });
});
