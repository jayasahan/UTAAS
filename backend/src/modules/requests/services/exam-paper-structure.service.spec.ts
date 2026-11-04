import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { ExamPaperStructureService } from './exam-paper-structure.service';
import { ExamPaperStructure } from '../../../database/entities/exam-paper-structure.entity';
import { Request, RequestStatus } from '../../../database/entities/request.entity';
import { User, UserRole } from '../../../database/entities/user.entity';

describe('ExamPaperStructureService', () => {
  let service: ExamPaperStructureService;
  let mockPaperStructureRepo: any;
  let mockRequestRepo: any;

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
    };

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
      // Second examiner attempts to claim 3 questions when only 2 remain!
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
});
