import { describe, expect, it } from 'vitest';
import { createForm, createPaper } from './model';
import {
  isMoney,
  isQuantity,
  MAX_FILE_BYTES,
  validateFile,
  validateReview,
  validateStep,
} from './validation';
import {
  estimatePaper,
  estimateTotal,
  formatEstimate,
  verifiedRatesFromCircular,
} from './estimates';
import type { VerifiedRates } from './estimates';

describe('claim validation and estimates', () => {
  it.each([MAX_FILE_BYTES - 1, MAX_FILE_BYTES])(
    'accepts PDF size %s within the local boundary',
    (size) => {
      expect(
        validateFile(
          new File([new Uint8Array(size)], 'boundary.pdf', {
            type: 'application/pdf',
          }),
        ),
      ).toBeUndefined();
    },
  );
  it.each([
    ['image/png', 'image.PNG'],
    ['image/jpeg', 'image.jpg'],
    ['image/jpeg', 'image.jpeg'],
  ] as const)('accepts supported %s file %s', (type, name) => {
    expect(validateFile(new File(['content'], name, { type }))).toBeUndefined();
  });
  it('requires staff identity without prefilled or fabricated values', () => {
    const form = createForm();
    expect(Object.values(form.personal).every((value) => value === '')).toBe(
      true,
    );
    expect(validateStep(form, 0).map((error) => error.field)).toEqual([
      'fullName',
      'designation',
      'department',
      'staffId',
    ]);
    expect(
      validateStep(form, 0).some((error) => error.field === 'referenceTitle'),
    ).toBe(false);
  });
  it.each(['', '-1', 'Infinity', 'NaN', '1e3', ' ', '9007199254740992'])(
    'rejects invalid quantities: %s',
    (value) => expect(isQuantity(value)).toBe(false),
  );
  it('distinguishes integer counts and fractional hours', () => {
    expect(isQuantity('1.5')).toBe(true);
    expect(isQuantity('1.5', true)).toBe(false);
    expect(isQuantity('0', true)).toBe(true);
  });
  it.each([NaN, Infinity, -1, 1.001, Number.MAX_SAFE_INTEGER])(
    'rejects invalid money: %s',
    (value) => expect(isMoney(value)).toBe(false),
  );
  it('requires academic fields, paper title, duration and a positive quantity', () => {
    const form = createForm();
    const errors = validateStep(form, 1);
    expect(errors).toHaveLength(10);
    expect(errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(['courseCode', 'courseTitle']),
    );
    form.papers[0]!.assessmentQuantity = '1.5';
    expect(
      validateStep(form, 1).some((error) =>
        error.field.endsWith('assessmentQuantity'),
      ),
    ).toBe(true);
    form.papers[0]!.assessmentUnit = 'hours';
    expect(
      validateStep(form, 1).some((error) =>
        error.field.endsWith('assessmentQuantity'),
      ),
    ).toBe(false);
    form.papers = [];
    expect(
      validateStep(form, 1).some((error) => error.field === 'paper-table'),
    ).toBe(true);
  });
  it('does not invent rates or translation/candidate calculation rules', () => {
    const paper = createPaper('one');
    paper.settingCount = '1';
    expect(estimatePaper(paper)).toBeNull();
    // Test-only fixture; these values are not production policy or runtime data.
    const rates: VerifiedRates = {
      circularReference: 'test-only',
      setting: 10,
      moderation: 5,
      translation: 4,
      marking: 2,
      secondMarking: 1,
      assessmentPerHour: 3,
      assessmentPerCandidate: 6,
    };
    expect(estimatePaper(paper, rates)).toBe(10);
    paper.durationHours = '9';
    expect(estimatePaper(paper, rates)).toBe(10);
    paper.translationCount = '1';
    expect(estimatePaper(paper, rates)).toBe(14);
    paper.assessmentQuantity = '2';
    expect(estimatePaper(paper, rates)).toBe(26);
    paper.assessmentUnit = 'hours';
    expect(estimatePaper(paper, rates)).toBe(20);
    expect(estimateTotal([paper, createPaper('two')])).toBeNull();
    expect(estimatePaper(paper, { ...rates, marking: NaN })).toBeNull();
    expect(formatEstimate(null)).toBe('Unavailable');
    const fractional = createPaper('fractional');
    fractional.assessmentUnit = 'hours';
    fractional.assessmentQuantity = '0.00001';
    const fractionalSecond = { ...fractional, id: 'fractional-2' };
    const hourlyRates = { ...rates, assessmentPerHour: 500 };
    expect(estimatePaper(fractional, hourlyRates)).toBe(0.01);
    expect(estimatePaper(fractionalSecond, hourlyRates)).toBe(0.01);
    // Backend aggregates quantity first, then rounds the assessment line once.
    expect(estimateTotal([fractional, fractionalSecond], hourlyRates)).toBe(
      0.01,
    );
  });
  it('accepts estimates only when every backend rate key has its verified unit', () => {
    const rates = verifiedRatesFromCircular({
      circularReference: 'fixture-circular',
      rates: {
        PAPER_SETTING: { label: 'Setting', unit: 'per paper', rate: 3500 },
        PAPER_MODERATION: {
          label: 'Moderation',
          unit: 'per paper',
          rate: 2000,
        },
        PAPER_TRANSLATION: {
          label: 'Translation',
          unit: 'per paper',
          rate: 1500,
        },
        SCRIPT_MARKING: { label: 'Marking', unit: 'per script', rate: 120 },
        SECOND_MARKING: {
          label: 'Second marking',
          unit: 'per script',
          rate: 60,
        },
        PRACTICAL_ASSESSMENT: {
          label: 'Practical',
          unit: 'per hour',
          rate: 500,
        },
        CANDIDATE_ASSESSMENT: {
          label: 'Candidates',
          unit: 'per candidate',
          rate: 120,
        },
      },
    });
    expect(rates).toMatchObject({
      setting: 3500,
      translation: 1500,
      assessmentPerCandidate: 120,
    });
    expect(
      verifiedRatesFromCircular({
        circularReference: 'fixture-circular',
        rates: {
          ...{
            PAPER_SETTING: {
              label: 'Setting',
              unit: 'per candidate',
              rate: 3500,
            },
          },
        },
      }),
    ).toBeUndefined();
  });
  it('validates file types, matching extensions, nonempty content and local size limits', () => {
    expect(
      validateFile(
        new File(['pdf'], 'letter.pdf', { type: 'application/pdf' }),
      ),
    ).toBeUndefined();
    expect(
      validateFile(new File(['x'], 'x.exe', { type: 'application/pdf' })),
    ).toMatch(/extension/);
    expect(
      validateFile(new File(['x'], 'x.svg', { type: 'image/svg+xml' })),
    ).toMatch(/PDF/);
    expect(
      validateFile(new File([], 'empty.pdf', { type: 'application/pdf' })),
    ).toMatch(/Empty/);
    expect(
      validateFile(
        new File([new Uint8Array(MAX_FILE_BYTES + 1)], 'large.pdf', {
          type: 'application/pdf',
        }),
      ),
    ).toMatch(/10 MiB/);
  });
  it('requires documents and declaration for local review only', () => {
    expect(validateStep(createForm(), 2)).toEqual([
      { field: 'documents', message: expect.any(String), step: 2 },
    ]);
    expect(
      validateReview(createForm()).some(
        (error) => error.field === 'declaration',
      ),
    ).toBe(true);
  });
});
