import { Injectable } from '@nestjs/common';
import { ClaimItemsDto } from '../dto/create-paper-marking-claim.dto';

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
  // Official University Grants Commission / University of Ruhuna Examination Remuneration Circular Rates (LKR)
  public static readonly CIRCULAR_REFERENCE = 'UGC/EST/CIRCULAR/2023-EXAM-RATES-v2';

  public static readonly RATES = {
    PAPER_SETTING: 3500.0, // LKR per question paper
    PAPER_MODERATION: 2000.0, // LKR per paper moderated
    SCRIPT_MARKING: 120.0, // LKR per answer script marked
    PRACTICAL_ASSESSMENT: 500.0, // LKR per practical / oral exam hour
    SECOND_MARKING: 60.0, // LKR per script second-marked/checked
  };

  /**
   * Tamper-proof server-side fee recalculation enforcing official circular rates.
   */
  calculateClaimFees(items: ClaimItemsDto): FeeCalculationResult {
    const paperSettingCount = Math.max(0, items.paperSettingCount || 0);
    const paperModerationCount = Math.max(0, items.paperModerationCount || 0);
    const scriptMarkingCount = Math.max(0, items.scriptMarkingCount || 0);
    const practicalAssessmentHours = Math.max(0, items.practicalAssessmentHours || 0);
    const secondMarkingCount = Math.max(0, items.secondMarkingCount || 0);

    const lineItems: FeeLineItem[] = [
      {
        key: 'PAPER_SETTING',
        label: 'Setting of Question Papers',
        unit: 'per paper',
        rate: FeeCalculationService.RATES.PAPER_SETTING,
        count: paperSettingCount,
        subtotal: Number((paperSettingCount * FeeCalculationService.RATES.PAPER_SETTING).toFixed(2)),
      },
      {
        key: 'PAPER_MODERATION',
        label: 'Moderation of Question Papers',
        unit: 'per paper',
        rate: FeeCalculationService.RATES.PAPER_MODERATION,
        count: paperModerationCount,
        subtotal: Number((paperModerationCount * FeeCalculationService.RATES.PAPER_MODERATION).toFixed(2)),
      },
      {
        key: 'SCRIPT_MARKING',
        label: 'Marking of Answer Scripts',
        unit: 'per script',
        rate: FeeCalculationService.RATES.SCRIPT_MARKING,
        count: scriptMarkingCount,
        subtotal: Number((scriptMarkingCount * FeeCalculationService.RATES.SCRIPT_MARKING).toFixed(2)),
      },
      {
        key: 'PRACTICAL_ASSESSMENT',
        label: 'Practical / Oral Examination Assessment',
        unit: 'per hour',
        rate: FeeCalculationService.RATES.PRACTICAL_ASSESSMENT,
        count: practicalAssessmentHours,
        subtotal: Number((practicalAssessmentHours * FeeCalculationService.RATES.PRACTICAL_ASSESSMENT).toFixed(2)),
      },
      {
        key: 'SECOND_MARKING',
        label: 'Second Marking / Verification of Answer Scripts',
        unit: 'per script',
        rate: FeeCalculationService.RATES.SECOND_MARKING,
        count: secondMarkingCount,
        subtotal: Number((secondMarkingCount * FeeCalculationService.RATES.SECOND_MARKING).toFixed(2)),
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
          label: 'Setting of Question Papers',
          unit: 'per paper',
          rate: FeeCalculationService.RATES.PAPER_SETTING,
        },
        PAPER_MODERATION: {
          label: 'Moderation of Question Papers',
          unit: 'per paper',
          rate: FeeCalculationService.RATES.PAPER_MODERATION,
        },
        SCRIPT_MARKING: {
          label: 'Marking of Answer Scripts',
          unit: 'per script',
          rate: FeeCalculationService.RATES.SCRIPT_MARKING,
        },
        PRACTICAL_ASSESSMENT: {
          label: 'Practical / Oral Examination Assessment',
          unit: 'per hour',
          rate: FeeCalculationService.RATES.PRACTICAL_ASSESSMENT,
        },
        SECOND_MARKING: {
          label: 'Second Marking / Verification of Answer Scripts',
          unit: 'per script',
          rate: FeeCalculationService.RATES.SECOND_MARKING,
        },
      },
    };
  }
}
