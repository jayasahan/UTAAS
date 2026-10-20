import { FeeCalculationService } from './fee-calculation.service';
import { ClaimItemsDto } from '../dto/create-paper-marking-claim.dto';

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

  describe('getApprovedRates', () => {
    it('should return approved circular rates structure', () => {
      const rates = service.getApprovedRates();
      expect(rates.circularReference).toBe(FeeCalculationService.CIRCULAR_REFERENCE);
      expect(rates.rates.PAPER_SETTING.rate).toBe(3500.0);
      expect(rates.rates.SCRIPT_MARKING.rate).toBe(120.0);
    });
  });
});
