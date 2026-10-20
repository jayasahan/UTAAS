import { Test, TestingModule } from '@nestjs/testing';
import { PaperMarkingController } from './paper-marking.controller';
import { PaperMarkingClaimService } from '../services/paper-marking-claim.service';
import { FeeCalculationService } from '../services/fee-calculation.service';
import { UserRole } from '../../../database/entities/user.entity';

describe('PaperMarkingController', () => {
  let controller: PaperMarkingController;
  let mockClaimService: any;
  let mockFeeService: any;

  const mockUser = {
    id: 'user-1',
    role: UserRole.LECTURER,
  } as any;

  const mockDto = {
    metadata: {
      academicYear: '2023/2024',
      semester: 'Semester 1',
      degreeProgramme: 'BScEng Computer Engineering',
      courseCode: 'EC5060',
      courseTitle: 'Software Engineering',
      examType: 'End Semester',
      examinerRole: 'First Examiner',
    },
    items: {
      paperSettingCount: 1,
      paperModerationCount: 0,
      scriptMarkingCount: 100,
      practicalAssessmentHours: 0,
      secondMarkingCount: 0,
    },
  };

  beforeEach(async () => {
    mockClaimService = {
      saveDraft: jest.fn().mockResolvedValue({ id: 'draft-id', status: 'DRAFT' }),
      submitClaim: jest.fn().mockResolvedValue({ id: 'submitted-id', status: 'UNDER_REVIEW' }),
      getClaimById: jest.fn().mockResolvedValue({ id: 'claim-123' }),
    };

    mockFeeService = {
      getApprovedRates: jest.fn().mockReturnValue({ rates: {} }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaperMarkingController],
      providers: [
        { provide: PaperMarkingClaimService, useValue: mockClaimService },
        { provide: FeeCalculationService, useValue: mockFeeService },
      ],
    }).compile();

    controller = module.get<PaperMarkingController>(PaperMarkingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getApprovedRates', () => {
    it('should call feeCalculationService.getApprovedRates', () => {
      controller.getApprovedRates();
      expect(mockFeeService.getApprovedRates).toHaveBeenCalled();
    });
  });

  describe('saveDraft', () => {
    it('should call claimService.saveDraft', async () => {
      const res = await controller.saveDraft(mockUser, mockDto);
      expect(mockClaimService.saveDraft).toHaveBeenCalledWith(mockUser, mockDto, undefined);
      expect(res.status).toBe('DRAFT');
    });
  });

  describe('submitClaim', () => {
    it('should call claimService.submitClaim', async () => {
      const res = await controller.submitClaim(mockUser, mockDto);
      expect(mockClaimService.submitClaim).toHaveBeenCalledWith(mockUser, mockDto, undefined);
      expect(res.status).toBe('UNDER_REVIEW');
    });
  });

  describe('getClaimById', () => {
    it('should call claimService.getClaimById', async () => {
      const res = await controller.getClaimById('claim-123', mockUser);
      expect(mockClaimService.getClaimById).toHaveBeenCalledWith('claim-123', mockUser);
      expect(res.id).toBe('claim-123');
    });
  });
});
