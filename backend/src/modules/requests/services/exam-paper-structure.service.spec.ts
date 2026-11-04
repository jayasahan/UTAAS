import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ExamPaperStructureService } from './exam-paper-structure.service';
import { ExamPaperStructure } from '../../../database/entities/exam-paper-structure.entity';
import { Request, RequestStatus } from '../../../database/entities/request.entity';
import { RequestStageHistory, StageAction } from '../../../database/entities/request-stage-history.entity';
import { AuditEvent } from '../../../database/entities/audit-event.entity';
import { User, UserRole } from '../../../database/entities/user.entity';
import { FeeCalculationService } from './fee-calculation.service';

describe('ExamPaperStructureService', () => {
  let service: ExamPaperStructureService;
  let mockPaperStructureRepo: any;
  let mockRequestRepo: any;
  let mockStageHistoryRepo: any;
  let mockAuditEventRepo: any;
  let mockFeeService: any;
  let mockDataSource: any;

  const mockLecturer1: User = {
    id: 'lecturer-1',
    fullName: 'Dr. Hansana H.A.J.',
    email: 'hansana@eng.ruh.ac.lk',
    role: UserRole.LECTURER,
    departmentId: 'dept-eie',
  } as any;

  const mockLecturer2: User = {
    id: 'lecturer-2',
    fullName: 'Dr. Sunimal Silva',
    email: 'sunimal@eng.ruh.ac.lk',
    role: UserRole.LECTURER,
    departmentId: 'dept-eie',
  } as any;

  const mockHod: User = {
    id: 'hod-1',
    fullName: 'Prof. J.K. HOD',
    email: 'hod@eng.ruh.ac.lk',
    role: UserRole.HOD,
    departmentId: 'dept-eie',
  } as any;

  const sampleStructure: ExamPaperStructure = {
    id: 'structure-1',
    courseCode: 'EC5060',
    courseTitle: 'Software Engineering Project',
    academicYear: '2023/2024',
    semester: 'Semester 1',
    examType: 'End Semester Examination',
    paperType: 'ESSAY',
    paperDurationHours: 3,
    totalQuestions: 5,
    totalMcqQuestions: 0,
    totalCandidates: 100,
    essayWeightPercent: 100,
    mcqWeightPercent: 0,
    registeredById: 'lecturer-1',
    registeredByName: 'Dr. Hansana H.A.J.',
    registeredByEmail: 'hansana@eng.ruh.ac.lk',
    registeredBy: mockLecturer1,
    createdAt: new Date('2026-11-01T10:00:00Z'),
    updatedAt: new Date('2026-11-01T10:00:00Z'),
  };

  beforeEach(async () => {
    mockPaperStructureRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'structure-new-1', ...entity })),
    };

    mockRequestRepo = {
      createQueryBuilder: jest.fn(),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    mockStageHistoryRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    mockAuditEventRepo = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    mockFeeService = {
      calculateClaimFees: jest.fn().mockReturnValue({ totalAmount: 15000, items: [] }),
      aggregateFromPaperRows: jest.fn().mockReturnValue({}),
    };

    mockDataSource = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamPaperStructureService,
        {
          provide: getRepositoryToken(ExamPaperStructure),
          useValue: mockPaperStructureRepo,
        },
        {
          provide: getRepositoryToken(Request),
          useValue: mockRequestRepo,
        },
        {
          provide: getRepositoryToken(RequestStageHistory),
          useValue: mockStageHistoryRepo,
        },
        {
          provide: getRepositoryToken(AuditEvent),
          useValue: mockAuditEventRepo,
        },
        {
          provide: FeeCalculationService,
          useValue: mockFeeService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<ExamPaperStructureService>(ExamPaperStructureService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPaperStructureWithClaims', () => {
    it('should return exists: false when no paper structure is registered', async () => {
      mockPaperStructureRepo.findOne.mockResolvedValue(null);

      const res = await service.getPaperStructureWithClaims(
        'EC5060',
        '2023/2024',
        'Semester 1',
        'End Semester Examination',
      );

      expect(res.exists).toBe(false);
      expect(res.message).toContain('No examination paper structure registered yet');
    });

    it('should return structure and claim breakdown when structure exists', async () => {
      mockPaperStructureRepo.findOne.mockResolvedValue(sampleStructure);

      const mockQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'req-1',
            trackingNumber: 'UTR-2026-0001',
            applicantId: 'lecturer-1',
            applicant: mockLecturer1,
            status: RequestStatus.UNDER_REVIEW,
            formData: {
              metadata: { courseCode: 'EC5060' },
              papers: [
                {
                  courseCode: 'EC5060',
                  settingCount: 0,
                  settingShare: { isShared: true, questionsClaimed: 3, totalQuestions: 5 },
                  moderationCount: 1,
                  typedPageCount: 4,
                  scriptCount: 100,
                  markingShare: { isShared: true, questionsClaimed: 3, totalQuestions: 5 },
                },
              ],
            },
          },
        ]),
      };
      mockRequestRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const res = await service.getPaperStructureWithClaims(
        'EC5060',
        '2023/2024',
        'Semester 1',
        'End Semester Examination',
      );

      expect(res.exists).toBe(true);
      expect(res.paperStructure).toEqual(sampleStructure);
      expect(res.claimsBreakdown).toBeDefined();
      expect(res.claimsBreakdown.setting.claimedQuestions).toBe(3);
      expect(res.claimsBreakdown.setting.remainingQuestions).toBe(2);
      expect(res.claimsBreakdown.moderation.isClaimed).toBe(true);
      expect(res.claimsBreakdown.moderation.claimedBy).toBe('Dr. Hansana H.A.J.');
      expect(res.claimsBreakdown.typing.isClaimed).toBe(true);
      expect(res.claimsBreakdown.typing.typedPagesClaimed).toBe(4);
    });
  });

  describe('validateAndEnforcePaperQuotas', () => {
    it('should register first examiner structure when none exists', async () => {
      mockPaperStructureRepo.findOne.mockResolvedValue(null);

      const metadata = {
        courseCode: 'EC5060',
        courseTitle: 'Software Engineering Project',
        academicYear: '2023/2024',
        semester: 'Semester 1',
        examType: 'End Semester Examination',
      };
      const paperRows = [
        {
          courseCode: 'EC5060',
          title: 'Software Engineering Project',
          durationHours: 3,
          settingShare: { isShared: true, questionsClaimed: 3, totalQuestions: 5 },
          scriptCount: 100,
        },
      ];

      const result = await service.validateAndEnforcePaperQuotas(
        mockLecturer1,
        metadata,
        paperRows,
      );

      expect(mockPaperStructureRepo.save).toHaveBeenCalled();
      expect(result.length).toBe(1);
      expect(result[0].courseCode).toBe('EC5060');
      expect(result[0].registeredByName).toBe('Dr. Hansana H.A.J.');
      expect(result[0].totalQuestions).toBe(5);
    });

    it('should allow second examiner to claim remaining questions (e.g. 2 out of 5 when 3 claimed)', async () => {
      mockPaperStructureRepo.findOne.mockResolvedValue(sampleStructure);

      const mockQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'req-1',
            applicantId: 'lecturer-1',
            applicant: mockLecturer1,
            formData: {
              papers: [
                {
                  courseCode: 'EC5060',
                  settingShare: { isShared: true, questionsClaimed: 3, totalQuestions: 5 },
                },
              ],
            },
          },
        ]),
      };
      mockRequestRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const metadata = {
        courseCode: 'EC5060',
        academicYear: '2023/2024',
        semester: 'Semester 1',
        examType: 'End Semester Examination',
      };
      const paperRows = [
        {
          courseCode: 'EC5060',
          settingShare: { isShared: true, questionsClaimed: 2, totalQuestions: 5 },
        },
      ];

      await expect(
        service.validateAndEnforcePaperQuotas(mockLecturer2, metadata, paperRows),
      ).resolves.not.toThrow();
    });

    it('should reject second examiner when attempting to claim more questions than remaining', async () => {
      mockPaperStructureRepo.findOne.mockResolvedValue(sampleStructure);

      const mockQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'req-1',
            applicantId: 'lecturer-1',
            applicant: mockLecturer1,
            formData: {
              papers: [
                {
                  courseCode: 'EC5060',
                  settingShare: { isShared: true, questionsClaimed: 3, totalQuestions: 5 },
                },
              ],
            },
          },
        ]),
      };
      mockRequestRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const metadata = {
        courseCode: 'EC5060',
        academicYear: '2023/2024',
        semester: 'Semester 1',
        examType: 'End Semester Examination',
      };
      const paperRows = [
        {
          courseCode: 'EC5060',
          settingShare: { isShared: true, questionsClaimed: 3, totalQuestions: 5 },
        },
      ];

      await expect(
        service.validateAndEnforcePaperQuotas(mockLecturer2, metadata, paperRows),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate moderation claim by second examiner', async () => {
      mockPaperStructureRepo.findOne.mockResolvedValue(sampleStructure);

      const mockQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'req-1',
            applicantId: 'lecturer-1',
            applicant: mockLecturer1,
            formData: {
              papers: [
                {
                  courseCode: 'EC5060',
                  moderationCount: 1,
                },
              ],
            },
          },
        ]),
      };
      mockRequestRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const metadata = {
        courseCode: 'EC5060',
        academicYear: '2023/2024',
        semester: 'Semester 1',
        examType: 'End Semester Examination',
      };
      const paperRows = [
        {
          courseCode: 'EC5060',
          moderationCount: 1,
        },
      ];

      await expect(
        service.validateAndEnforcePaperQuotas(mockLecturer2, metadata, paperRows),
      ).rejects.toThrow(/moderation.*already been claimed/i);
    });

    it('should reject duplicate typing claim by second examiner', async () => {
      mockPaperStructureRepo.findOne.mockResolvedValue(sampleStructure);

      const mockQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'req-1',
            applicantId: 'lecturer-1',
            applicant: mockLecturer1,
            formData: {
              papers: [
                {
                  courseCode: 'EC5060',
                  typedPageCount: 3,
                },
              ],
            },
          },
        ]),
      };
      mockRequestRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const metadata = {
        courseCode: 'EC5060',
        academicYear: '2023/2024',
        semester: 'Semester 1',
        examType: 'End Semester Examination',
      };
      const paperRows = [
        {
          courseCode: 'EC5060',
          typedPageCount: 2,
        },
      ];

      await expect(
        service.validateAndEnforcePaperQuotas(mockLecturer2, metadata, paperRows),
      ).rejects.toThrow(/typing.*already been claimed/i);
    });
  });

  describe('updatePaperStructureAndResetApproval', () => {
    it('should reject unauthorized lecturer from modifying paper structure', async () => {
      mockPaperStructureRepo.findOne.mockResolvedValue({
        ...sampleStructure,
        registeredById: 'lecturer-other',
      });

      const dto = {
        courseCode: 'EC5060',
        academicYear: '2023/2024',
        semester: 'Semester 1',
        examType: 'End Semester Examination',
        totalQuestions: 4,
        correctionReason: 'Wrong initial count',
      };

      await expect(
        service.updatePaperStructureAndResetApproval(mockLecturer2, dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow first lecturer to edit structure and reset claims to Step 1 (HOD)', async () => {
      mockPaperStructureRepo.findOne.mockResolvedValue({
        ...sampleStructure,
        registeredById: mockLecturer1.id,
      });

      const mockClaim: any = {
        id: 'claim-1',
        applicantId: mockLecturer1.id,
        status: RequestStatus.UNDER_REVIEW,
        currentStageKey: 'DEAN', // was advanced to Dean
        formData: {
          papers: [
            {
              courseCode: 'EC5060',
              settingShare: { isShared: true, questionsClaimed: 3, totalQuestions: 5 },
            },
          ],
        },
      };

      const mockQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockClaim]),
      };
      mockRequestRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const mockStages = [
        { stageOrder: 0, stageKey: 'SUBMISSION', action: StageAction.APPROVED },
        { stageOrder: 1, stageKey: 'HEAD_OF_DEPARTMENT', action: StageAction.APPROVED, actorId: 'hod-1' },
        { stageOrder: 2, stageKey: 'DEAN', action: StageAction.PENDING },
      ];
      mockStageHistoryRepo.find.mockResolvedValue(mockStages);

      const dto = {
        courseCode: 'EC5060',
        academicYear: '2023/2024',
        semester: 'Semester 1',
        examType: 'End Semester Examination',
        totalQuestions: 4,
        correctionReason: 'Paper actually consisted of 4 compulsory questions',
      };

      const res = await service.updatePaperStructureAndResetApproval(mockLecturer1, dto);

      expect(res.resetClaimsCount).toBe(1);
      expect(mockClaim.currentStageKey).toBe('HEAD_OF_DEPARTMENT');
      expect(mockClaim.formData.papers[0].settingShare.totalQuestions).toBe(4);
      expect(mockStageHistoryRepo.save).toHaveBeenCalled();
      expect(mockAuditEventRepo.save).toHaveBeenCalled();
    });

    it('should reject reducing total questions below what other examiners have already claimed', async () => {
      mockPaperStructureRepo.findOne.mockResolvedValue({
        ...sampleStructure,
        totalQuestions: 5,
        registeredById: mockLecturer1.id,
      });

      // Another examiner claimed 3 questions
      const otherClaim = {
        id: 'claim-2',
        applicantId: 'lecturer-2',
        applicant: mockLecturer2,
        formData: {
          papers: [
            {
              courseCode: 'EC5060',
              settingShare: { isShared: true, questionsClaimed: 3, totalQuestions: 5 },
            },
          ],
        },
      };

      const mockQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([otherClaim]),
      };
      mockRequestRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const dto = {
        courseCode: 'EC5060',
        academicYear: '2023/2024',
        semester: 'Semester 1',
        examType: 'End Semester Examination',
        totalQuestions: 2, // trying to set to 2 when another examiner already claimed 3!
        correctionReason: 'Mistake',
      };

      await expect(
        service.updatePaperStructureAndResetApproval(mockLecturer1, dto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('dividePaperProportionByHod', () => {
    it('should reject non-HOD/non-Admin user from setting proportion division', async () => {
      const dto = {
        courseCode: 'EC5060',
        academicYear: '2023/2024',
        semester: 'Semester 1',
        examType: 'End Semester Examination',
        essayWeightPercent: 60,
        mcqWeightPercent: 40,
      };

      await expect(
        service.dividePaperProportionByHod(mockLecturer1, dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject division if percentages do not sum to 100', async () => {
      const dto = {
        courseCode: 'EC5060',
        academicYear: '2023/2024',
        semester: 'Semester 1',
        examType: 'End Semester Examination',
        essayWeightPercent: 60,
        mcqWeightPercent: 30, // 90%
      };

      await expect(
        service.dividePaperProportionByHod(mockHod, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow HOD to divide proportions and dispatch to lecturers for consensus', async () => {
      mockPaperStructureRepo.findOne.mockResolvedValue({
        ...sampleStructure,
      });

      const mockClaim = {
        id: 'claim-1',
        applicantId: mockLecturer1.id,
        currentStageKey: 'HEAD_OF_DEPARTMENT',
        formData: {
          metadata: { courseCode: 'EC5060' },
          papers: [{ courseCode: 'EC5060' }],
        },
      };
      const mockQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockClaim]),
      };
      mockRequestRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const dto = {
        courseCode: 'EC5060',
        academicYear: '2023/2024',
        semester: 'Semester 1',
        examType: 'End Semester Examination',
        essayWeightPercent: 60,
        mcqWeightPercent: 40,
        comments: 'Essay 60%, MCQ 40%',
      };

      const res = await service.dividePaperProportionByHod(mockHod, dto);

      expect(res.hodProportionDivision.essayWeightPercent).toBe(60);
      expect(res.hodProportionDivision.mcqWeightPercent).toBe(40);
      expect(res.hodProportionDivision.status).toBe('AWAITING_LECTURER_CONSENSUS');
      expect(mockClaim.currentStageKey).toBe('LECTURER_PROPORTION_CONSENSUS');
      expect(mockRequestRepo.save).toHaveBeenCalledWith(mockClaim);
      expect(mockAuditEventRepo.save).toHaveBeenCalled();
    });
  });

  describe('recordLecturerProportionConsensus', () => {
    it('should reject disagreement response without mandatory comments', async () => {
      mockPaperStructureRepo.findOne.mockResolvedValue({
        ...sampleStructure,
        hodProportionDivision: {
          essayWeightPercent: 60,
          mcqWeightPercent: 40,
          status: 'AWAITING_LECTURER_CONSENSUS',
          responses: [],
        },
      });

      const dto = {
        courseCode: 'EC5060',
        academicYear: '2023/2024',
        semester: 'Semester 1',
        examType: 'End Semester Examination',
        agreed: false,
        comments: '', // missing comment!
      };

      await expect(
        service.recordLecturerProportionConsensus(mockLecturer1, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return claim back to HOD when examiner disagrees with proposed proportion', async () => {
      const structureWithDivision = {
        ...sampleStructure,
        hodProportionDivision: {
          essayWeightPercent: 60,
          mcqWeightPercent: 40,
          status: 'AWAITING_LECTURER_CONSENSUS',
          responses: [],
        },
      };
      mockPaperStructureRepo.findOne.mockResolvedValue(structureWithDivision);

      const mockClaim = {
        id: 'claim-1',
        applicantId: mockLecturer1.id,
        currentStageKey: 'LECTURER_PROPORTION_CONSENSUS',
        formData: {
          metadata: { courseCode: 'EC5060' },
          papers: [{ courseCode: 'EC5060' }],
        },
      };
      const mockQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockClaim]),
      };
      mockRequestRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const dto = {
        courseCode: 'EC5060',
        academicYear: '2023/2024',
        semester: 'Semester 1',
        examType: 'End Semester Examination',
        agreed: false,
        comments: 'Essay component was significantly more demanding, should be 75/25',
      };

      const res = await service.recordLecturerProportionConsensus(mockLecturer1, dto);

      expect(res.status).toBe('DISAGREED_RETURNED_TO_HOD');
      expect(mockClaim.currentStageKey).toBe('HEAD_OF_DEPARTMENT');
      expect(mockAuditEventRepo.save).toHaveBeenCalled();
    });

    it('should reach consensus when all examiners agree', async () => {
      const structureWithDivision = {
        ...sampleStructure,
        essayWeightPercent: 60,
        mcqWeightPercent: 40,
        hodProportionDivision: {
          essayWeightPercent: 60,
          mcqWeightPercent: 40,
          status: 'AWAITING_LECTURER_CONSENSUS',
          responses: [],
        },
      };
      mockPaperStructureRepo.findOne.mockResolvedValue(structureWithDivision);

      const mockClaim = {
        id: 'claim-1',
        applicantId: mockLecturer1.id,
        currentStageKey: 'LECTURER_PROPORTION_CONSENSUS',
        formData: {
          papers: [
            {
              courseCode: 'EC5060',
              combinedPaperConfig: {} as any,
            },
          ],
        },
      };
      const mockQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockClaim]),
      };
      mockRequestRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const dto = {
        courseCode: 'EC5060',
        academicYear: '2023/2024',
        semester: 'Semester 1',
        examType: 'End Semester Examination',
        agreed: true,
        comments: 'Agreed with 60/40',
      };

      const res = await service.recordLecturerProportionConsensus(mockLecturer1, dto);

      expect(res.status).toBe('CONSENSUS_REACHED');
      expect(mockClaim.currentStageKey).toBe('HEAD_OF_DEPARTMENT');
      expect(mockClaim.formData.papers[0].combinedPaperConfig.essayWeightPercent).toBe(60);
      expect(mockClaim.formData.papers[0].combinedPaperConfig.mcqWeightPercent).toBe(40);
      expect(mockFeeService.calculateClaimFees).toHaveBeenCalled();
    });
  });
});
