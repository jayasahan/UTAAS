import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaperMarkingClaimService } from './paper-marking-claim.service';
import { FeeCalculationService } from './fee-calculation.service';
import { TrackingNumberService } from './tracking-number.service';
import { Request, RequestStatus } from '../../../database/entities/request.entity';
import { RequestType } from '../../../database/entities/request-type.entity';
import { WorkflowTemplate } from '../../../database/entities/workflow-template.entity';
import { RequestStageHistory } from '../../../database/entities/request-stage-history.entity';
import { AuditEvent } from '../../../database/entities/audit-event.entity';
import { User, UserRole } from '../../../database/entities/user.entity';

describe('PaperMarkingClaimService', () => {
  let service: PaperMarkingClaimService;
  let mockRequestRepo: any;
  let mockRequestTypeRepo: any;
  let mockWorkflowTemplateRepo: any;
  let mockStageHistoryRepo: any;
  let mockAuditEventRepo: any;
  let mockFeeService: Partial<FeeCalculationService>;
  let mockTrackingService: Partial<TrackingNumberService>;
  let mockDataSource: any;

  const mockUser: User = {
    id: 'user-lecturer-1',
    email: 'lecturer@eng.ruh.ac.lk',
    fullName: 'Dr. Kamal Perera',
    role: UserRole.LECTURER,
    departmentId: 'dept-com-1',
    department: { id: 'dept-com-1', code: 'COM' } as any,
    isActive: true,
    requests: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRequestType: RequestType = {
    id: 'req-type-pm',
    code: 'PAPER_MARKING',
    name: 'Paper Setting & Marking Claim',
    description: 'Claim remuneration',
    isActive: true,
    workflowTemplates: [],
    requests: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTemplate: WorkflowTemplate = {
    id: 'wf-template-1',
    requestTypeId: 'req-type-pm',
    requestType: mockRequestType,
    version: 1,
    stages: [
      { order: 0, stageKey: 'SUBMISSION', stageName: 'Lecturer Submission', requiredRole: UserRole.LECTURER },
      { order: 1, stageKey: 'HEAD_OF_DEPARTMENT', stageName: 'HOD Review', requiredRole: UserRole.HOD },
      { order: 2, stageKey: 'DEAN', stageName: 'Dean Approval', requiredRole: UserRole.DEAN },
    ],
    isActive: true,
    requests: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleDto = {
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
    mockRequestRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'req-id-1', ...entity })),
    };
    mockRequestTypeRepo = {
      findOne: jest.fn().mockResolvedValue(mockRequestType),
    };
    mockWorkflowTemplateRepo = {
      findOne: jest.fn().mockResolvedValue(mockTemplate),
    };
    mockStageHistoryRepo = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockResolvedValue([]),
    };
    mockAuditEventRepo = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockResolvedValue({}),
    };

    mockFeeService = {
      calculateClaimFees: jest.fn().mockReturnValue({
        currency: 'LKR',
        totalAmount: 15500.0,
        items: [{ key: 'PAPER_SETTING', count: 1, subtotal: 3500.0 }],
      }),
      aggregateFromPaperRows: jest.fn().mockReturnValue({
        paperSettingCount: 1,
        paperModerationCount: 0,
        scriptMarkingCount: 100,
        practicalAssessmentHours: 0,
        secondMarkingCount: 0,
      }),
    };

    mockTrackingService = {
      generateTrackingNumber: jest.fn().mockResolvedValue('UTR-2026-0001'),
    };

    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (callback) => {
        const mockManager = {
          findOne: jest.fn().mockImplementation((entity, opts) => {
            if (entity === Request) {
              return Promise.resolve({
                id: 'req-id-1',
                trackingNumber: 'UTR-2026-0001',
                status: RequestStatus.UNDER_REVIEW,
                currentStageKey: 'HEAD_OF_DEPARTMENT',
                totalAmount: 15500.0,
                stageHistory: [],
                auditEvents: [],
              });
            }
            return null;
          }),
          create: jest.fn().mockImplementation((entity, dto) => ({ id: 'new-uuid', ...dto })),
          save: jest.fn().mockImplementation((entity, dto) => Promise.resolve(dto)),
        };
        return await callback(mockManager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaperMarkingClaimService,
        { provide: getRepositoryToken(Request), useValue: mockRequestRepo },
        { provide: getRepositoryToken(RequestType), useValue: mockRequestTypeRepo },
        { provide: getRepositoryToken(WorkflowTemplate), useValue: mockWorkflowTemplateRepo },
        { provide: getRepositoryToken(RequestStageHistory), useValue: mockStageHistoryRepo },
        { provide: getRepositoryToken(AuditEvent), useValue: mockAuditEventRepo },
        { provide: FeeCalculationService, useValue: mockFeeService },
        { provide: TrackingNumberService, useValue: mockTrackingService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<PaperMarkingClaimService>(PaperMarkingClaimService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('saveDraft', () => {
    it('should create and save a new draft request', async () => {
      const result = await service.saveDraft(mockUser, sampleDto);

      expect(mockFeeService.calculateClaimFees).toHaveBeenCalled();
      expect(mockTrackingService.generateTrackingNumber).toHaveBeenCalled();
      expect(mockRequestRepo.save).toHaveBeenCalled();
      expect(result.status).toBe(RequestStatus.DRAFT);
      expect(result.currentStageKey).toBe('DRAFT');
    });

    it('should allow saving partial drafts with only personal and academic details', async () => {
      (mockFeeService.calculateClaimFees as jest.Mock).mockReturnValue({
        currency: 'LKR',
        totalAmount: 0.0,
        items: [],
      });

      const partialDraft = {
        personal: {
          fullName: 'Dr. Kamal Perera',
          designation: 'Senior Lecturer',
        },
        academic: {
          academicYear: '2023/2024',
          semester: 'Semester 1',
          degreeProgramme: 'BScEng',
        },
      };

      const result = await service.saveDraft(mockUser, partialDraft as any);
      expect(mockRequestRepo.save).toHaveBeenCalled();
      expect(result.status).toBe(RequestStatus.DRAFT);
      expect(result.formData.personal.fullName).toBe('Dr. Kamal Perera');
      expect(result.formData.academic.academicYear).toBe('2023/2024');
    });

    it('should preserve multiple paper rows in formData when saving draft', async () => {
      const multiPaperDraft = {
        papers: [
          {
            id: 'paper-1',
            title: 'Software Engineering',
            settingCount: 1,
            scriptCount: 60,
          },
          {
            id: 'paper-2',
            title: 'Computer Networks',
            settingCount: 1,
            scriptCount: 60,
          },
        ],
      };

      const result = await service.saveDraft(mockUser, multiPaperDraft as any);
      expect(result.formData.papers).toHaveLength(2);
      expect(result.formData.papers[0].title).toBe('Software Engineering');
      expect(result.formData.papers[1].title).toBe('Computer Networks');
    });

    it('should allow saving intermediate corrections as draft on a returned claim', async () => {
      const existingReturnedClaim = {
        id: 'claim-returned-1',
        applicantId: mockUser.id,
        status: RequestStatus.RETURNED_FOR_CORRECTION,
        currentStageKey: 'LECTURER_CORRECTION',
        returningOfficerId: 'hod-1',
        totalAmount: 15500,
        formData: {
          supportingDocuments: [{ id: 'doc-1', name: 'appointment.pdf' }],
        },
      };

      mockRequestRepo.findOne.mockResolvedValue(existingReturnedClaim);
      (mockFeeService.calculateClaimFees as jest.Mock).mockReturnValue({
        currency: 'LKR',
        totalAmount: 12000.0,
        items: [],
      });

      const result = await service.saveDraft(mockUser, {
        metadata: { courseCode: 'EC5060', courseTitle: 'Software Engineering' },
      } as any, 'claim-returned-1');

      expect(result.status).toBe(RequestStatus.RETURNED_FOR_CORRECTION);
      expect(result.currentStageKey).toBe('LECTURER_CORRECTION');
      expect(result.totalAmount).toBe(12000.0);
      // Preserved existing documents
      expect(result.formData.supportingDocuments).toHaveLength(1);
      expect(result.formData.supportingDocuments[0].name).toBe('appointment.pdf');
    });

    it('should throw BadRequestException if trying to edit a claim that is UNDER_REVIEW', async () => {
      const existingUnderReview = {
        id: 'claim-under-review',
        applicantId: mockUser.id,
        status: RequestStatus.UNDER_REVIEW,
        currentStageKey: 'HEAD_OF_DEPARTMENT',
      };

      mockRequestRepo.findOne.mockResolvedValue(existingUnderReview);

      await expect(
        service.saveDraft(mockUser, sampleDto, 'claim-under-review'),
      ).rejects.toThrow('Cannot edit a claim that has already been submitted');
    });
  });

  describe('submitClaim', () => {
    it('should submit claim into workflow and transition to UNDER_REVIEW', async () => {
      const result = await service.submitClaim(mockUser, sampleDto);

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(result.status).toBe(RequestStatus.UNDER_REVIEW);
      expect(result.currentStageKey).toBe('HEAD_OF_DEPARTMENT');
    });

    it('should accept multi-paper rows and preserve them in formData on submission', async () => {
      const multiPaperClaim = {
        ...sampleDto,
        papers: [
          {
            id: 'paper-1',
            title: 'Operating Systems',
            settingCount: 1,
            scriptCount: 120,
          },
        ],
      };

      const result = await service.submitClaim(mockUser, multiPaperClaim as any);
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(result.status).toBe(RequestStatus.UNDER_REVIEW);
    });

    it('should throw BadRequestException if claim total amount is 0', async () => {
      (mockFeeService.calculateClaimFees as jest.Mock).mockReturnValue({
        currency: 'LKR',
        totalAmount: 0,
        items: [],
      });

      await expect(service.submitClaim(mockUser, sampleDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getClaimById', () => {
    it('should return claim if applicant matches lecturer', async () => {
      mockRequestRepo.findOne.mockResolvedValue({
        id: 'claim-123',
        applicantId: mockUser.id,
        applicant: mockUser,
      });

      const claim = await service.getClaimById('claim-123', mockUser);
      expect(claim.id).toBe('claim-123');
    });

    it('should throw ForbiddenException if another lecturer tries to access claim (IDOR protection)', async () => {
      mockRequestRepo.findOne.mockResolvedValue({
        id: 'claim-123',
        applicantId: 'different-lecturer-id',
        applicant: { id: 'different-lecturer-id' },
      });

      await expect(service.getClaimById('claim-123', mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if reviewer tries to access claim in DRAFT status', async () => {
      mockRequestRepo.findOne.mockResolvedValue({
        id: 'claim-draft',
        status: RequestStatus.DRAFT,
        applicantId: 'other-user',
        applicant: { id: 'other-user', departmentId: 'dept-com-1' },
      });

      const hodUser: User = { ...mockUser, id: 'hod-1', role: UserRole.HOD, departmentId: 'dept-com-1' };

      await expect(service.getClaimById('claim-draft', hodUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow applicant to access their own claim in DRAFT status', async () => {
      mockRequestRepo.findOne.mockResolvedValue({
        id: 'claim-draft',
        status: RequestStatus.DRAFT,
        applicantId: mockUser.id,
        applicant: mockUser,
      });

      const claim = await service.getClaimById('claim-draft', mockUser);
      expect(claim.id).toBe('claim-draft');
    });

    it('should throw ForbiddenException if HOD tries to access claim from another department', async () => {
      const hodUser: User = {
        ...mockUser,
        id: 'hod-1',
        role: UserRole.HOD,
        departmentId: 'dept-com-1',
      };

      mockRequestRepo.findOne.mockResolvedValue({
        id: 'claim-456',
        applicantId: 'civil-lecturer-id',
        applicant: { id: 'civil-lecturer-id', departmentId: 'dept-civ-2' },
      });

      await expect(service.getClaimById('claim-456', hodUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if HOD has missing departmentId (fail-closed)', async () => {
      const hodWithoutDept: User = {
        ...mockUser,
        id: 'hod-nodept',
        role: UserRole.HOD,
        departmentId: null as any,
      };

      mockRequestRepo.findOne.mockResolvedValue({
        id: 'claim-456',
        applicantId: 'lecturer-id',
        applicant: { id: 'lecturer-id', departmentId: 'dept-com-1' },
      });

      await expect(service.getClaimById('claim-456', hodWithoutDept)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if applicant has missing departmentId for HOD check (fail-closed)', async () => {
      const hodUser: User = {
        ...mockUser,
        id: 'hod-1',
        role: UserRole.HOD,
        departmentId: 'dept-com-1',
      };

      mockRequestRepo.findOne.mockResolvedValue({
        id: 'claim-456',
        applicantId: 'lecturer-id',
        applicant: { id: 'lecturer-id', departmentId: null as any },
      });

      await expect(service.getClaimById('claim-456', hodUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if claim does not exist', async () => {
      mockRequestRepo.findOne.mockResolvedValue(null);

      await expect(service.getClaimById('non-existent', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should allow HOD to access claim when request is at HEAD_OF_DEPARTMENT stage and department matches', async () => {
      const hodUser: User = { ...mockUser, id: 'hod-1', role: UserRole.HOD, departmentId: 'dept-com-1' };
      mockRequestRepo.findOne.mockResolvedValue({
        id: 'claim-hod-ok',
        applicantId: 'lecturer-id',
        applicant: { id: 'lecturer-id', departmentId: 'dept-com-1' },
        status: RequestStatus.UNDER_REVIEW,
        currentStageKey: 'HEAD_OF_DEPARTMENT',
        stageHistory: [
          { stageKey: 'HEAD_OF_DEPARTMENT', requiredRole: UserRole.HOD, enteredAt: new Date() },
        ],
      });

      const claim = await service.getClaimById('claim-hod-ok', hodUser);
      expect(claim.id).toBe('claim-hod-ok');
    });

    it('should allow reviewer (e.g. DEAN) to access claim when request is currently at DEAN stage', async () => {
      const deanUser: User = { ...mockUser, id: 'dean-1', role: UserRole.DEAN };
      mockRequestRepo.findOne.mockResolvedValue({
        id: 'claim-dean-ok',
        applicantId: 'lecturer-id',
        applicant: { id: 'lecturer-id', departmentId: 'dept-com-1' },
        status: RequestStatus.UNDER_REVIEW,
        currentStageKey: 'DEAN',
        stageHistory: [
          { stageKey: 'HEAD_OF_DEPARTMENT', requiredRole: UserRole.HOD, enteredAt: new Date(), completedAt: new Date() },
          { stageKey: 'DEAN', requiredRole: UserRole.DEAN, enteredAt: new Date() },
        ],
      });

      const claim = await service.getClaimById('claim-dean-ok', deanUser);
      expect(claim.id).toBe('claim-dean-ok');
    });

    it('should allow prior reviewer (e.g. HOD) to access claim when request has advanced to DEAN stage', async () => {
      const hodUser: User = { ...mockUser, id: 'hod-1', role: UserRole.HOD, departmentId: 'dept-com-1' };
      mockRequestRepo.findOne.mockResolvedValue({
        id: 'claim-adv',
        applicantId: 'lecturer-id',
        applicant: { id: 'lecturer-id', departmentId: 'dept-com-1' },
        status: RequestStatus.UNDER_REVIEW,
        currentStageKey: 'DEAN',
        stageHistory: [
          { stageKey: 'HEAD_OF_DEPARTMENT', requiredRole: UserRole.HOD, enteredAt: new Date(), completedAt: new Date() },
          { stageKey: 'DEAN', requiredRole: UserRole.DEAN, enteredAt: new Date() },
        ],
      });

      const claim = await service.getClaimById('claim-adv', hodUser);
      expect(claim.id).toBe('claim-adv');
    });

    it('should throw ForbiddenException if reviewer attempts to access claim that has not reached their stage', async () => {
      const bursarUser: User = { ...mockUser, id: 'bursar-1', role: UserRole.ASSISTANT_BURSAR };
      mockRequestRepo.findOne.mockResolvedValue({
        id: 'claim-early',
        applicantId: 'lecturer-id',
        applicant: { id: 'lecturer-id', departmentId: 'dept-com-1' },
        status: RequestStatus.UNDER_REVIEW,
        currentStageKey: 'HEAD_OF_DEPARTMENT',
        stageHistory: [
          { stageKey: 'HEAD_OF_DEPARTMENT', requiredRole: UserRole.HOD, enteredAt: new Date() },
          { stageKey: 'ASSISTANT_BURSAR', requiredRole: UserRole.ASSISTANT_BURSAR, enteredAt: null },
        ],
      });

      await expect(service.getClaimById('claim-early', bursarUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
