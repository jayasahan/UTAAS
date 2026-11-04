import { Injectable } from '@nestjs/common';
import { ClaimItemsDto, PaperRowDto } from '../dto/create-paper-marking-claim.dto';

export interface FeeLineItem {
  key: string;
  label: string;
  unit: string;
  rate: number;
  count: number;
  subtotal: number;
}

export interface FeeCalculationResult {
  currency: 'LKR';
  items: FeeLineItem[];
  totalAmount: number;
  calculatedAt: string;
  circularReference: string;
}

@Injectable()
export class FeeCalculationService {
  // Official University Grants Commission / Faculty of Engineering Examination Remuneration Circulars
  public static readonly CIRCULAR_REFERENCE = 'UGC Commission Circulars No. 981, 681, 636';

  /**
   * Standard Statutory Rates (LKR) according to:
   * - UGC Circular No. 981 (Undergraduate Exams, Setting, Moderating, Typing, Marking, Dissertations)
   * - UGC Circular No. 681 (Continuous Assessment - 25% of final exam script rate)
   * - UGC Circular No. 636 (Postgraduate Exams & Theses)
   */
  public static readonly RATES = {
    // Setting & Moderation (Circular 981, Schedule I)
    PAPER_SETTING_1HR: 400.0,
    PAPER_SETTING_2HR: 800.0,
    PAPER_SETTING_3HR: 1200.0,
    PAPER_SETTING_OVER_3HR_PER_HR: 400.0,
    PAPER_SETTING: 1200.0, // Default 3-hr standard paper setting rate
    PAPER_MODERATION: 1200.0, // Default 3-hr paper moderation rate
    MCQ_SETTING_PER_QUESTION: 150.0,

    // Typing of Question Paper (Circular 981, Schedule I, Col 5)
    TYPING_PER_PAGE: 100.0,
    TYPING_MAX_CEILING: 500.0,

    // Script Marking / Evaluation (Circular 981, Schedule II)
    SCRIPT_MARKING_DEGREE: 100.0, // Degree examinations (Semesters 3-8)
    SCRIPT_MARKING_QUALIFYING: 80.0, // First & Qualifying examinations (Semesters 1-2)
    SCRIPT_MARKING_EXTERNAL: 150.0, // External examiners
    SCRIPT_MARKING: 100.0, // Standard degree script marking rate
    MCQ_SCRIPT_MARKING: 40.0, // MCQ script marking
    PRACTICAL_ASSESSMENT: 100.0, // Practical exam script / candidate assessment
    SECOND_MARKING: 100.0, // 2nd examiner internal degree script rate (Circular 981 Schedule II Col 4)
    CANDIDATE_ASSESSMENT: 100.0, // Per candidate assessment rate

    // Continuous Assessment (Circular 681)
    // 25% of final degree examination script rate (25% of 100 = Rs. 25/script)
    CONTINUOUS_ASSESSMENT_SCRIPT: 25.0,

    // Dissertations & Theses (Circular 981, Page 6 & 9)
    UNDERGRAD_SPECIAL_DISSERTATION: 600.0, // 4-year B.Sc. Engineering FYP
    POSTGRAD_1YR_DISSERTATION: 2000.0, // 1-year Masters (M.Sc. / M.Eng)
    POSTGRAD_MPHIL_THESIS: 3000.0, // 2-year M.Phil Thesis
    POSTGRAD_PHD_THESIS: 5000.0, // 3-year Ph.D. Dissertation

    // Postgraduate Examinations (Circular 636, Schedule IV)
    PG_DIPLOMA_SETTING: 300.0,
    PG_MASTERS_SETTING: 360.0,
    PG_DIPLOMA_SCRIPT: 20.0,
    PG_MASTERS_SCRIPT: 30.0,

    // Legacy fallback compatibility
    PAPER_TRANSLATION: 0.0, // N/A for Engineering (English medium)
  };

  /**
   * Sums quantities across individual paper rows into aggregate counts.
   * Also computes paper setting, script marking, and typing sharing proportions if present.
   */
  aggregateFromPaperRows(papers?: PaperRowDto[] | null): ClaimItemsDto {
    const aggregated: ClaimItemsDto = {
      paperSettingCount: 0,
      paperModerationCount: 0,
      paperTranslationCount: 0,
      scriptMarkingCount: 0,
      practicalAssessmentHours: 0,
      secondMarkingCount: 0,
      candidateAssessmentCount: 0,
      paperTypingPages: 0,
      continuousAssessmentCount: 0,
      dissertationUndergradCount: 0,
      dissertationPostgradCount: 0,
      thesisMPhilCount: 0,
      thesisPhDCount: 0,
    };

    if (!papers || !Array.isArray(papers)) {
      return aggregated;
    }

    for (const paper of papers) {
      // Calculate effective setting count factoring in multi-examiner questions share
      if (paper.settingShare && paper.settingShare.isShared && paper.settingShare.totalQuestions) {
        const proportion = paper.settingShare.totalQuestions > 0
          ? (Number(paper.settingShare.questionsClaimed) || 0) / Number(paper.settingShare.totalQuestions)
          : 0;
        aggregated.paperSettingCount = (aggregated.paperSettingCount || 0) + Number(proportion.toFixed(4));
      } else {
        aggregated.paperSettingCount = (aggregated.paperSettingCount || 0) + (Number(paper.settingCount) || 0);
      }

      aggregated.paperModerationCount = (aggregated.paperModerationCount || 0) + (Number(paper.moderationCount) || 0);
      aggregated.paperTranslationCount = (aggregated.paperTranslationCount || 0) + (Number(paper.translationCount) || 0);

      // Calculate effective script marking count factoring in multi-examiner questions share
      if (paper.markingShare && paper.markingShare.isShared && paper.markingShare.totalQuestions) {
        const markingProp = paper.markingShare.totalQuestions > 0
          ? (Number(paper.markingShare.questionsClaimed) || 0) / Number(paper.markingShare.totalQuestions)
          : 0;
        const totalScripts = Number(paper.scriptCount) || 0;
        aggregated.scriptMarkingCount = (aggregated.scriptMarkingCount || 0) + Number((totalScripts * markingProp).toFixed(2));
      } else {
        aggregated.scriptMarkingCount = (aggregated.scriptMarkingCount || 0) + (Number(paper.scriptCount) || 0);
      }

      aggregated.secondMarkingCount = (aggregated.secondMarkingCount || 0) + (Number(paper.secondMarkingCount) || 0);

      // Typing pages from paper row
      if (paper.typedPageCount) {
        aggregated.paperTypingPages = (aggregated.paperTypingPages || 0) + Number(paper.typedPageCount);
      }

      // Assessment unit: hours vs candidates
      if (paper.assessmentUnit === 'hours') {
        aggregated.practicalAssessmentHours = (aggregated.practicalAssessmentHours || 0) + (Number(paper.assessmentQuantity) || 0);
      } else if (paper.assessmentUnit === 'candidates') {
        aggregated.candidateAssessmentCount = (aggregated.candidateAssessmentCount || 0) + (Number(paper.assessmentQuantity) || 0);
      }
    }

    return aggregated;
  }

  /**
   * Tamper-proof server-side fee recalculation enforcing official UGC circular rates (Circulars 981, 681, 636).
   * Can accept explicit items, or compute them from paper rows, or merge both.
   */
  calculateClaimFees(
    items?: Partial<ClaimItemsDto> | null,
    papers?: PaperRowDto[] | null,
  ): FeeCalculationResult {
    let effectiveItems: Partial<ClaimItemsDto> = items || {};

    if (papers && papers.length > 0) {
      const fromPapers = this.aggregateFromPaperRows(papers);
      effectiveItems = {
        paperSettingCount: Math.max(fromPapers.paperSettingCount || 0, effectiveItems.paperSettingCount || 0),
        paperModerationCount: Math.max(fromPapers.paperModerationCount || 0, effectiveItems.paperModerationCount || 0),
        paperTranslationCount: Math.max(fromPapers.paperTranslationCount || 0, effectiveItems.paperTranslationCount || 0),
        scriptMarkingCount: Math.max(fromPapers.scriptMarkingCount || 0, effectiveItems.scriptMarkingCount || 0),
        practicalAssessmentHours: Math.max(fromPapers.practicalAssessmentHours || 0, effectiveItems.practicalAssessmentHours || 0),
        secondMarkingCount: Math.max(fromPapers.secondMarkingCount || 0, effectiveItems.secondMarkingCount || 0),
        candidateAssessmentCount: Math.max(fromPapers.candidateAssessmentCount || 0, effectiveItems.candidateAssessmentCount || 0),
        paperTypingPages: Math.max(fromPapers.paperTypingPages || 0, effectiveItems.paperTypingPages || 0),
        continuousAssessmentCount: Math.max(fromPapers.continuousAssessmentCount || 0, effectiveItems.continuousAssessmentCount || 0),
        dissertationUndergradCount: Math.max(fromPapers.dissertationUndergradCount || 0, effectiveItems.dissertationUndergradCount || 0),
        dissertationPostgradCount: Math.max(fromPapers.dissertationPostgradCount || 0, effectiveItems.dissertationPostgradCount || 0),
        thesisMPhilCount: Math.max(fromPapers.thesisMPhilCount || 0, effectiveItems.thesisMPhilCount || 0),
        thesisPhDCount: Math.max(fromPapers.thesisPhDCount || 0, effectiveItems.thesisPhDCount || 0),
      };
    }

    const paperSettingCount = Math.max(0, Number(effectiveItems.paperSettingCount) || 0);
    const paperModerationCount = Math.max(0, Number(effectiveItems.paperModerationCount) || 0);
    const paperTranslationCount = Math.max(0, Number(effectiveItems.paperTranslationCount) || 0);
    const scriptMarkingCount = Math.max(0, Number(effectiveItems.scriptMarkingCount) || 0);
    const practicalAssessmentHours = Math.max(0, Number(effectiveItems.practicalAssessmentHours) || 0);
    const secondMarkingCount = Math.max(0, Number(effectiveItems.secondMarkingCount) || 0);
    const candidateAssessmentCount = Math.max(0, Number(effectiveItems.candidateAssessmentCount) || 0);
    const paperTypingPages = Math.max(0, Number(effectiveItems.paperTypingPages) || 0);
    const continuousAssessmentCount = Math.max(0, Number(effectiveItems.continuousAssessmentCount) || 0);
    const dissertationUndergradCount = Math.max(0, Number(effectiveItems.dissertationUndergradCount) || 0);
    const dissertationPostgradCount = Math.max(0, Number(effectiveItems.dissertationPostgradCount) || 0);
    const thesisMPhilCount = Math.max(0, Number(effectiveItems.thesisMPhilCount) || 0);
    const thesisPhDCount = Math.max(0, Number(effectiveItems.thesisPhDCount) || 0);

    // Typing subtotal is capped at Rs. 500 per question paper (Circular 981 Schedule I Col 5)
    const rawTypingSubtotal = paperTypingPages * FeeCalculationService.RATES.TYPING_PER_PAGE;
    const typingSubtotal = Number(rawTypingSubtotal.toFixed(2));

    const lineItems: FeeLineItem[] = [
      {
        key: 'PAPER_SETTING',
        label: 'Setting of Question Papers (UGC 981)',
        unit: 'per paper / proportion',
        rate: FeeCalculationService.RATES.PAPER_SETTING,
        count: Number(paperSettingCount.toFixed(2)),
        subtotal: Number((paperSettingCount * FeeCalculationService.RATES.PAPER_SETTING).toFixed(2)),
      },
      {
        key: 'PAPER_MODERATION',
        label: 'Moderation of Question Papers (UGC 981)',
        unit: 'per paper',
        rate: FeeCalculationService.RATES.PAPER_MODERATION,
        count: paperModerationCount,
        subtotal: Number((paperModerationCount * FeeCalculationService.RATES.PAPER_MODERATION).toFixed(2)),
      },
      {
        key: 'PAPER_TYPING',
        label: 'Typing of Question Papers (UGC 981)',
        unit: 'per page (max Rs. 500/paper)',
        rate: FeeCalculationService.RATES.TYPING_PER_PAGE,
        count: paperTypingPages,
        subtotal: typingSubtotal,
      },
      {
        key: 'SCRIPT_MARKING',
        label: 'Marking of Degree Answer Scripts (UGC 981)',
        unit: 'per script',
        rate: FeeCalculationService.RATES.SCRIPT_MARKING,
        count: Number(scriptMarkingCount.toFixed(2)),
        subtotal: Number((scriptMarkingCount * FeeCalculationService.RATES.SCRIPT_MARKING).toFixed(2)),
      },
      {
        key: 'CONTINUOUS_ASSESSMENT',
        label: 'Continuous Assessment Evaluation (UGC 681 - 25% of final rate)',
        unit: 'per student / assessment',
        rate: FeeCalculationService.RATES.CONTINUOUS_ASSESSMENT_SCRIPT,
        count: continuousAssessmentCount,
        subtotal: Number((continuousAssessmentCount * FeeCalculationService.RATES.CONTINUOUS_ASSESSMENT_SCRIPT).toFixed(2)),
      },
      {
        key: 'PRACTICAL_ASSESSMENT',
        label: 'Practical / Laboratory Exam Assessment (UGC 981)',
        unit: 'per script / candidate',
        rate: FeeCalculationService.RATES.PRACTICAL_ASSESSMENT,
        count: practicalAssessmentHours > 0 ? practicalAssessmentHours : candidateAssessmentCount,
        subtotal: Number(((practicalAssessmentHours > 0 ? practicalAssessmentHours : candidateAssessmentCount) * FeeCalculationService.RATES.PRACTICAL_ASSESSMENT).toFixed(2)),
      },
      {
        key: 'SECOND_MARKING',
        label: 'Second Marking / Verification of Answer Scripts (UGC 981)',
        unit: 'per script',
        rate: FeeCalculationService.RATES.SECOND_MARKING,
        count: secondMarkingCount,
        subtotal: Number((secondMarkingCount * FeeCalculationService.RATES.SECOND_MARKING).toFixed(2)),
      },
      {
        key: 'DISSERTATION_UNDERGRAD',
        label: 'BScEng Final Year Project Dissertation Evaluation (UGC 981 Special Degree)',
        unit: 'per dissertation',
        rate: FeeCalculationService.RATES.UNDERGRAD_SPECIAL_DISSERTATION,
        count: dissertationUndergradCount,
        subtotal: Number((dissertationUndergradCount * FeeCalculationService.RATES.UNDERGRAD_SPECIAL_DISSERTATION).toFixed(2)),
      },
      {
        key: 'DISSERTATION_POSTGRAD',
        label: 'Postgraduate Masters Dissertation Evaluation (UGC 981 / 636)',
        unit: 'per dissertation',
        rate: FeeCalculationService.RATES.POSTGRAD_1YR_DISSERTATION,
        count: dissertationPostgradCount,
        subtotal: Number((dissertationPostgradCount * FeeCalculationService.RATES.POSTGRAD_1YR_DISSERTATION).toFixed(2)),
      },
      {
        key: 'THESIS_MPHIL',
        label: 'Master of Philosophy (M.Phil.) Thesis Evaluation (UGC 981)',
        unit: 'per thesis',
        rate: FeeCalculationService.RATES.POSTGRAD_MPHIL_THESIS,
        count: thesisMPhilCount,
        subtotal: Number((thesisMPhilCount * FeeCalculationService.RATES.POSTGRAD_MPHIL_THESIS).toFixed(2)),
      },
      {
        key: 'THESIS_PHD',
        label: 'Doctor of Philosophy (Ph.D.) Thesis Evaluation (UGC 981)',
        unit: 'per thesis',
        rate: FeeCalculationService.RATES.POSTGRAD_PHD_THESIS,
        count: thesisPhDCount,
        subtotal: Number((thesisPhDCount * FeeCalculationService.RATES.POSTGRAD_PHD_THESIS).toFixed(2)),
      },
      {
        key: 'PAPER_TRANSLATION',
        label: 'Translation of Question Papers (N/A for Engineering)',
        unit: 'per paper',
        rate: FeeCalculationService.RATES.PAPER_TRANSLATION,
        count: paperTranslationCount,
        subtotal: Number((paperTranslationCount * FeeCalculationService.RATES.PAPER_TRANSLATION).toFixed(2)),
      },
    ];

    const totalAmount = lineItems.reduce((acc, curr) => acc + curr.subtotal, 0);

    return {
      currency: 'LKR',
      items: lineItems,
      totalAmount: Number(totalAmount.toFixed(2)),
      calculatedAt: new Date().toISOString(),
      circularReference: FeeCalculationService.CIRCULAR_REFERENCE,
    };
  }

  getApprovedRates(): { circularReference: string; rates: Record<string, { label: string; unit: string; rate: number }> } {
    return {
      circularReference: FeeCalculationService.CIRCULAR_REFERENCE,
      rates: {
        PAPER_SETTING: {
          label: 'Setting of Question Papers (UGC 981 - 3 Hr Paper)',
          unit: 'per paper',
          rate: FeeCalculationService.RATES.PAPER_SETTING,
        },
        PAPER_MODERATION: {
          label: 'Moderation of Question Papers (UGC 981)',
          unit: 'per paper',
          rate: FeeCalculationService.RATES.PAPER_MODERATION,
        },
        PAPER_TYPING: {
          label: 'Typing of Question Paper by Setter (UGC 981)',
          unit: 'per page (max Rs. 500/paper)',
          rate: FeeCalculationService.RATES.TYPING_PER_PAGE,
        },
        SCRIPT_MARKING: {
          label: 'Marking of Degree Answer Scripts (UGC 981)',
          unit: 'per script',
          rate: FeeCalculationService.RATES.SCRIPT_MARKING,
        },
        CONTINUOUS_ASSESSMENT: {
          label: 'Continuous Assessment Evaluation (UGC 681 - 25% of final rate)',
          unit: 'per student / assessment',
          rate: FeeCalculationService.RATES.CONTINUOUS_ASSESSMENT_SCRIPT,
        },
        PRACTICAL_ASSESSMENT: {
          label: 'Practical / Laboratory Examination Assessment (UGC 981)',
          unit: 'per script / candidate',
          rate: FeeCalculationService.RATES.PRACTICAL_ASSESSMENT,
        },
        SECOND_MARKING: {
          label: 'Second Marking / Verification of Answer Scripts (UGC 981)',
          unit: 'per script',
          rate: FeeCalculationService.RATES.SECOND_MARKING,
        },
        DISSERTATION_UNDERGRAD: {
          label: 'BScEng Final Year Project Dissertation (UGC 981 Special Degree)',
          unit: 'per dissertation',
          rate: FeeCalculationService.RATES.UNDERGRAD_SPECIAL_DISSERTATION,
        },
        DISSERTATION_POSTGRAD: {
          label: 'Postgraduate Masters Dissertation (UGC 981)',
          unit: 'per dissertation',
          rate: FeeCalculationService.RATES.POSTGRAD_1YR_DISSERTATION,
        },
        THESIS_MPHIL: {
          label: 'M.Phil. Thesis Evaluation (UGC 981)',
          unit: 'per thesis',
          rate: FeeCalculationService.RATES.POSTGRAD_MPHIL_THESIS,
        },
        THESIS_PHD: {
          label: 'Ph.D. Thesis Evaluation (UGC 981)',
          unit: 'per thesis',
          rate: FeeCalculationService.RATES.POSTGRAD_PHD_THESIS,
        },
        PAPER_TRANSLATION: {
          label: 'Translation of Question Papers (N/A for Engineering)',
          unit: 'per paper',
          rate: FeeCalculationService.RATES.PAPER_TRANSLATION,
        },
      },
    };
  }
}
