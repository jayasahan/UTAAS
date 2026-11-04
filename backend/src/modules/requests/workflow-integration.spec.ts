import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaperMarkingClaimService } from './services/paper-marking-claim.service';
import { WorkflowStateMachineService } from './services/workflow-state-machine.service';
import { TrackingHistoryService } from './services/tracking-history.service';
import { FeeCalculationService } from './services/fee-calculation.service';
import { TrackingNumberService } from './services/tracking-number.service';
import { ExamPaperStructureService } from './services/exam-paper-structure.service';
import { Request, RequestStatus } from '../../database/entities/request.entity';
import { RequestType } from '../../database/entities/request-type.entity';
import { WorkflowTemplate } from '../../database/entities/workflow-template.entity';
import { RequestStageHistory, StageAction } from '../../database/entities/request-stage-history.entity';
import { AuditEvent } from '../../database/entities/audit-event.entity';
import { User, UserRole } from '../../database/entities/user.entity';
import { WorkflowActionType } from './dto/transition-action.dto';

describe('Workflow & Request Engine Integration Suite (TC-WF-01 to TC-WF-10)', () => {
  let claimService: PaperMarkingClaimService;
  let workflowService: WorkflowStateMachineService;
  let trackingHistoryService: TrackingHistoryService;
  let feeService: FeeCalculationService;

  let mockRequestRepo: any;
  let mockRequestTypeRepo: any;
  let mockTemplateRepo: any;
  let mockStageHistoryRepo: any;
  let mockAuditEventRepo: any;
  let mockUserRepo: any;

  // University Test Actors
  const lecturerA = {
    id: 'lecturer-a-uuid',
    email: 'lecturer.a@eng.ruh.ac.lk',
    fullName: 'Dr. Kamal Perera',
    role: UserRole.LECTURER,
    departmentId: 'dept-com',
    department: { id: 'dept-com', code: 'COM', name: 'Computer Engineering' },
    isActive: true,
  } as User;

  const lecturerB = {
    id: 'lecturer-b-uuid',
    email: 'lecturer.b@eng.ruh.ac.lk',
    fullName: 'Dr. Suneth Silva',
    role: UserRole.LECTURER,
    departmentId: 'dept-com',
    department: { id: 'dept-com', code: 'COM', name: 'Computer Engineering' },
    isActive: true,
  } as User;

  const hodComputer = {
    id: 'hod-com-uuid',
    email: 'hod.computer@eng.ruh.ac.lk',
    fullName: 'Prof. Sunimal Silva',
    role: UserRole.HOD,
    departmentId: 'dept-com',
    department: { id: 'dept-com', code: 'COM', name: 'Computer Engineering' },
    isActive: true,
  } as User;

  const hodCivil = {
    id: 'hod-civ-uuid',
    email: 'hod.civil@eng.ruh.ac.lk',
    fullName: 'Prof. Ananda Bandara',
    role: UserRole.HOD,
    departmentId: 'dept-civ',
    department: { id: 'dept-civ', code: 'CIV', name: 'Civil Engineering' },
    isActive: true,
  } as User;

  const facultyDean = {
    id: 'dean-uuid',
    email: 'dean@eng.ruh.ac.lk',
    fullName: 'Prof. Nimal Wickramasinghe',
    role: UserRole.DEAN,
    departmentId: null,
    isActive: true,
  } as User;

  const examOfficer = {
    id: 'exam-officer-uuid',
    email: 'exam.officer@eng.ruh.ac.lk',
    fullName: 'Mr. Sarath Bandara',
    role: UserRole.EXAMINATION_OFFICER,
    departmentId: null,
    isActive: true,
  } as User;

  const financeOfficer = {
    id: 'finance-officer-uuid',
    email: 'finance.officer@eng.ruh.ac.lk',
    fullName: 'Mrs. Chandrika Fernando',
    role: UserRole.FINANCIAL_OFFICER,
    departmentId: null,
    isActive: true,
  } as User;

  const asstBursar = {
    id: 'asst-bursar-uuid',
    email: 'asst.bursar@eng.ruh.ac.lk',
    fullName: 'Mr. Rohan Jayasuriya',
    role: UserRole.ASSISTANT_BURSAR,
    departmentId: null,
    isActive: true,
  } as User;

  beforeEach(async () => {
    mockRequestRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
      create: jest.fn().mockImplementation((val) => val),
    };
    mockRequestTypeRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'rt-pm', code: 'PAPER_MARKING', name: 'Paper Marking' }),
    };
    mockTemplateRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'wt-pm',
        version: 1,
        stages: [
          { order: 0, stageKey: 'SUBMISSION', stageName: 'Lecturer Submission', requiredRole: UserRole.LECTURER },
          { order: 1, stageKey: 'HEAD_OF_DEPARTMENT', stageName: 'HOD Review', requiredRole: UserRole.HOD },
          { order: 2, stageKey: 'DEAN', stageName: 'Dean Approval', requiredRole: UserRole.DEAN },
          { order: 3, stageKey: 'EXAMINATION_OFFICE', stageName: 'Exam Office Check', requiredRole: UserRole.EXAMINATION_OFFICER },
          { order: 4, stageKey: 'FINANCIAL_OFFICE', stageName: 'Finance Audit', requiredRole: UserRole.FINANCIAL_OFFICER },
          { order: 5, stageKey: 'ASSISTANT_BURSAR', stageName: 'Assistant Bursar Settlement', requiredRole: UserRole.ASSISTANT_BURSAR },
        ],
      }),
    };
    mockStageHistoryRepo = {
      save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
      create: jest.fn().mockImplementation((val) => val),
    };
    mockAuditEventRepo = {
      save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
      create: jest.fn().mockImplementation((val) => val),
    };
    mockUserRepo = {
      findOne: jest.fn(),
    };

    const mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => {
        const manager = {
          findOne: jest.fn(),
          save: jest.fn().mockImplementation((entity, val) => Promise.resolve(val)),
          create: jest.fn().mockImplementation((entity, val) => val),
        };
        return await cb(manager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaperMarkingClaimService,
        WorkflowStateMachineService,
        TrackingHistoryService,
        FeeCalculationService,
        {
          provide: TrackingNumberService,
          useValue: {
            generateTrackingNumber: jest.fn().mockResolvedValue('UTR-2026-0001'),
          },
        },
        { provide: getRepositoryToken(Request), useValue: mockRequestRepo },
        { provide: getRepositoryToken(RequestType), useValue: mockRequestTypeRepo },
        { provide: getRepositoryToken(WorkflowTemplate), useValue: mockTemplateRepo },
        { provide: getRepositoryToken(RequestStageHistory), useValue: mockStageHistoryRepo },
        { provide: getRepositoryToken(AuditEvent), useValue: mockAuditEventRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: ExamPaperStructureService, useValue: { validateAndEnforcePaperQuotas: jest.fn().mockResolvedValue([]), getPaperStructureWithClaims: jest.fn() } },
      ],
    }).compile();

    claimService = module.get<PaperMarkingClaimService>(PaperMarkingClaimService);
    workflowService = module.get<WorkflowStateMachineService>(WorkflowStateMachineService);
    trackingHistoryService = module.get<TrackingHistoryService>(TrackingHistoryService);
    feeService = module.get<FeeCalculationService>(FeeCalculationService);
  });

  describe('TC-WF-01: Claim Creation & Draft Persistence', () => {
    it('should save claim draft without activating workflow approval stages', async () => {
      const claimDto = {
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

      const draft = await claimService.saveDraft(lecturerA, claimDto);

      expect(draft.status).toBe(RequestStatus.DRAFT);
      expect(draft.currentStageKey).toBe('DRAFT');
      expect(draft.totalAmount).toBe(11200.0);
    });
  });

  describe('TC-WF-05: Department Boundary Isolation (HOD Check)', () => {
    it('should block Civil Engineering HOD from approving Computer Engineering claim with 403 Forbidden', async () => {
      const request: any = {
        id: 'req-com-1',
        trackingNumber: 'UTR-2026-0001',
        applicantId: lecturerA.id,
        applicant: lecturerA,
        status: RequestStatus.UNDER_REVIEW,
        currentStageKey: 'HEAD_OF_DEPARTMENT',
        stageHistory: [
          {
            stageKey: 'HEAD_OF_DEPARTMENT',
            stageOrder: 1,
            requiredRole: UserRole.HOD,
          },
          {
            stageKey: 'DEAN',
            stageOrder: 2,
            requiredRole: UserRole.DEAN,
          },
        ],
      };

      const dataSource = (workflowService as any).dataSource;
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const mgr = { findOne: jest.fn().mockResolvedValue(request) };
        return await cb(mgr);
      });

      await expect(
        workflowService.executeTransition('req-com-1', hodCivil, {
          action: WorkflowActionType.APPROVE,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('TC-WF-06: IDOR Protection on Tracking & Claim Data', () => {
    it('should block Lecturer B from inspecting Lecturer A tracking details with 403 Forbidden', async () => {
      const request: any = {
        id: 'req-com-1',
        trackingNumber: 'UTR-2026-0001',
        applicantId: lecturerA.id,
        applicant: lecturerA,
        status: RequestStatus.UNDER_REVIEW,
        currentStageKey: 'HEAD_OF_DEPARTMENT',
        stageHistory: [],
      };

      mockRequestRepo.findOne.mockResolvedValue(request);

      await expect(
        trackingHistoryService.getTrackingInfo('req-com-1', lecturerB),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow Lecturer A to inspect their own tracking details', async () => {
      const request: any = {
        id: 'req-com-1',
        trackingNumber: 'UTR-2026-0001',
        applicantId: lecturerA.id,
        applicant: lecturerA,
        status: RequestStatus.UNDER_REVIEW,
        currentStageKey: 'HEAD_OF_DEPARTMENT',
        totalAmount: 15500.0,
        stageHistory: [
          {
            stageKey: 'HEAD_OF_DEPARTMENT',
            stageOrder: 1,
            stageName: 'HOD Review',
            requiredRole: UserRole.HOD,
            action: StageAction.PENDING,
          },
        ],
      };

      mockRequestRepo.findOne.mockResolvedValue(request);

      const tracking = await trackingHistoryService.getTrackingInfo('req-com-1', lecturerA);
      expect(tracking.trackingNumber).toBe('UTR-2026-0001');
      expect(tracking.status).toBe(RequestStatus.UNDER_REVIEW);
    });
  });

  describe('TC-WF-07: Faculty-Wide Reviewer Exemption', () => {
    it('should allow Dean, Exam Officer, Finance Officer, and Bursar to review claims without department blocks', async () => {
      const request: any = {
        id: 'req-com-1',
        applicantId: lecturerA.id,
        applicant: lecturerA,
        status: RequestStatus.UNDER_REVIEW,
        currentStageKey: 'DEAN',
        stageHistory: [
          {
            stageKey: 'DEAN',
            stageOrder: 2,
            requiredRole: UserRole.DEAN,
          },
          {
            stageKey: 'EXAMINATION_OFFICE',
            stageOrder: 3,
            requiredRole: UserRole.EXAMINATION_OFFICER,
          },
        ],
      };

      const dataSource = (workflowService as any).dataSource;
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const mgr = {
          findOne: jest.fn().mockResolvedValue(request),
          save: jest.fn().mockImplementation((e, v) => Promise.resolve(v)),
          create: jest.fn().mockImplementation((e, v) => v),
        };
        return await cb(mgr);
      });

      const updated = await workflowService.executeTransition('req-com-1', facultyDean, {
        action: WorkflowActionType.APPROVE,
        comments: 'Faculty executive approval granted.',
      });

      expect(updated.currentStageKey).toBe('EXAMINATION_OFFICE');
    });
  });

  describe('TC-WF-08: Tamper-Proof Fee Recalculation', () => {
    it('should strictly recompute fees based on circular rates regardless of inputs', () => {
      const calculation = feeService.calculateClaimFees({
        paperSettingCount: 2, // 2 * 3500 = 7000
        paperModerationCount: 1, // 1 * 2000 = 2000
        scriptMarkingCount: 50, // 50 * 120 = 6000
        practicalAssessmentHours: 4, // 4 * 500 = 2000
        secondMarkingCount: 10, // 10 * 60 = 600
      });

      expect(calculation.totalAmount).toBe(10000.0);
    });
  });

  describe('TC-WF-09: Direct Link / Query Interaction', () => {
    it('should record direct query communication in audit trail without altering stage state', async () => {
      const request: any = {
        id: 'req-com-1',
        applicantId: lecturerA.id,
        applicant: lecturerA,
        status: RequestStatus.UNDER_REVIEW,
        currentStageKey: 'EXAMINATION_OFFICE',
        stageHistory: [],
      };

      const dataSource = (workflowService as any).dataSource;
      let recordedAudit: any;

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const mgr = {
          findOne: jest.fn().mockResolvedValue(request),
          create: jest.fn().mockImplementation((e, v) => {
            recordedAudit = v;
            return v;
          }),
          save: jest.fn().mockImplementation((e, v) => Promise.resolve(v)),
        };
        return await cb(mgr);
      });

      const res = await workflowService.executeTransition('req-com-1', lecturerA, {
        action: WorkflowActionType.DIRECT_QUERY,
        comments: 'Can you verify if attendance sheet for hall 3 was received?',
      });

      expect(res.currentStageKey).toBe('EXAMINATION_OFFICE');
      expect(res.status).toBe(RequestStatus.UNDER_REVIEW);
      expect(recordedAudit.actionType).toBe('DIRECT_QUERY');
    });
  });

  describe('TC-WF-04: Non-Linear Return & Direct Resubmission', () => {
    it('should allow exam officer to return claim, saving returningOfficerId, and lecturer to resubmit directly back', async () => {
      const request: any = {
        id: 'req-com-1',
        applicantId: lecturerA.id,
        applicant: lecturerA,
        status: RequestStatus.UNDER_REVIEW,
        currentStageKey: 'EXAMINATION_OFFICE',
        returningOfficerId: null,
        stageHistory: [
          {
            stageKey: 'EXAMINATION_OFFICE',
            stageOrder: 3,
            requiredRole: UserRole.EXAMINATION_OFFICER,
          },
        ],
      };

      const dataSource = (workflowService as any).dataSource;

      // Step 1: Exam Officer returns claim
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const mgr = {
          findOne: jest.fn().mockResolvedValue(request),
          save: jest.fn().mockImplementation((e, v) => Promise.resolve(v)),
          create: jest.fn().mockImplementation((e, v) => v),
        };
        return await cb(mgr);
      });

      const returned = await workflowService.executeTransition('req-com-1', examOfficer, {
        action: WorkflowActionType.REJECT_RETURN,
        targetReturnRole: UserRole.LECTURER,
        comments: 'Marks discrepancy in question 3. Please correct.',
      });

      expect(returned.status).toBe(RequestStatus.RETURNED_FOR_CORRECTION);
      expect(returned.returningOfficerId).toBe(examOfficer.id);

      // Step 2: Lecturer resubmits directly back to Exam Officer
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const mgr = {
          findOne: jest.fn().mockImplementation((e, opts) => {
            if (e === Request) return Promise.resolve(returned);
            if (e === User) return Promise.resolve(examOfficer);
            return null;
          }),
          save: jest.fn().mockImplementation((e, v) => Promise.resolve(v)),
          create: jest.fn().mockImplementation((e, v) => v),
        };
        return await cb(mgr);
      });

      const resubmitted = await workflowService.executeTransition('req-com-1', lecturerA, {
        action: WorkflowActionType.RESUBMIT,
        comments: 'Updated script count and re-attached marking schedule.',
      });

      expect(resubmitted.status).toBe(RequestStatus.UNDER_REVIEW);
      expect(resubmitted.currentStageKey).toBe('EXAMINATION_OFFICE');
      expect(resubmitted.returningOfficerId).toBeNull();
    });
  });
});
