import { act, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { claimFieldFixture } from '../../test/claimFieldFixture';
import {
  restoreCorrectionForm,
  toCorrectionDraftPayload,
  toCorrectionPayload,
} from '../corrections/correctionPersistence';
import { decodeOfficerClaimReview } from '../officer-review/contracts';
import { syntheticOfficerReview } from '../officer-review/developmentFixture';
import { OfficerClaimReviewView } from '../officer-review/OfficerClaimReviewView';
import { ReviewStep } from './components/ReviewStep';
import { CorrectionReview } from '../corrections/CorrectionReview';
import { createForm } from './model';
import {
  decodePersistedClaim,
  restoreFormData,
  toDraftPayload,
  toSubmissionPayload,
} from './persistence';
import { useClaimForm } from './useClaimForm';
import { itemLabels } from './supportedFields';
import { validateStep } from './validation';
import { estimatePaper, estimateTotal, type VerifiedRates } from './estimates';

function loaded(data: Record<string, unknown> = claimFieldFixture()) {
  const claim = decodePersistedClaim({
    id: 'claim-1',
    trackingNumber: 'UT-1',
    status: 'DRAFT',
    totalAmount: 12345.67,
    formData: data,
  });
  const restored = restoreFormData(claim.formData);
  return {
    form: { ...restored, documents: [] },
    documents: restored.persistedDocuments,
  };
}

describe('supported claim field preservation', () => {
  it('round trips every supported field and document through draft, edit, restore, submission and correction', () => {
    const initial = claimFieldFixture();
    const { form, documents } = loaded(initial);
    form.personal.referenceTitle = 'Edited reference only';
    const draft = toDraftPayload(form, documents);
    expect(draft).toEqual({
      ...initial,
      personal: {
        ...initial.personal,
        referenceTitle: 'Edited reference only',
      },
    });
    const second = loaded(
      JSON.parse(JSON.stringify(draft)) as Record<string, unknown>,
    );
    expect(toDraftPayload(second.form, second.documents)).toEqual(draft);
    const { selectedDocumentCategory: _category, ...expected } = draft;
    expect(_category).toBe(initial.selectedDocumentCategory);
    expect(toSubmissionPayload(second.form, second.documents)).toEqual(
      expected,
    );
    const correction = restoreCorrectionForm(draft);
    const corrected = { ...correction.form, documents: [] };
    expect(
      toCorrectionPayload(corrected, correction.persistedDocuments),
    ).toEqual(expected);
    expect(
      toCorrectionDraftPayload(
        corrected,
        correction.persistedDocuments,
        'stale fallback note',
      ),
    ).toEqual(draft);
    const reopened = restoreCorrectionForm(
      toCorrectionDraftPayload(
        corrected,
        correction.persistedDocuments,
        undefined,
      ),
    );
    expect(
      toCorrectionPayload(
        { ...reopened.form, documents: [] },
        reopened.persistedDocuments,
      ),
    ).toEqual(expected);
    expect(Object.keys(draft.items ?? {})).toEqual(Object.keys(itemLabels));
  });

  it('retains extensions in newly prepared claims without needing a restoration snapshot', () => {
    const { form, documents } = loaded();
    delete form.originalPapers;
    expect(toSubmissionPayload(form, documents).papers).toEqual(
      claimFieldFixture().papers,
    );
  });

  it('retains false, zero, empty notes and partial optional nested objects', () => {
    const fixture = claimFieldFixture();
    const data = {
      ...fixture,
      comments: '',
      papers: [
        {
          ...fixture.papers[0],
          typedPageCount: 0,
          settingShare: { isShared: false, questionsClaimed: 0, proportion: 0 },
          markingShare: {},
          combinedPaperConfig: {
            isCombinedPaper: false,
            essayWeightPercent: 0,
            mcqWeightPercent: 0,
            mcqQuestionCount: 0,
          },
        },
      ],
    };
    const { form, documents } = loaded(data);
    expect(toDraftPayload(form, documents).papers).toEqual(data.papers);
    expect(toCorrectionPayload(form, documents).comments).toBe('');
  });

  it('allowlists nested DTO fields and excludes monetary, workflow and local-only properties', () => {
    const fixture = claimFieldFixture();
    const { form, documents } = loaded({
      ...fixture,
      departmentId: 'different-department',
      feeCalculation: { totalAmount: 999 },
      hodProportionDivision: { essay: 70 },
      latestDisagreement: 'server-owned',
      personal: { ...fixture.personal, privateExtra: 'omit' },
      metadata: { ...fixture.metadata, evaluationType: 'MCQ' },
      papers: [
        {
          ...fixture.papers[0],
          courseCode: 'unsupported',
          rate: 999,
          settingShare: {
            ...fixture.papers[0]!.settingShare,
            quotaRemaining: 999,
          },
          combinedPaperConfig: {
            ...fixture.papers[0]!.combinedPaperConfig,
            approvedBy: 'server-only',
          },
        },
      ],
      items: { ...fixture.items, unsupportedRate: 200 },
      supportingDocuments: fixture.supportingDocuments.map((document) => ({
        ...document,
        mimetype: 'application/pdf',
        requestId: 'not-in-dto',
      })),
    });
    const payload = toDraftPayload(form, documents);
    expect(payload).toEqual(fixture);
    expect(payload).not.toHaveProperty('originalPapers');
    expect(toCorrectionPayload(form, documents)).not.toHaveProperty(
      'selectedDocumentCategory',
    );
  });

  it('supports older academic aliases and records without the new optional fields', () => {
    const old = createForm();
    old.papers[0]!.title = 'Legacy paper';
    const original = toDraftPayload(old);
    const { metadata, ...rest } = original;
    const restored = loaded({ ...rest, academic: metadata });
    expect(toDraftPayload(restored.form)).toEqual(original);
    expect(restored.form.items).toBeUndefined();
    expect(restored.form.papers[0]).not.toHaveProperty('settingShare');
  });

  it('preserves aggregate-only historical drafts without manufacturing paper rows', () => {
    const data = { ...claimFieldFixture(), papers: [] };
    const { form, documents } = loaded(data);
    expect(toDraftPayload(form, documents).papers).toEqual([]);
    expect(toDraftPayload(form, documents).items).toEqual(data.items);
  });

  it.each([
    { settingShare: { isShared: 'true' } },
    { markingShare: { totalQuestions: 0 } },
    { settingShare: { questionsClaimed: -1 } },
    { markingShare: { proportion: Infinity } },
    { typedPageCount: '4' },
    { typedPageCount: -1 },
    { combinedPaperConfig: [] },
    { combinedPaperConfig: { essayWeightPercent: -1 } },
    { combinedPaperConfig: { isCombinedPaper: 1 } },
  ])(
    'blocks malformed supported nested values instead of silently deleting them: %j',
    (invalid) => {
      const fixture = claimFieldFixture();
      const data = {
        ...fixture,
        papers: [{ ...fixture.papers[0], ...invalid }],
      };
      expect(() => loaded(data)).toThrow();
      expect(() => restoreCorrectionForm(data)).toThrow();
    },
  );

  it.each([
    { items: { thesisPhDCount: '1' } },
    { items: [] },
    { comments: 45 },
  ])('blocks malformed top-level supported values: %j', (invalid) => {
    expect(() => loaded({ ...claimFieldFixture(), ...invalid })).toThrow();
  });

  it('does not silently discard a title-less row containing only new fields', () => {
    const form = createForm();
    form.papers[0]!.typedPageCount = 2;
    expect(() => toDraftPayload(form)).toThrow(
      /title of each started paper row/,
    );
  });

  it('preserves nested state through actual form-hook edits, without aliasing input or carrying fields into another claim', () => {
    const { form, documents } = loaded();
    const { result } = renderHook(useClaimForm);
    act(() => result.current.restore(form));
    act(() => result.current.updatePersonal('referenceTitle', 'Edited'));
    act(() =>
      result.current.updatePaper('extended-paper', 'title', 'Renamed paper'),
    );
    expect(toDraftPayload(result.current.form, documents)).toMatchObject({
      papers: [{ ...claimFieldFixture().papers[0], title: 'Renamed paper' }],
      items: claimFieldFixture().items,
      comments: claimFieldFixture().comments,
    });
    form.papers[0]!.settingShare!.questionsClaimed = 0;
    expect(result.current.form.papers[0]!.settingShare!.questionsClaimed).toBe(
      2,
    );
    act(() => result.current.restore(createForm()));
    expect(result.current.form.items).toBeUndefined();
    expect(result.current.form.comments).toBeUndefined();
  });

  it('updates a recognized derived aggregate after a row edit while retaining independent items', () => {
    const { form, documents } = loaded();
    form.papers[0]!.scriptCount = '60';
    const payload = toDraftPayload(form, documents);
    expect(payload.items).toEqual({
      ...claimFieldFixture().items,
      scriptMarkingCount: 36,
    });
    const next = loaded(payload);
    expect(toDraftPayload(next.form, next.documents).items).toEqual(
      payload.items,
    );
  });

  it('prevents replacing a separate aggregate when overlapping paper quantities change', () => {
    const fixture = claimFieldFixture();
    const { form, documents } = loaded({
      ...fixture,
      items: { ...fixture.items, scriptMarkingCount: 90 },
    });
    expect(toDraftPayload(form, documents).items!.scriptMarkingCount).toBe(90);
    form.papers[0]!.scriptCount = '60';
    expect(() => toDraftPayload(form, documents)).toThrow(
      /separate saved aggregate/,
    );
    expect(() => toCorrectionPayload(form, documents)).toThrow(
      /separate saved aggregate/,
    );
  });

  it('uses the backend question-share rounding when reconciling a quantity edit', () => {
    const fixture = claimFieldFixture();
    const share = {
      isShared: true,
      totalQuestions: 3,
      questionsClaimed: 1,
      proportion: 1 / 3,
    };
    const { form, documents } = loaded({
      ...fixture,
      papers: [
        { ...fixture.papers[0], settingShare: share, markingShare: share },
      ],
      items: {
        ...fixture.items,
        paperSettingCount: 0.3333,
        scriptMarkingCount: 26.67,
      },
    });
    form.papers[0]!.scriptCount = '50';
    form.papers[0]!.settingShare!.questionsClaimed = 2;
    const payload = toDraftPayload(form, documents);
    expect(payload.items).toMatchObject({
      paperSettingCount: 0.6667,
      scriptMarkingCount: 16.67,
      thesisPhDCount: 1,
    });
    expect(payload.papers[0]!.settingShare!.proportion).toBe(1 / 3);
    // Stored proportions are preserved; the server derives effective quantities from questions.
  });

  it('reconciles removed paper quantities without deleting independent aggregate items', () => {
    const fixture = claimFieldFixture();
    const first = fixture.papers[0]!;
    const { form, documents } = loaded({
      ...fixture,
      papers: [first, { ...first, id: 'second-paper' }],
      items: {
        ...fixture.items,
        paperSettingCount: 0.8,
        paperModerationCount: 2,
        scriptMarkingCount: 96,
        secondMarkingCount: 20,
        candidateAssessmentCount: 40,
        paperTypingPages: 8,
      },
    });
    form.papers.pop();
    expect(toDraftPayload(form, documents).items).toEqual(fixture.items);
  });

  it('accepts claims with supported typing or standalone aggregate quantities', () => {
    const { form } = loaded();
    for (const key of [
      'settingCount',
      'moderationCount',
      'translationCount',
      'scriptCount',
      'secondMarkingCount',
      'assessmentQuantity',
    ] as const)
      form.papers[0]![key] = '0';
    delete form.items;
    delete form.papers[0]!.settingShare;
    expect(validateStep(form, 1)).toEqual([]);
    form.papers[0]!.typedPageCount = 0;
    form.items = { thesisPhDCount: 1 };
    expect(validateStep(form, 1)).toEqual([]);
  });

  it('withholds incomplete estimates for supported extended fields and aggregate-only quantities', () => {
    const rates: VerifiedRates = {
      circularReference: 'test-only',
      setting: 1,
      moderation: 1,
      translation: 1,
      marking: 1,
      secondMarking: 1,
      assessmentPerHour: 1,
      assessmentPerCandidate: 1,
    };
    const { form } = loaded();
    expect(estimatePaper(form.papers[0]!, rates)).toBeNull();
    expect(estimateTotal(form.papers, rates, form.items)).toBeNull();
    const plain = createForm().papers;
    expect(estimateTotal(plain, rates, { thesisPhDCount: 1 })).toBeNull();
  });

  it('shows retained values in the lecturer review', () => {
    const { form, documents } = loaded();
    render(
      <ReviewStep
        form={form}
        uploadedDocuments={documents}
        errors={[]}
        onEdit={vi.fn()}
        onDeclaration={vi.fn()}
      />,
    );
    expect(screen.getByText('Setting share')).toBeVisible();
    expect(screen.getByText('Marking share')).toBeVisible();
    expect(screen.getByText('Typed pages: 4')).toBeVisible();
    expect(screen.getByText('Combined paper configuration')).toBeVisible();
    expect(screen.getByText('PhD theses')).toBeVisible();
    expect(screen.getByText(claimFieldFixture().comments)).toBeVisible();
  });

  it('retains the new fields in officer decoding and renders server-confirmed amounts unchanged', () => {
    const sample = syntheticOfficerReview;
    const detail = {
      ...sample,
      createdAt: sample.submittedAt,
      formData: {
        ...claimFieldFixture(),
        feeCalculation: { items: sample.feeLines },
      },
    };
    const review = decodeOfficerClaimReview(
      detail,
      sample.tracking,
      sample.history,
      'HOD',
    );
    expect(review.papers[0]).toMatchObject(claimFieldFixture().papers[0]!);
    expect(review.items).toEqual(claimFieldFixture().items);
    expect(review.totalAmount).toBe(sample.totalAmount);
    expect(review.feeLines).toEqual(sample.feeLines);
    render(
      <MemoryRouter>
        <OfficerClaimReviewView review={review} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Typed pages: 4')).toBeVisible();
    expect(screen.getByText('Stored aggregate quantities')).toBeVisible();
    expect(screen.getByText(/Server-confirmed total:/)).toHaveTextContent(
      new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' })
        .format(sample.totalAmount)
        .replace(/\u00a0/g, ' '),
    );
  });

  it('shows retained details on the returned-claim correction review', () => {
    const sample = syntheticOfficerReview;
    const request = {
      id: sample.id,
      trackingNumber: sample.trackingNumber,
      status: 'RETURNED_FOR_CORRECTION' as const,
      currentStageKey: 'LECTURER_CORRECTION',
      totalAmount: sample.totalAmount,
      createdAt: sample.submittedAt,
      formData: claimFieldFixture(),
    };
    render(
      <MemoryRouter>
        <CorrectionReview
          request={request}
          tracking={null}
          history={null}
          canEdit
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Typed pages: 4')).toBeVisible();
    expect(screen.getByText('Combined paper configuration')).toBeVisible();
  });
});
