import { describe, expect, it } from 'vitest';
import type { RequestDetail, RequestHistory } from '../requests/contracts';
import {
  expectedCorrectionStage,
  restoreCorrectionForm,
  toCorrectionDraftPayload,
  toCorrectionPayload,
  verifyCorrectionResponse,
} from './correctionPersistence';

function completeFormData() {
  return {
    personal: {
      fullName: 'Lecturer Name',
      designation: 'Senior Lecturer',
      department: 'Engineering',
      staffId: 'ENG-100',
      referenceTitle: 'Semester 1 claim',
    },
    metadata: {
      academicYear: '2026',
      semester: '1',
      degreeProgramme: 'BSc Engineering',
      courseCode: 'EC5060',
      courseTitle: 'Software Engineering',
      examType: 'Final',
      examinerRole: 'Chief Examiner',
    },
    papers: [
      {
        id: 'row-one',
        title: 'Paper One',
        durationHours: 3,
        settingCount: 1,
        moderationCount: 1,
        translationCount: 0,
        scriptCount: 40,
        secondMarkingCount: 2,
        assessmentUnit: 'hours',
        assessmentQuantity: 1.5,
      },
      {
        id: 'row-two',
        title: 'Paper Two',
        durationHours: 2,
        settingCount: 1,
        moderationCount: 0,
        translationCount: 1,
        scriptCount: 25,
        secondMarkingCount: 0,
        assessmentUnit: 'candidates',
        assessmentQuantity: 10,
      },
    ],
    supportingDocuments: [
      {
        name: 'appointment.pdf',
        url: '/api/v1/requests/documents/lecturer__appointment.pdf',
        documentType: 'APPOINTMENT_LETTER',
        size: 1024,
      },
    ],
    declaration: true,
  };
}

const returnHistory: RequestHistory = {
  requestId: '7b5b9f20-8d1d-4d3c-8e59-17e252c81401',
  trackingNumber: 'UT-2026-0042',
  events: [
    {
      id: 'return-1',
      actionType: 'RETURN',
      actorName: 'Reviewer',
      actorRole: 'EXAMINATION_OFFICER',
      previousStatus: 'UNDER_REVIEW',
      newStatus: 'RETURNED_FOR_CORRECTION',
      comment: 'Please verify the assessment quantity.',
      fieldDiff: null,
      createdAt: '2026-10-21T10:00:00.000Z',
    },
  ],
};

describe('correction persistence mapping', () => {
  it('restores all distinct paper rows, assessment units, and attached document references', () => {
    const restored = restoreCorrectionForm(completeFormData());

    expect(restored.form.papers).toHaveLength(2);
    expect(restored.form.papers[0]).toMatchObject({
      id: 'row-one',
      title: 'Paper One',
      assessmentUnit: 'hours',
      assessmentQuantity: '1.5',
    });
    expect(restored.form.papers[1]).toMatchObject({
      id: 'row-two',
      title: 'Paper Two',
      assessmentUnit: 'candidates',
      assessmentQuantity: '10',
    });
    expect(restored.persistedDocuments).toEqual([
      expect.objectContaining({
        name: 'appointment.pdf',
        attachedToClaim: true,
      }),
    ]);
    expect(restored.warnings).toEqual([]);
  });

  it('does not reconstruct aggregate-only claims into invented paper rows', () => {
    const data = completeFormData() as Record<string, unknown>;
    delete data.papers;
    data.items = { scriptMarkingCount: 65 };

    expect(() => restoreCorrectionForm(data)).toThrow(/aggregate quantities/i);
  });

  it('blocks when document references are absent or paper identifiers are duplicated', () => {
    const withoutDocuments = completeFormData() as Record<string, unknown>;
    delete withoutDocuments.supportingDocuments;
    expect(() => restoreCorrectionForm(withoutDocuments)).toThrow(
      /document references are unavailable/i,
    );

    const duplicateRows = completeFormData();
    duplicateRows.papers[1]!.id = 'row-one';
    expect(() => restoreCorrectionForm(duplicateRows)).toThrow(
      /duplicate identifiers/i,
    );
  });

  it('warns when optional fields are absent and does not invent their values', () => {
    const data = completeFormData() as Record<string, unknown>;
    const personal = data.personal as Record<string, unknown>;
    delete personal.staffId;
    const metadata = data.metadata as Record<string, unknown>;
    delete metadata.courseCode;
    const rows = data.papers as Record<string, unknown>[];
    delete rows[0]!.translationCount;

    const restored = restoreCorrectionForm(data);
    expect(restored.form.personal.staffId).toBe('');
    expect(restored.form.academic.courseCode).toBe('');
    expect(restored.form.papers[0]!.translationCount).toBe('0');
    expect(restored.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('sends the full multi-row snapshot without aggregate or UI-only fields', () => {
    const restored = restoreCorrectionForm(completeFormData());
    const payload = toCorrectionPayload(
      { ...restored.form, documents: [] },
      restored.persistedDocuments,
    );

    expect(payload.papers).toHaveLength(2);
    expect(payload.papers[0]).toMatchObject({
      title: 'Paper One',
      assessmentUnit: 'hours',
      assessmentQuantity: 1.5,
    });
    expect(payload.papers[1]).toMatchObject({
      title: 'Paper Two',
      assessmentUnit: 'candidates',
      assessmentQuantity: 10,
      translationCount: 1,
    });
    expect(payload.supportingDocuments).toHaveLength(1);
    expect(payload).not.toHaveProperty('items');
    expect(payload).not.toHaveProperty('selectedDocumentCategory');
  });

  it('does not silently drop untitled rows or turn blank quantities into zero', () => {
    const restored = restoreCorrectionForm(completeFormData());
    const form = { ...restored.form, documents: [] };
    const untitled = {
      ...form,
      papers: [{ ...form.papers[0]!, title: '' }, ...form.papers.slice(1)],
    };
    expect(() =>
      toCorrectionPayload(untitled, restored.persistedDocuments),
    ).toThrow(/untitled row cannot be omitted/i);

    const blankQuantity = {
      ...form,
      papers: [
        { ...form.papers[0]!, durationHours: '' },
        ...form.papers.slice(1),
      ],
    };
    expect(() =>
      toCorrectionPayload(blankQuantity, restored.persistedDocuments),
    ).toThrow(/Enter duration hours \(or 0\)/i);

    const blankStoredQuantity = completeFormData() as Record<string, unknown>;
    const rows = blankStoredQuantity.papers as Record<string, unknown>[];
    rows[0]!.assessmentQuantity = '';
    expect(() => restoreCorrectionForm(blankStoredQuantity)).toThrow(
      /invalid quantity/i,
    );
  });

  it('preserves the selected category and existing note in correction draft saves', () => {
    const restored = restoreCorrectionForm({
      ...completeFormData(),
      selectedDocumentCategory: 'EXAM_TIMETABLE',
    });
    const payload = toCorrectionDraftPayload(
      { ...restored.form, documents: [] },
      restored.persistedDocuments,
      'Original application note',
    );

    expect(payload.selectedDocumentCategory).toBe('EXAM_TIMETABLE');
    expect(payload.comments).toBe('Original application note');
    expect(payload.papers).toHaveLength(2);
    expect(payload.supportingDocuments).toHaveLength(1);
  });

  it('maps the returning officer role to the verified next workflow stage', () => {
    expect(expectedCorrectionStage(returnHistory)).toBe('EXAMINATION_OFFICE');
  });

  it('accepts only the expected same-request status and stage from the backend', () => {
    const request: RequestDetail = {
      id: returnHistory.requestId,
      trackingNumber: returnHistory.trackingNumber,
      status: 'UNDER_REVIEW',
      currentStageKey: 'EXAMINATION_OFFICE',
      totalAmount: 24500,
      formData: completeFormData(),
      applicant: null,
      createdAt: '2026-10-20T10:00:00.000Z',
    };

    expect(
      verifyCorrectionResponse(
        request,
        returnHistory.requestId,
        'UNDER_REVIEW',
        'EXAMINATION_OFFICE',
      ),
    ).toBe(request);
    expect(() =>
      verifyCorrectionResponse(
        { ...request, currentStageKey: 'HEAD_OF_DEPARTMENT' },
        returnHistory.requestId,
        'UNDER_REVIEW',
        'EXAMINATION_OFFICE',
      ),
    ).toThrow(/expected request, status, and workflow stage/i);
  });
});
