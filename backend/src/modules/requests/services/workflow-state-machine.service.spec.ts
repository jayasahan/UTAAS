import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { WorkflowStateMachineService } from './workflow-state-machine.service';
import { FeeCalculationService } from './fee-calculation.service';
import { Request, RequestStatus } from '../../../database/entities/request.entity';
import { RequestStageHistory, StageAction } from '../../../database/entities/request-stage-history.entity';
import { AuditEvent } from '../../../database/entities/audit-event.entity';
import { User, UserRole } from '../../../database/entities/user.entity';
import { WorkflowActionType } from '../dto/transition-action.dto';

describe('WorkflowStateMachineService', () => {
  let service: WorkflowStateMachineService;
  let mockRequestRepo: any;
  let mockStageHistoryRepo: any;
  let mockAuditEventRepo: any;
  let mockUserRepo: any;
  let mockDataSource: any;

  const mockApplicant: User = {
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

  const mockHod: User = {
    id: 'user-hod-1',
    email: 'hod.computer@eng.ruh.ac.lk',
    fullName: 'Prof. Sunimal Silva',
    role: UserRole.HOD,
    departmentId: 'dept-com-1',
    department: { id: 'dept-com-1', code: 'COM' } as any,
    isActive: true,
    requests: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDean = {
    id: 'user-dean-1',
    email: 'dean@eng.ruh.ac.lk',
    fullName: 'Prof. Nimal Wickramasinghe',
    role: UserRole.DEAN,
    departmentId: null,
    department: null as any,
    isActive: true,
    requests: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockFinanceOfficer = {
    id: 'user-finance-1',
    email: 'finance.officer@eng.ruh.ac.lk',
    fullName: 'Mrs. Chandrika Fernando',
    role: UserRole.FINANCIAL_OFFICER,
    departmentId: null,
    department: null as any,
    isActive: true,
    requests: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockBursar = {
    id: 'user-bursar-1',
    email: 'asst.bursar@eng.ruh.ac.lk',
    fullName: 'Mr. Rohan Jayasuriya',
    role: UserRole.ASSISTANT_BURSAR,
    departmentId: null,
    department: null as any,
    isActive: true,
    requests: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockExamOfficer = {
    id: 'user-exam-1',
    email: 'exam.officer@eng.ruh.ac.lk',
    fullName: 'Mr. Anura Fernando',
    role: UserRole.EXAMINATION_OFFICER,
    departmentId: null,
    department: null as any,
    isActive: true,
    requests: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  function createSampleRequest(currentStageKey = 'HEAD_OF_DEPARTMENT', status = RequestStatus.UNDER_REVIEW): Request {
    return {
      id: 'req-uuid-1',
      trackingNumber: 'UTR-2026-0001',
      requestTypeId: 'pm-type',
      workflowTemplateId: 'wf-template-1',
      applicantId: mockApplicant.id,
      applicant: mockApplicant,
      status,
      currentStageKey,
      totalAmount: 15500.0,
      returningOfficerId: null,
      returningOfficer: null,
      formData: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      requestType: {} as any,
      workflowTemplate: {} as any,
      auditEvents: [],
      stageHistory: [
        {
          id: 'stage-0',
          stageKey: 'SUBMISSION',
          stageName: 'Lecturer Submission',
          stageOrder: 0,
          requiredRole: UserRole.LECTURER,
          action: StageAction.APPROVED,
          actorId: mockApplicant.id,
        } as RequestStageHistory,
        {
          id: 'stage-1',
          stageKey: 'HEAD_OF_DEPARTMENT',
          stageName: 'HOD Recommendation',
          stageOrder: 1,
          requiredRole: UserRole.HOD,
          action: StageAction.PENDING,
          actorId: null,
        } as RequestStageHistory,
        {
          id: 'stage-2',
          stageKey: 'DEAN',
          stageName: 'Dean Approval',
          stageOrder: 2,
          requiredRole: UserRole.DEAN,
          action: StageAction.PENDING,
          actorId: null,
        } as RequestStageHistory,
        {
          id: 'stage-3',
          stageKey: 'EXAMINATION_OFFICE',
          stageName: 'Exam Office Verification',
          stageOrder: 3,
          requiredRole: UserRole.EXAMINATION_OFFICER,
          action: StageAction.PENDING,
          actorId: null,
        } as RequestStageHistory,
        {
          id: 'stage-4',
          stageKey: 'FINANCIAL_OFFICE',
          stageName: 'Financial Office Audit',
          stageOrder: 4,
          requiredRole: UserRole.FINANCIAL_OFFICER,
          action: StageAction.PENDING,
          actorId: null,
        } as RequestStageHistory,
        {
          id: 'stage-5',
          stageKey: 'ASSISTANT_BURSAR',
          stageName: 'Assistant Bursar Settlement',
          stageOrder: 5,
          requiredRole: UserRole.ASSISTANT_BURSAR,
          action: StageAction.PENDING,
          actorId: null,
        } as RequestStageHistory,
      ],
    } as Request;
  }

  beforeEach(async () => {
    mockRequestRepo = { findOne: jest.fn() };
    mockStageHistoryRepo = { save: jest.fn() };
    mockAuditEventRepo = { save: jest.fn() };
    mockUserRepo = { findOne: jest.fn() };

    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => {
        const mockManager = {
          findOne: jest.fn(),
          save: jest.fn().mockImplementation((entity, val) => Promise.resolve(val)),
          create: jest.fn().mockImplementation((entity, dto) => dto),
        };
        return await cb(mockManager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowStateMachineService,
        { provide: getRepositoryToken(Request), useValue: mockRequestRepo },
        { provide: getRepositoryToken(RequestStageHistory), useValue: mockStageHistoryRepo },
        { provide: getRepositoryToken(AuditEvent), useValue: mockAuditEventRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: FeeCalculationService, useClass: FeeCalculationService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<WorkflowStateMachineService>(WorkflowStateMachineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeTransition - APPROVE', () => {
    it('should advance HOD to DEAN stage when approved by HOD', async () => {
      const request = createSampleRequest('HEAD_OF_DEPARTMENT');

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(request),
          save: jest.fn().mockImplementation((entity, val) => Promise.resolve(val)),
          create: jest.fn().mockImplementation((entity, val) => val),
        };
        return await cb(mockManager);
      });

      const updated = await service.executeTransition(request.id, mockHod, {
        action: WorkflowActionType.APPROVE,
        comments: 'Course load and exam duties recommended.',
      });

      expect(updated.currentStageKey).toBe('DEAN');
    });

    it('should throw ForbiddenException if actor role does not match required stage role', async () => {
      const request = createSampleRequest('HEAD_OF_DEPARTMENT');

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(request),
        };
        return await cb(mockManager);
      });

      await expect(
        service.executeTransition(request.id, mockApplicant, {
          action: WorkflowActionType.APPROVE,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if HOD tries to approve request from another department', async () => {
      const request = createSampleRequest('HEAD_OF_DEPARTMENT');
      const otherDeptHod: User = {
        ...mockHod,
        id: 'hod-civ-1',
        departmentId: 'dept-civ-2',
      };

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(request),
        };
        return await cb(mockManager);
      });

      await expect(
        service.executeTransition(request.id, otherDeptHod, {
          action: WorkflowActionType.APPROVE,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

    it('should allow HOD to directly edit claim form data and recalculate fees during approval', async () => {
      const request = createSampleRequest('HEAD_OF_DEPARTMENT');

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(request),
          save: jest.fn().mockImplementation((entity, val) => Promise.resolve(val)),
          create: jest.fn().mockImplementation((entity, val) => val),
        };
        return await cb(mockManager);
      });

      const updated = await service.executeTransition(request.id, mockHod, {
        action: WorkflowActionType.APPROVE,
        comments: 'Verified and corrected paper count.',
        updatedFormData: {
          items: {
            paperSettingCount: 2,
            scriptMarkingCount: 50,
          },
        },
      });

      // 2 * 3500 + 50 * 120 = 7000 + 6000 = 13000
      expect(updated.totalAmount).toBe(13000);
      expect(updated.formData.feeCalculation.totalAmount).toBe(13000);
      expect(updated.currentStageKey).toBe('DEAN');
    });

    it('should throw ForbiddenException if reviewer other than HOD provides updatedFormData during approval', async () => {
      const request = createSampleRequest('DEAN');

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(request),
        };
        return await cb(mockManager);
      });

      await expect(
        service.executeTransition(request.id, mockDean, {
          action: WorkflowActionType.APPROVE,
          comments: 'Dean cannot edit directly.',
          updatedFormData: { items: { paperSettingCount: 1 } },
        }),
      ).rejects.toThrow(ForbiddenException);
    });

  describe('executeTransition - APPROVE_PAYOUT & SETTLE', () => {
    it('should allow Financial Officer to approve payout and route to Assistant Bursar', async () => {
      const request = createSampleRequest('FINANCIAL_OFFICE');

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(request),
          save: jest.fn().mockImplementation((entity, val) => Promise.resolve(val)),
          create: jest.fn().mockImplementation((entity, val) => val),
        };
        return await cb(mockManager);
      });

      const updated = await service.executeTransition(request.id, mockFinanceOfficer, {
        action: WorkflowActionType.APPROVE_PAYOUT,
        comments: 'Vote approved.',
      });

      expect(updated.currentStageKey).toBe('ASSISTANT_BURSAR');
    });

    it('should allow Assistant Bursar to settle request', async () => {
      const request = createSampleRequest('ASSISTANT_BURSAR');

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(request),
          save: jest.fn().mockImplementation((entity, val) => Promise.resolve(val)),
          create: jest.fn().mockImplementation((entity, val) => val),
        };
        return await cb(mockManager);
      });

      const updated = await service.executeTransition(request.id, mockBursar, {
        action: WorkflowActionType.SETTLE,
        comments: 'Disbursed via bank transfer.',
      });

      expect(updated.status).toBe(RequestStatus.SETTLED);
      expect(updated.currentStageKey).toBe('SETTLED');
    });
  });

  describe('executeTransition - REJECT_RETURN & RESUBMIT', () => {
    it('should return claim to Lecturer and record returningOfficerId', async () => {
      const request = createSampleRequest('HEAD_OF_DEPARTMENT');

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(request),
          save: jest.fn().mockImplementation((entity, val) => Promise.resolve(val)),
          create: jest.fn().mockImplementation((entity, val) => val),
        };
        return await cb(mockManager);
      });

      const updated = await service.executeTransition(request.id, mockHod, {
        action: WorkflowActionType.REJECT_RETURN,
        comments: 'Please attach second examiner marks sheet.',
      });

      expect(updated.status).toBe(RequestStatus.RETURNED_FOR_CORRECTION);
      expect(updated.currentStageKey).toBe('LECTURER_CORRECTION');
      expect(updated.returningOfficerId).toBe(mockHod.id);
    });

    it('should allow original applicant to resubmit returned claim', async () => {
      const request = createSampleRequest('LECTURER_CORRECTION', RequestStatus.RETURNED_FOR_CORRECTION);
      request.returningOfficerId = mockHod.id;

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockImplementation((entity, opts) => {
            if (entity === Request) return Promise.resolve(request);
            if (entity === User) return Promise.resolve(mockHod);
            return null;
          }),
          save: jest.fn().mockImplementation((entity, val) => Promise.resolve(val)),
          create: jest.fn().mockImplementation((entity, val) => val),
        };
        return await cb(mockManager);
      });

      const updated = await service.executeTransition(request.id, mockApplicant, {
        action: WorkflowActionType.RESUBMIT,
        comments: 'Marks sheet attached.',
      });

      expect(updated.status).toBe(RequestStatus.UNDER_REVIEW);
      expect(updated.currentStageKey).toBe('HEAD_OF_DEPARTMENT');
      expect(updated.returningOfficerId).toBeNull();
    });

    it('should throw ForbiddenException if another user tries to resubmit', async () => {
      const request = createSampleRequest('LECTURER_CORRECTION', RequestStatus.RETURNED_FOR_CORRECTION);
      const otherLecturer = { ...mockApplicant, id: 'different-lecturer' };

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(request),
        };
        return await cb(mockManager);
      });

      await expect(
        service.executeTransition(request.id, otherLecturer, {
          action: WorkflowActionType.RESUBMIT,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if return comments are missing or empty', async () => {
      const request = createSampleRequest('HEAD_OF_DEPARTMENT');

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(request),
        };
        return await cb(mockManager);
      });

      await expect(
        service.executeTransition(request.id, mockHod, {
          action: WorkflowActionType.REJECT_RETURN,
          comments: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if HOD tries to return to a target other than LECTURER', async () => {
      const request = createSampleRequest('HEAD_OF_DEPARTMENT');

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(request),
        };
        return await cb(mockManager);
      });

      await expect(
        service.executeTransition(request.id, mockHod, {
          action: WorkflowActionType.REJECT_RETURN,
          comments: 'Invalid return target',
          targetReturnRole: UserRole.DEAN,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow Exam Officer to return claim to HOD by default or when targetReturnRole is HOD', async () => {
      const request = createSampleRequest('EXAMINATION_OFFICE');

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(request),
          save: jest.fn().mockImplementation((entity, val) => Promise.resolve(val)),
          create: jest.fn().mockImplementation((entity, val) => val),
        };
        return await cb(mockManager);
      });

      const updated = await service.executeTransition(request.id, mockExamOfficer, {
        action: WorkflowActionType.REJECT_RETURN,
        comments: 'Please verify grading sheet with HOD.',
        targetReturnRole: UserRole.HOD,
      });

      expect(updated.status).toBe(RequestStatus.RETURNED_FOR_CORRECTION);
      expect(updated.currentStageKey).toBe('HEAD_OF_DEPARTMENT');
      expect(updated.returningOfficerId).toBe(mockExamOfficer.id);
    });

    it('should allow Exam Officer to return claim directly to LECTURER when targetReturnRole is LECTURER', async () => {
      const request = createSampleRequest('EXAMINATION_OFFICE');

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(request),
          save: jest.fn().mockImplementation((entity, val) => Promise.resolve(val)),
          create: jest.fn().mockImplementation((entity, val) => val),
        };
        return await cb(mockManager);
      });

      const updated = await service.executeTransition(request.id, mockExamOfficer, {
        action: WorkflowActionType.REJECT_RETURN,
        comments: 'Missing signature on appointment document.',
        targetReturnRole: UserRole.LECTURER,
      });

      expect(updated.status).toBe(RequestStatus.RETURNED_FOR_CORRECTION);
      expect(updated.currentStageKey).toBe('LECTURER_CORRECTION');
    });

    it('should throw BadRequestException if subsequent stage returns to an invalid role', async () => {
      const request = createSampleRequest('EXAMINATION_OFFICE');

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(request),
        };
        return await cb(mockManager);
      });

      await expect(
        service.executeTransition(request.id, mockExamOfficer, {
          action: WorkflowActionType.REJECT_RETURN,
          comments: 'Invalid return target role',
          targetReturnRole: UserRole.FINANCIAL_OFFICER,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should recalculate server fees when applicant resubmits with updatedFormData', async () => {
      const request = createSampleRequest('LECTURER_CORRECTION', RequestStatus.RETURNED_FOR_CORRECTION);
      request.returningOfficerId = mockHod.id;

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockImplementation((entity, opts) => {
            if (entity === Request) return Promise.resolve(request);
            if (entity === User) return Promise.resolve(mockHod);
            return null;
          }),
          save: jest.fn().mockImplementation((entity, val) => Promise.resolve(val)),
          create: jest.fn().mockImplementation((entity, val) => val),
        };
        return await cb(mockManager);
      });

      const updated = await service.executeTransition(request.id, mockApplicant, {
        action: WorkflowActionType.RESUBMIT,
        comments: 'Updated paper count per recommendation.',
        updatedFormData: {
          items: {
            paperSettingCount: 1,
            scriptMarkingCount: 100,
          },
        },
      });

      // 3500 + 12000 = 15500
      expect(updated.totalAmount).toBe(15500);
      expect(updated.formData.feeCalculation.totalAmount).toBe(15500);
      expect(updated.status).toBe(RequestStatus.UNDER_REVIEW);
      expect(updated.currentStageKey).toBe('HEAD_OF_DEPARTMENT');
    });

    it('should throw BadRequestException if updatedFormData results in zero or negative totalAmount', async () => {
      const request = createSampleRequest('LECTURER_CORRECTION', RequestStatus.RETURNED_FOR_CORRECTION);

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(request),
        };
        return await cb(mockManager);
      });

      await expect(
        service.executeTransition(request.id, mockApplicant, {
          action: WorkflowActionType.RESUBMIT,
          comments: 'Empty counts.',
          updatedFormData: {
            items: {
              paperSettingCount: 0,
              scriptMarkingCount: 0,
            },
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow HOD to resubmit a claim returned to HEAD_OF_DEPARTMENT', async () => {
      const request = createSampleRequest('HEAD_OF_DEPARTMENT', RequestStatus.RETURNED_FOR_CORRECTION);
      request.returningOfficerId = mockExamOfficer.id;

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockImplementation((entity, opts) => {
            if (entity === Request) return Promise.resolve(request);
            if (entity === User) return Promise.resolve(mockExamOfficer);
            return null;
          }),
          save: jest.fn().mockImplementation((entity, val) => Promise.resolve(val)),
          create: jest.fn().mockImplementation((entity, val) => val),
        };
        return await cb(mockManager);
      });

      const updated = await service.executeTransition(request.id, mockHod, {
        action: WorkflowActionType.RESUBMIT,
        comments: 'HOD verified attendance sheet with department records.',
      });

      expect(updated.status).toBe(RequestStatus.UNDER_REVIEW);
      expect(updated.currentStageKey).toBe('EXAMINATION_OFFICE');
    });

    it('should throw ForbiddenException if HOD from different department tries to resubmit claim', async () => {
      const request = createSampleRequest('HEAD_OF_DEPARTMENT', RequestStatus.RETURNED_FOR_CORRECTION);
      const foreignHod = { ...mockHod, id: 'foreign-hod', departmentId: 'dept-other' } as User;

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(request),
        };
        return await cb(mockManager);
      });

      await expect(
        service.executeTransition(request.id, foreignHod, {
          action: WorkflowActionType.RESUBMIT,
          comments: 'Cross-department attempt',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
