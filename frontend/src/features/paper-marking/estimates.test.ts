import { describe, expect, it } from 'vitest';
import { decodeCircular } from '../../auth/contracts';
import { currentCircularFixture } from '../../test/circularRatesFixture';
import { createPaper } from './model';
import {
  estimateLimitations,
  estimatePaper,
  estimatePaperBreakdown,
  estimateTotal,
  verifiedRatesFromCircular,
} from './estimates';

const rates = verifiedRatesFromCircular(decodeCircular(currentCircularFixture));

describe('current circular estimate compatibility', () => {
  it('accepts the complete current response without CANDIDATE_ASSESSMENT', () => {
    expect(currentCircularFixture.rates.CANDIDATE_ASSESSMENT).toBeUndefined();
    expect(rates).toMatchObject({
      setting: 1200,
      moderation: 1200,
      translation: 0,
      marking: 100,
      secondMarking: 100,
      assessmentPerCandidate: 100,
    });
    const paper = {
      ...createPaper('one'),
      settingCount: '1',
      scriptCount: '10',
      assessmentQuantity: '3',
    };
    expect(estimatePaper(paper, rates)).toBe(2500);
  });

  it('does not require optional rates for unused quantities or invent zero rates', () => {
    const partial = verifiedRatesFromCircular({
      circularReference: 'partial-test',
      rates: { PAPER_SETTING: currentCircularFixture.rates.PAPER_SETTING! },
    });
    expect(partial?.marking).toBeNull();
    const paper = { ...createPaper('one'), settingCount: '1' };
    expect(estimatePaper(paper, partial)).toBe(1200);
    expect(estimateTotal([paper], partial)).toBe(1200);
    paper.scriptCount = '1';
    expect(estimatePaperBreakdown(paper, partial)).toMatchObject({
      preparation: 1200,
      marking: null,
      total: null,
    });
    expect(estimateLimitations([paper], partial)).toContain(
      'No supported circular rate is available for script marking.',
    );
  });

  it.each(['per hour', 'per candidate', 'per script', 'unknown unit'])(
    'does not reinterpret unsupported practical unit %s',
    (unit) => {
      const unsupported = verifiedRatesFromCircular({
        ...currentCircularFixture,
        rates: {
          ...currentCircularFixture.rates,
          PRACTICAL_ASSESSMENT: { label: 'Practical', rate: 100, unit },
        },
      });
      expect(unsupported?.assessmentPerCandidate).toBeNull();
      const paper = { ...createPaper('one'), settingCount: '1' };
      expect(estimatePaper(paper, unsupported)).toBe(1200);
      paper.assessmentQuantity = '1';
      expect(estimatePaper(paper, unsupported)).toBeNull();
    },
  );

  it('ignores a legacy candidate key instead of guessing a fallback rate', () => {
    const unsupported = verifiedRatesFromCircular({
      circularReference: 'legacy',
      rates: {
        CANDIDATE_ASSESSMENT: {
          label: 'Legacy candidate',
          rate: 99,
          unit: 'per candidate',
        },
      },
    });
    expect(unsupported).toBeUndefined();
  });

  it('retains explicit zero translation while distinguishing an absent translation rate', () => {
    const paper = {
      ...createPaper('one'),
      translationCount: '2',
      settingCount: '1',
    };
    expect(estimatePaper(paper, rates)).toBe(1200);
    expect(estimateLimitations([paper], rates)).toContain(
      'Translation has a zero rate in this circular and does not add a payable amount.',
    );
    const withoutTranslation = { ...currentCircularFixture.rates };
    delete withoutTranslation.PAPER_TRANSLATION;
    expect(
      estimatePaper(
        paper,
        verifiedRatesFromCircular({
          ...currentCircularFixture,
          rates: withoutTranslation,
        }),
      ),
    ).toBeNull();
  });

  it('keeps supported component estimates but refuses positive hours and mixed-unit totals', () => {
    const hourly = {
      ...createPaper('hours'),
      settingCount: '1',
      assessmentUnit: 'hours' as const,
      assessmentQuantity: '2',
    };
    const candidate = {
      ...createPaper('candidates'),
      assessmentQuantity: '10',
    };
    expect(estimatePaperBreakdown(hourly, rates)).toEqual({
      preparation: 1200,
      marking: 0,
      assessment: null,
      total: null,
    });
    expect(estimatePaper(candidate, rates)).toBe(1000);
    expect(estimateTotal([hourly, candidate], rates)).toBeNull();
    expect(estimateLimitations([hourly, candidate], rates)).toContain(
      'Hour-based assessment estimates are unavailable because the circular does not provide an hourly rate.',
    );
    hourly.assessmentQuantity = '0';
    expect(estimateTotal([hourly, candidate], rates)).toBe(2200);
  });

  it('uses the published standard setting rate without inventing duration-specific fees', () => {
    const paper = {
      ...createPaper('one'),
      settingCount: '1',
      durationHours: '1',
    };
    expect(estimatePaper(paper, rates)).toBe(1200);
    paper.durationHours = '4';
    expect(estimatePaper(paper, rates)).toBe(1200);
  });

  it.each([
    {
      settingShare: { isShared: true, totalQuestions: 5, questionsClaimed: 2 },
    },
    {
      markingShare: { isShared: true, totalQuestions: 5, questionsClaimed: 2 },
    },
    {
      combinedPaperConfig: {
        isCombinedPaper: true,
        essayWeightPercent: 60,
        mcqWeightPercent: 40,
      },
    },
    { typedPageCount: 3 },
  ])('does not silently estimate unsupported row data: %j', (extra) => {
    const paper = { ...createPaper('extended'), settingCount: '1', ...extra };
    expect(estimatePaper(paper, rates)).toBeNull();
    expect(estimateTotal([paper], rates)).toBeNull();
    expect(estimateLimitations([paper], rates)).toContain(
      'Shared, combined-paper, and typing amounts require server calculation.',
    );
  });

  it('aggregates and rounds supported fee lines and rejects overflow or invalid quantities', () => {
    const one = {
      ...createPaper('one'),
      scriptCount: '3',
      assessmentQuantity: '2',
    };
    const two = {
      ...createPaper('two'),
      scriptCount: '7',
      assessmentQuantity: '3',
    };
    expect(estimateTotal([one, two], rates)).toBe(1500);
    const pennies = rates && { ...rates, marking: 0.29 };
    expect(estimateTotal([one, two], pennies)).toBe(502.9);
    expect(estimateTotal([{ ...one, scriptCount: '-1' }], rates)).toBeNull();
    expect(
      estimateTotal(
        [{ ...one, scriptCount: String(Number.MAX_SAFE_INTEGER) }, two],
        rates,
      ),
    ).toBeNull();
    expect(
      estimatePaper(
        { ...one, scriptCount: String(Number.MAX_SAFE_INTEGER) },
        rates,
      ),
    ).toBeNull();
    expect(estimateTotal([], rates)).toBeNull();
  });

  it.each([
    null,
    [],
    {},
    { rates: {} },
    { circularReference: 'test', rates: [] },
    { circularReference: 'test', rates: { PAPER_SETTING: null } },
  ])('rejects malformed circular responses: %j', (value) => {
    expect(() => decodeCircular(value)).toThrow();
  });

  it.each([-1, NaN, Infinity, '100', 1.001, Number.MAX_SAFE_INTEGER])(
    'rejects malformed rate amount %s',
    (rate) => {
      expect(() =>
        decodeCircular({
          circularReference: 'test',
          rates: {
            PAPER_SETTING: { label: 'Setting', unit: 'per paper', rate },
          },
        }),
      ).toThrow();
    },
  );

  it('keeps new valid rate types as reference data without mapping them onto supported items', () => {
    const reference = decodeCircular(currentCircularFixture);
    expect(reference.rates.THESIS_PHD?.rate).toBe(5000);
    expect(
      verifiedRatesFromCircular({
        circularReference: reference.circularReference,
        rates: { THESIS_PHD: reference.rates.THESIS_PHD! },
      }),
    ).toBeUndefined();
    expect(
      verifiedRatesFromCircular({ circularReference: 'test', rates: {} }),
    ).toBeUndefined();
  });
});
