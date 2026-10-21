import { FeeCalculationService } from './fee-calculation.service';
import { ClaimItemsDto, PaperRowDto } from '../dto/create-paper-marking-claim.dto';

describe('FeeCalculationService', () => {
  let service: FeeCalculationService;

  beforeEach(() => {
    service = new FeeCalculationService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateClaimFees', () => {
    it('should compute exact fees according to official circular rates', () => {
      const items: ClaimItemsDto = {
        paperSettingCount: 1, // 1 * 3500 = 3500
        paperModerationCount: 1, // 1 * 2000 = 2000
        scriptMarkingCount: 100, // 100 * 120 = 12000
        practicalAssessmentHours: 6, // 6 * 500 = 3000
        secondMarkingCount: 50, // 50 * 60 = 3000
      };

      const result = service.calculateClaimFees(items);

      expect(result.currency).toBe('LKR');
      expect(result.totalAmount).toBe(23500.0);
      expect(result.items).toHaveLength(5);

      const paperSetting = result.items.find((i) => i.key === 'PAPER_SETTING');
      expect(paperSetting?.subtotal).toBe(3500.0);

      const scriptMarking = result.items.find((i) => i.key === 'SCRIPT_MARKING');
      expect(scriptMarking?.subtotal).toBe(12000.0);
    });

    it('should return 0 total when all counts are 0', () => {
      const items: ClaimItemsDto = {
        paperSettingCount: 0,
        paperModerationCount: 0,
        scriptMarkingCount: 0,
        practicalAssessmentHours: 0,
        secondMarkingCount: 0,
      };

      const result = service.calculateClaimFees(items);
      expect(result.totalAmount).toBe(0);
    });

    it('should handle undefined or null items gracefully', () => {
      const result = service.calculateClaimFees(undefined);
      expect(result.totalAmount).toBe(0);
      expect(result.items).toHaveLength(5);
    });

    it('should aggregate and calculate fees from multiple paper rows', () => {
      const papers: PaperRowDto[] = [
        {
          id: 'paper-1',
          title: 'Software Engineering (EC5060)',
          durationHours: 3,
          settingCount: 1,
          moderationCount: 0,
          translationCount: 0,
          scriptCount: 60,
          secondMarkingCount: 15,
          assessmentUnit: 'hours',
          assessmentQuantity: 2,
        },
        {
          id: 'paper-2',
          title: 'Computer Networks (EC5070)',
          durationHours: 3,
          settingCount: 1,
          moderationCount: 1,
          translationCount: 0,
          scriptCount: 60,
          secondMarkingCount: 15,
          assessmentUnit: 'hours',
          assessmentQuantity: 2,
        },
      ];

      // Aggregates:
      // Setting: 2 papers * 3500 = 7000
      // Moderation: 1 paper * 2000 = 2000
      // Marking: 120 scripts * 120 = 14400
      // Practical: 4 hours * 500 = 2000
      // Second marking: 30 scripts * 60 = 1800
      // Total: 7000 + 2000 + 14400 + 2000 + 1800 = 27200
      const result = service.calculateClaimFees(null, papers);
      expect(result.totalAmount).toBe(27200.0);
      expect(result.items.find((i) => i.key === 'PAPER_SETTING')?.count).toBe(2);
      expect(result.items.find((i) => i.key === 'SCRIPT_MARKING')?.count).toBe(120);
    });

    it('should handle negative numbers by clamping to 0', () => {
      const items: ClaimItemsDto = {
        paperSettingCount: -5,
        paperModerationCount: 0,
        scriptMarkingCount: 10,
        practicalAssessmentHours: 0,
        secondMarkingCount: 0,
      };

      const result = service.calculateClaimFees(items);
      const paperSetting = result.items.find((i) => i.key === 'PAPER_SETTING');
      expect(paperSetting?.subtotal).toBe(0);
      expect(result.totalAmount).toBe(1200.0);
    });
  });

  describe('aggregateFromPaperRows', () => {
    it('should correctly sum paper row quantities', () => {
      const papers: PaperRowDto[] = [
        {
          title: 'Maths I',
          settingCount: 1,
          scriptCount: 50,
          assessmentUnit: 'hours',
          assessmentQuantity: 3,
        },
        {
          title: 'Maths II',
          settingCount: 1,
          scriptCount: 50,
          assessmentUnit: 'candidates',
          assessmentQuantity: 40,
        },
      ];

      const agg = service.aggregateFromPaperRows(papers);
      expect(agg.paperSettingCount).toBe(2);
      expect(agg.scriptMarkingCount).toBe(100);
      expect(agg.practicalAssessmentHours).toBe(3); // only hours unit contributes to practical hours
    });
  });

  describe('getApprovedRates', () => {
    it('should return approved circular rates structure', () => {
      const rates = service.getApprovedRates();
      expect(rates.circularReference).toBe(FeeCalculationService.CIRCULAR_REFERENCE);
      expect(rates.rates.PAPER_SETTING.rate).toBe(3500.0);
      expect(rates.rates.SCRIPT_MARKING.rate).toBe(120.0);
    });
  });
});
