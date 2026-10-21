import { describe, expect, it } from 'vitest';
import { createForm } from './model';
import {
  decodePersistedClaim,
  decodeSubmittedClaim,
  decodeUploadedDocument,
  restoreFormData,
  toDraftPayload,
  toSubmissionPayload,
} from './persistence';

describe('paper marking persistence mapping', () => {
  it('keeps separate course fields, personal values and individual paper units', () => {
    const form = createForm();
    form.academic.courseCode = 'EC5060';
    form.academic.courseTitle = 'Software Engineering';
    form.personal.staffId = 'local-id';
    form.papers = [
      {
        ...form.papers[0]!,
        id: 'paper-a',
        title: 'Paper A',
        assessmentUnit: 'candidates',
        assessmentQuantity: '45',
        translationCount: '2',
      },
      {
        ...form.papers[0]!,
        id: 'paper-b',
        title: 'Paper B',
        assessmentUnit: 'hours',
        assessmentQuantity: '1.5',
      },
    ];
    const payload = toDraftPayload(form);
    expect(payload.metadata).toMatchObject({
      courseCode: 'EC5060',
      courseTitle: 'Software Engineering',
    });
    expect(payload.personal.staffId).toBe('local-id');
    expect(payload.papers).toHaveLength(2);
    expect(payload.papers[0]).toMatchObject({
      id: 'paper-a',
      assessmentUnit: 'candidates',
      assessmentQuantity: 45,
      translationCount: 2,
    });
    expect(payload.papers[1]).toMatchObject({
      id: 'paper-b',
      assessmentUnit: 'hours',
      assessmentQuantity: 1.5,
    });
    expect('items' in payload).toBe(false);
  });

  it('allows a genuinely partial draft with no paper rows', () => {
    const form = createForm();
    form.personal.fullName = 'Lecturer';
    const payload = toDraftPayload(form);
    expect(payload.personal.fullName).toBe('Lecturer');
    expect(payload.papers).toEqual([]);
  });

  it('refuses to silently omit an untitled started row or local file', () => {
    const form = createForm();
    form.papers[0]!.scriptCount = '3';
    expect(() => toDraftPayload(form)).toThrow(
      /title of each started paper row/,
    );
    form.papers[0]!.title = '';
    form.documents.push({
      id: 'local',
      file: new File(['x'], 'a.pdf', { type: 'application/pdf' }),
      category: 'APPOINTMENT_LETTER',
    });
    expect(() => toDraftPayload(form)).toThrow(/not been uploaded/);
  });

  it('restores exact supported fields and persisted document references from a request', () => {
    const claim = decodePersistedClaim({
      id: 'draft-id',
      trackingNumber: 'UT-1',
      status: 'DRAFT',
      totalAmount: '3500',
      formData: {
        personal: { fullName: 'Lecturer' },
        metadata: { courseCode: 'EC5060', courseTitle: 'SE' },
        papers: [
          {
            id: 'paper-x',
            title: 'Paper X',
            assessmentUnit: 'hours',
            assessmentQuantity: 2,
            settingCount: 1,
          },
        ],
        supportingDocuments: [
          {
            name: 'letter.pdf',
            url: '/api/v1/requests/documents/file.pdf',
            documentType: 'APPOINTMENT_LETTER',
          },
        ],
        declaration: true,
      },
    });
    const restored = restoreFormData(claim.formData);
    expect(restored.personal.fullName).toBe('Lecturer');
    expect(restored.academic).toMatchObject({
      courseCode: 'EC5060',
      courseTitle: 'SE',
    });
    expect(restored.papers[0]).toMatchObject({
      id: 'paper-x',
      assessmentUnit: 'hours',
      assessmentQuantity: '2',
    });
    expect(restored.persistedDocuments[0]?.name).toBe('letter.pdf');
    expect(restored.declaration).toBe(true);
  });

  it('decodes only a server-confirmed upload reference', () => {
    expect(
      decodeUploadedDocument({
        name: 'proof.pdf',
        url: '/api/v1/requests/documents/lecturer__file-proof.pdf',
        documentType: 'EXAM_TIMETABLE',
        size: 11,
        mimetype: 'application/pdf',
        requestId: null,
      }),
    ).toMatchObject({
      name: 'proof.pdf',
      documentType: 'EXAM_TIMETABLE',
      size: 11,
    });
    expect(() =>
      decodeUploadedDocument({
        name: 'fake.pdf',
        url: 'https://attacker.example/fake.pdf',
        documentType: 'EXAM_TIMETABLE',
        size: 1,
        mimetype: 'application/pdf',
      }),
    ).toThrow(/reference/);
  });

  it('serializes the complete per-paper submission and validates the confirmed server transition', () => {
    const form = createForm();
    form.declaration = true;
    form.academic.academicYear = '2026';
    form.papers[0]!.title = 'EC5060 Paper';
    form.papers[0]!.settingCount = '1';
    const payload = toSubmissionPayload(form, [
      {
        name: 'proof.pdf',
        url: '/api/v1/requests/documents/lecturer__proof.pdf',
        documentType: 'APPOINTMENT_LETTER',
        size: 20,
        attachedToClaim: false,
      },
    ]);
    expect(payload).toMatchObject({
      declaration: true,
      metadata: { academicYear: '2026' },
      papers: [{ id: 'paper-1', title: 'EC5060 Paper', settingCount: 1 }],
      supportingDocuments: [
        {
          name: 'proof.pdf',
          documentType: 'APPOINTMENT_LETTER',
          size: 20,
        },
      ],
    });
    expect(payload).not.toHaveProperty('items');
    expect(payload.supportingDocuments[0]).not.toHaveProperty(
      'attachedToClaim',
    );
    expect(
      decodeSubmittedClaim({
        id: 'claim-id',
        trackingNumber: 'UT-1',
        status: 'UNDER_REVIEW',
        totalAmount: '3500',
        formData: {},
      }).totalAmount,
    ).toBe(3500);
    expect(() =>
      decodeSubmittedClaim({
        id: 'claim-id',
        trackingNumber: 'UT-1',
        status: 'DRAFT',
        totalAmount: 0,
        formData: {},
      }),
    ).toThrow(/confirm/);
  });
});
