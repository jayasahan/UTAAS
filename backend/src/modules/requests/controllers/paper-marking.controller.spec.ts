import { Test, TestingModule } from '@nestjs/testing';
import { PaperMarkingController } from './paper-marking.controller';
import { PaperMarkingClaimService } from '../services/paper-marking-claim.service';
import { FeeCalculationService } from '../services/fee-calculation.service';
import { User, UserRole } from '../../../database/entities/user.entity';

describe('PaperMarkingController', () => {
  let controller: PaperMarkingController;
  let mockClaimService: Partial<PaperMarkingClaimService>;
  let mockFeeService: Partial<FeeCalculationService>;

  const mockUser: User = {
    id: 'user-1',
    email: 'lecturer@eng.ruh.ac.lk',
    fullName: 'Dr. Kamal Perera',
    role: UserRole.LECTURER,
    departmentId: 'dept-com',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  const mockDto: any = {
    metadata: {
      academicYear: '2023/2024',
      semester: 'Semester 1',
      degreeProgramme: 'BScEng (Hons) in Computer Engineering',
      courseCode: 'EC5060',
      courseTitle: 'Software Engineering',
      examType: 'End Semester Examination',
      examinerRole: 'First Examiner',
    },
    items: {
      paperSettingCount: 1,
      scriptMarkingCount: 100,
    },
  };

  beforeEach(async () => {
    mockClaimService = {
      saveDraft: jest.fn().mockResolvedValue({ id: 'draft-1', status: 'DRAFT' } as any),
      submitClaim: jest.fn().mockResolvedValue({ id: 'claim-1', status: 'UNDER_REVIEW' } as any),
      getClaimById: jest.fn().mockResolvedValue({ id: 'claim-123' } as any),
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

  describe('getFormDropdownOptions', () => {
    it('should return standardized dropdown choices for Engineering Faculty', () => {
      const options = controller.getFormDropdownOptions(mockUser);
      expect(options.academicYears).toBeDefined();
      expect(options.academicYears.length).toBeGreaterThan(0);
      expect(options.semesters).toContain('Semester 1');
      expect(options.degreeProgrammes).toContain('BScEng (Hons) in Computer Engineering');
      expect(options.examTypes).toContain('End Semester Examination');
      expect(options.examinerRoles).toContain('First Examiner (Setter)');
      expect(options.paperDurations).toBeDefined();
      expect(options.courseModules).toBeDefined();
      expect(options.courseModules.some((m) => m.code === 'EC5060')).toBe(true);
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
