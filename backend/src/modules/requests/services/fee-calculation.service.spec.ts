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
    it('should compute exact fees according to official UGC Circular 981 / 681 rates', () => {
      const items: ClaimItemsDto = {
        paperSettingCount: 1, // 1 * 1200 = 1200
        paperModerationCount: 1, // 1 * 1200 = 1200
        scriptMarkingCount: 100, // 100 * 100 = 10000
        practicalAssessmentHours: 6, // 6 * 100 = 600
        secondMarkingCount: 50, // 50 * 100 = 5000
        paperTypingPages: 3, // 3 * 100 = 300
        continuousAssessmentCount: 100, // 100 * 25 = 2500
      };

      const result = service.calculateClaimFees(items);

      expect(result.currency).toBe('LKR');
      // Total: 1200 + 1200 + 10000 + 600 + 5000 + 300 + 2500 = 20800
      expect(result.totalAmount).toBe(20800.0);
      expect(result.items.length).toBeGreaterThanOrEqual(10);

      const paperSetting = result.items.find((i) => i.key === 'PAPER_SETTING');
      expect(paperSetting?.subtotal).toBe(1200.0);

      const scriptMarking = result.items.find((i) => i.key === 'SCRIPT_MARKING');
      expect(scriptMarking?.subtotal).toBe(10000.0);

      const typing = result.items.find((i) => i.key === 'PAPER_TYPING');
      expect(typing?.subtotal).toBe(300.0);

      const ca = result.items.find((i) => i.key === 'CONTINUOUS_ASSESSMENT');
      expect(ca?.subtotal).toBe(2500.0);
    });

    it('should calculate dissertation and thesis evaluation fees accurately (Circular 981)', () => {
      const items: ClaimItemsDto = {
        dissertationUndergradCount: 5, // 5 * 600 = 3000
        dissertationPostgradCount: 1, // 1 * 2000 = 2000
        thesisMPhilCount: 1, // 1 * 3000 = 3000
        thesisPhDCount: 1, // 1 * 5000 = 5000
      };

      const result = service.calculateClaimFees(items);
      // Total: 3000 + 2000 + 3000 + 5000 = 13000
      expect(result.totalAmount).toBe(13000.0);
      const undergrad = result.items.find((i) => i.key === 'DISSERTATION_UNDERGRAD');
      expect(undergrad?.count).toBe(5);
      expect(undergrad?.subtotal).toBe(3000.0);
      const phd = result.items.find((i) => i.key === 'THESIS_PHD');
      expect(phd?.count).toBe(1);
      expect(phd?.subtotal).toBe(5000.0);
    });

    it('should return 0 total when all counts are 0', () => {
      const items: ClaimItemsDto = {
        paperSettingCount: 0,
        paperModerationCount: 0,
        scriptMarkingCount: 0,
        practicalAssessmentHours: 0,
        secondMarkingCount: 0,
        paperTranslationCount: 0,
        candidateAssessmentCount: 0,
      };

      const result = service.calculateClaimFees(items);
      expect(result.totalAmount).toBe(0);
    });

    it('should handle undefined or null items gracefully', () => {
      const result = service.calculateClaimFees(undefined);
      expect(result.totalAmount).toBe(0);
      expect(result.items.length).toBeGreaterThanOrEqual(10);
    });

    it('should aggregate and calculate fees from multiple paper rows including multi-examiner sharing', () => {
      const papers: PaperRowDto[] = [
        {
          id: 'paper-1',
          title: 'Software Engineering (EC5060)',
          durationHours: 3,
          settingCount: 1,
          moderationCount: 0,
          translationCount: 0,
          scriptCount: 120,
          secondMarkingCount: 0,
          typedPageCount: 3, // 3 * 100 = 300
          settingShare: {
            isShared: true,
            totalQuestions: 5,
            questionsClaimed: 2, // 2/5 * 1200 = 480
          },
          markingShare: {
            isShared: true,
            totalQuestions: 5,
            questionsClaimed: 2, // 2/5 * 120 * 100 = 4800
          },
        },
        {
          id: 'paper-2',
          title: 'Computer Networks (EC5070)',
          durationHours: 3,
          settingCount: 1, // Full 1200
          moderationCount: 1, // Full 1200
          translationCount: 0,
          scriptCount: 60, // 60 * 100 = 6000
          secondMarkingCount: 20, // 20 * 100 = 2000
          typedPageCount: 2, // 2 * 100 = 200
        },
      ];

      // Aggregates:
      // Setting: 0.4 + 1 = 1.4 papers * 1200 = 1680
      // Moderation: 1 paper * 1200 = 1200
      // Typing: (3 + 2) = 5 pages * 100 = 500
      // Marking: (48 + 60) = 108 scripts * 100 = 10800
      // Second marking: 20 scripts * 100 = 2000
      // Total: 1680 + 1200 + 500 + 10800 + 2000 = 16180
      const result = service.calculateClaimFees(null, papers);
      expect(result.totalAmount).toBe(16180.0);
      expect(result.items.find((i) => i.key === 'PAPER_TYPING')?.subtotal).toBe(500.0);
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
      expect(result.totalAmount).toBe(1000.0);
    });
  });

  describe('aggregateFromPaperRows', () => {
    it('should correctly sum paper row quantities with sharing proportions', () => {
      const papers: PaperRowDto[] = [
        {
          id: 'paper-1',
          title: 'Fluid Dynamics',
          settingShare: {
            isShared: true,
            totalQuestions: 5,
            questionsClaimed: 3,
          },
          markingShare: {
            isShared: true,
            totalQuestions: 5,
            questionsClaimed: 3,
          },
          scriptCount: 100,
          typedPageCount: 4,
        },
      ];

      const aggregated = service.aggregateFromPaperRows(papers);
      expect(aggregated.paperSettingCount).toBe(0.6);
      expect(aggregated.scriptMarkingCount).toBe(60);
      expect(aggregated.paperTypingPages).toBe(4);
    });
  });

  describe('getApprovedRates', () => {
    it('should return approved circular rates structure according to UGC 981/681/636', () => {
      const rates = service.getApprovedRates();
      expect(rates.circularReference).toBe(FeeCalculationService.CIRCULAR_REFERENCE);
      expect(rates.rates.PAPER_SETTING.rate).toBe(1200.0);
      expect(rates.rates.SCRIPT_MARKING.rate).toBe(100.0);
      expect(rates.rates.PAPER_TYPING.rate).toBe(100.0);
      expect(rates.rates.CONTINUOUS_ASSESSMENT.rate).toBe(25.0);
      expect(rates.rates.DISSERTATION_UNDERGRAD.rate).toBe(600.0);
    });
  });
});
