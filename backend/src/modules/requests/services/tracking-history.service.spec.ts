import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TrackingHistoryService } from './tracking-history.service';
import { Request, RequestStatus } from '../../../database/entities/request.entity';
import { AuditEvent } from '../../../database/entities/audit-event.entity';
import { StageAction } from '../../../database/entities/request-stage-history.entity';
import { User, UserRole } from '../../../database/entities/user.entity';

describe('TrackingHistoryService', () => {
  let service: TrackingHistoryService;
  let mockRequestRepo: any;
  let mockAuditEventRepo: any;
  let mockQueryBuilder: any;

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

  const sampleRequest: Request = {
    id: 'req-uuid-1',
    trackingNumber: 'UTR-2026-0001',
    requestTypeId: 'rt-pm',
    workflowTemplateId: 'wt-pm',
    applicantId: mockApplicant.id,
    applicant: mockApplicant,
    status: RequestStatus.UNDER_REVIEW,
    currentStageKey: 'HEAD_OF_DEPARTMENT',
    totalAmount: 23500.0,
    returningOfficerId: null,
    returningOfficer: null,
    formData: { metadata: { courseCode: 'EC5060' } },
    createdAt: new Date('2026-10-21T00:00:00Z'),
    updatedAt: new Date('2026-10-21T00:00:00Z'),
    requestType: { name: 'Paper Setting & Marking Claim' } as any,
    workflowTemplate: {} as any,
    stageHistory: [
      {
        stageKey: 'SUBMISSION',
        stageName: 'Lecturer Submission',
        stageOrder: 0,
        requiredRole: UserRole.LECTURER,
        action: StageAction.APPROVED,
        actorId: mockApplicant.id,
        enteredAt: new Date('2026-10-21T00:00:00Z'),
        completedAt: new Date('2026-10-21T00:00:00Z'),
        comments: 'Initial submission',
      } as any,
      {
        stageKey: 'HEAD_OF_DEPARTMENT',
        stageName: 'Head of Department Recommendation',
        stageOrder: 1,
        requiredRole: UserRole.HOD,
        action: StageAction.PENDING,
        actorId: null,
        enteredAt: new Date('2026-10-21T00:00:00Z'),
        completedAt: null,
        comments: null,
      } as any,
      {
        stageKey: 'DEAN',
        stageName: 'Dean Faculty Approval',
        stageOrder: 2,
        requiredRole: UserRole.DEAN,
        action: StageAction.PENDING,
        actorId: null,
      } as any,
    ],
    auditEvents: [
      {
        id: 'evt-1',
        actionType: 'SUBMIT',
        actorName: 'Dr. Kamal Perera',
        actorRole: 'LECTURER',
        previousStatus: 'DRAFT',
        newStatus: 'UNDER_REVIEW',
        fieldDiff: { totalAmount: 23500.0 },
        comment: 'Initial claim submission',
        createdAt: new Date('2026-10-21T00:00:00Z'),
      } as any,
    ],
  };

  const sampleReviewedRequest: Request = {
    ...sampleRequest,
    id: 'req-reviewed-1',
    trackingNumber: 'UTR-2026-0002',
    status: RequestStatus.UNDER_REVIEW,
    stageHistory: [
      {
        stageKey: 'SUBMISSION',
        stageName: 'Lecturer Submission',
        stageOrder: 0,
        requiredRole: UserRole.LECTURER,
        action: StageAction.APPROVED,
        actorId: mockApplicant.id,
        enteredAt: new Date('2026-10-21T00:00:00Z'),
        completedAt: new Date('2026-10-21T00:00:00Z'),
        comments: 'Initial submission',
      } as any,
      {
        stageKey: 'HEAD_OF_DEPARTMENT',
        stageName: 'Head of Department Recommendation',
        stageOrder: 1,
        requiredRole: UserRole.HOD,
        action: StageAction.APPROVED,
        actorId: 'hod-1',
        enteredAt: new Date('2026-10-21T00:00:00Z'),
        completedAt: new Date('2026-10-21T01:00:00Z'),
        comments: 'Recommended for approval',
      } as any,
    ],
    auditEvents: [
      {
        id: 'evt-2',
        actionType: 'HOD_RECOMMEND',
        actorName: 'Prof. Perera',
        actorRole: 'HOD',
        previousStatus: 'UNDER_REVIEW',
        newStatus: 'UNDER_REVIEW',
        fieldDiff: null,
        comment: 'Recommended for approval',
        createdAt: new Date('2026-10-21T01:00:00Z'),
      } as any,
    ],
  };

  beforeEach(async () => {
    mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[sampleRequest], 1]),
      getMany: jest.fn().mockResolvedValue([sampleRequest]),
    };

    mockRequestRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[sampleRequest], 1]),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    mockAuditEventRepo = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackingHistoryService,
        { provide: getRepositoryToken(Request), useValue: mockRequestRepo },
        { provide: getRepositoryToken(AuditEvent), useValue: mockAuditEventRepo },
      ],
    }).compile();

    service = module.get<TrackingHistoryService>(TrackingHistoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTrackingInfo', () => {
    it('should return tracking progression and stage stepper for applicant', async () => {
      mockRequestRepo.findOne.mockResolvedValue(sampleRequest);

      const tracking = await service.getTrackingInfo('req-uuid-1', mockApplicant);

      expect(tracking.trackingNumber).toBe('UTR-2026-0001');
      expect(tracking.status).toBe(RequestStatus.UNDER_REVIEW);
      expect(tracking.currentStage.key).toBe('HEAD_OF_DEPARTMENT');
      expect(tracking.stages).toHaveLength(3);
      expect(tracking.stages[0].status).toBe('APPROVED');
      expect(tracking.stages[1].status).toBe('IN_PROGRESS');
      expect(tracking.stages[2].status).toBe('PENDING');
    });

    it('should throw ForbiddenException if another lecturer attempts access (IDOR protection)', async () => {
      mockRequestRepo.findOne.mockResolvedValue(sampleRequest);
      const otherLecturer: User = { ...mockApplicant, id: 'different-lecturer-id' };

      await expect(service.getTrackingInfo('req-uuid-1', otherLecturer)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if reviewer attempts to view request in DRAFT state', async () => {
      const draftRequest = { ...sampleRequest, status: RequestStatus.DRAFT };
      mockRequestRepo.findOne.mockResolvedValue(draftRequest);
      const hodUser: User = { ...mockApplicant, id: 'hod-1', role: UserRole.HOD, departmentId: 'dept-com-1' };

      await expect(service.getTrackingInfo('req-uuid-1', hodUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow applicant to view their own request in DRAFT state', async () => {
      const draftRequest = { ...sampleRequest, status: RequestStatus.DRAFT };
      mockRequestRepo.findOne.mockResolvedValue(draftRequest);

      const tracking = await service.getTrackingInfo('req-uuid-1', mockApplicant);
      expect(tracking.status).toBe(RequestStatus.DRAFT);
    });

    it('should throw ForbiddenException if HOD has missing departmentId (fail-closed)', async () => {
      mockRequestRepo.findOne.mockResolvedValue(sampleRequest);
      const hodWithoutDept: User = { ...mockApplicant, id: 'hod-nodept', role: UserRole.HOD, departmentId: null as any };

      await expect(service.getTrackingInfo('req-uuid-1', hodWithoutDept)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if applicant has missing departmentId for HOD check (fail-closed)', async () => {
      const reqNoDept: Request = {
        ...sampleRequest,
        applicant: { ...mockApplicant, departmentId: null as any },
      };
      mockRequestRepo.findOne.mockResolvedValue(reqNoDept);
      const hodUser: User = { ...mockApplicant, id: 'hod-1', role: UserRole.HOD, departmentId: 'dept-com-1' };

      await expect(service.getTrackingInfo('req-uuid-1', hodUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if request does not exist', async () => {
      mockRequestRepo.findOne.mockResolvedValue(null);

      await expect(service.getTrackingInfo('invalid-id', mockApplicant)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should allow HOD to access tracking info when request is at HEAD_OF_DEPARTMENT stage and department matches', async () => {
      const hodUser: User = { ...mockApplicant, id: 'hod-1', role: UserRole.HOD, departmentId: 'dept-com-1' };
      mockRequestRepo.findOne.mockResolvedValue(sampleRequest);

      const tracking = await service.getTrackingInfo('req-uuid-1', hodUser);
      expect(tracking.trackingNumber).toBe(sampleRequest.trackingNumber);
    });

    it('should throw ForbiddenException if reviewer (e.g. DEAN) attempts to access tracking when request is still at HOD stage', async () => {
      const deanUser: User = { ...mockApplicant, id: 'dean-1', role: UserRole.DEAN };
      mockRequestRepo.findOne.mockResolvedValue(sampleRequest);

      await expect(service.getTrackingInfo('req-uuid-1', deanUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getAuditHistory', () => {
    it('should return chronological audit events', async () => {
      mockRequestRepo.findOne.mockResolvedValue(sampleRequest);

      const history = await service.getAuditHistory('req-uuid-1', mockApplicant);

      expect(history.requestId).toBe('req-uuid-1');
      expect(history.events).toHaveLength(1);
      expect(history.events[0].actionType).toBe('SUBMIT');
      expect(history.events[0].actorName).toBe('Dr. Kamal Perera');
    });
  });

  describe('getMyRequests', () => {
    it('should return paginated list of claims submitted by user', async () => {
      const result = await service.getMyRequests(mockApplicant, 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].trackingNumber).toBe('UTR-2026-0001');
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getPendingQueue', () => {
    it('should return pending queue for HOD scoped to department', async () => {
      const hodUser: User = {
        ...mockApplicant,
        id: 'hod-1',
        role: UserRole.HOD,
        departmentId: 'dept-com-1',
      };

      const result = await service.getPendingQueue(hodUser, 1, 10);

      expect(mockRequestRepo.createQueryBuilder).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should return empty queue for LECTURER role', async () => {
      const result = await service.getPendingQueue(mockApplicant);
      expect(result.data).toHaveLength(0);
    });

    it('should return empty queue for HOD when departmentId is missing (fail-closed)', async () => {
      const hodWithoutDept: User = {
        ...mockApplicant,
        id: 'hod-nodept',
        role: UserRole.HOD,
        departmentId: null as any,
      };

      const result = await service.getPendingQueue(hodWithoutDept, 1, 10);
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('getReviewHistory', () => {
    it('should return review history with summary counts for HOD', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([sampleReviewedRequest]);
      const hodUser: User = {
        ...mockApplicant,
        id: 'hod-1',
        role: UserRole.HOD,
        departmentId: 'dept-com-1',
      };

      const result = await service.getReviewHistory(hodUser, 1, 10);

      expect(mockRequestRepo.createQueryBuilder).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('req-reviewed-1');
      expect(result.data[0].trackingNumber).toBe('UTR-2026-0002');
      expect(result.data[0].decision).toBe('APPROVED');
      expect(result.data[0].events).toHaveLength(1);
      expect(result.meta.summaryCounts.approved).toBe(1);
      expect(result.meta.summaryCounts.returned).toBe(0);
      expect(result.meta.summaryCounts.rejected).toBe(0);
    });

    it('should return empty review history for LECTURER role', async () => {
      const result = await service.getReviewHistory(mockApplicant, 1, 10);
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.summaryCounts.approved).toBe(0);
    });

    it('should return empty review history if HOD lacks departmentId (fail-closed)', async () => {
      const hodWithoutDept: User = {
        ...mockApplicant,
        id: 'hod-nodept',
        role: UserRole.HOD,
        departmentId: null as any,
      };

      const result = await service.getReviewHistory(hodWithoutDept, 1, 10);
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.summaryCounts.approved).toBe(0);
    });

    it('should filter by decision correctly', async () => {
      const returnedRequest: Request = {
        ...sampleReviewedRequest,
        id: 'req-returned-1',
        status: RequestStatus.RETURNED_FOR_CORRECTION,
        stageHistory: [
          sampleReviewedRequest.stageHistory[0],
          {
            ...sampleReviewedRequest.stageHistory[1],
            action: StageAction.REJECT_RETURN,
            comments: 'Please correct course code',
          },
        ],
      };
      mockQueryBuilder.getMany.mockResolvedValue([sampleReviewedRequest, returnedRequest]);
      const hodUser: User = {
        ...mockApplicant,
        id: 'hod-1',
        role: UserRole.HOD,
        departmentId: 'dept-com-1',
      };

      const result = await service.getReviewHistory(hodUser, 1, 10, 'RETURNED_FOR_CORRECTION');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('req-returned-1');
      expect(result.data[0].decision).toBe('RETURNED_FOR_CORRECTION');
      expect(result.meta.total).toBe(1);
      expect(result.meta.summaryCounts.approved).toBe(1);
      expect(result.meta.summaryCounts.returned).toBe(1);
    });

    it('QA-04 regression: should preserve APPROVED decision for officer when a later officer returns request for correction', async () => {
      // HOD approved stage 1, but downstream Examination Officer returned the claim at stage 2
      const claimReturnedDownstream: Request = {
        ...sampleReviewedRequest,
        id: 'req-downstream-returned',
        status: RequestStatus.RETURNED_FOR_CORRECTION, // live request status is RETURNED_FOR_CORRECTION
        stageHistory: [
          sampleReviewedRequest.stageHistory[0],
          {
            stageKey: 'HEAD_OF_DEPARTMENT',
            stageName: 'Head of Department Recommendation',
            stageOrder: 1,
            requiredRole: UserRole.HOD,
            action: StageAction.APPROVED, // HOD approved this claim!
            actorId: 'hod-1',
            enteredAt: new Date('2026-10-21T00:00:00Z'),
            completedAt: new Date('2026-10-21T01:00:00Z'),
            comments: 'Recommended for approval',
          } as any,
          {
            stageKey: 'EXAMINATION_OFFICE',
            stageName: 'Examination Office Verification',
            stageOrder: 2,
            requiredRole: UserRole.EXAMINATION_OFFICER,
            action: StageAction.REJECT_RETURN, // Exam officer returned it
            actorId: 'exam-officer-99',
            enteredAt: new Date('2026-10-21T01:00:00Z'),
            completedAt: new Date('2026-10-21T02:00:00Z'),
            comments: 'Missing signature on schedule',
          } as any,
        ],
      };

      mockQueryBuilder.getMany.mockResolvedValue([claimReturnedDownstream]);
      const hodUser: User = {
        ...mockApplicant,
        id: 'hod-1',
        role: UserRole.HOD,
        departmentId: 'dept-com-1',
      };

      const result = await service.getReviewHistory(hodUser, 1, 10);
      expect(result.data).toHaveLength(1);
      // The HOD's historical decision must remain APPROVED despite request.status being RETURNED_FOR_CORRECTION
      expect(result.data[0].decision).toBe('APPROVED');
      expect(result.meta.summaryCounts.approved).toBe(1);
      expect(result.meta.summaryCounts.returned).toBe(0);
    });

    it('QA-03 regression: should scope by authenticated officer actorId in personal mode (default)', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([sampleReviewedRequest]);
      const hodUser: User = {
        ...mockApplicant,
        id: 'hod-1',
        role: UserRole.HOD,
        departmentId: 'dept-com-1',
      };

      await service.getReviewHistory(hodUser, 1, 10);
      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(mockQueryBuilder.setParameter).toHaveBeenCalledWith('userId', 'hod-1');
      expect(mockQueryBuilder.setParameter).toHaveBeenCalledWith('targetStageKey', 'HEAD_OF_DEPARTMENT');
    });

    it('QA-03 regression: should support role scope without actorId constraint when scope is role', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([sampleReviewedRequest]);
      mockQueryBuilder.setParameter.mockClear();
      const hodUser: User = {
        ...mockApplicant,
        id: 'hod-1',
        role: UserRole.HOD,
        departmentId: 'dept-com-1',
      };

      await service.getReviewHistory(hodUser, 1, 10, 'all', undefined, 'role');
      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(mockQueryBuilder.setParameter).toHaveBeenCalledWith('targetStageKey', 'HEAD_OF_DEPARTMENT');
      // In role scope, userId parameter is not set on the subquery
      expect(mockQueryBuilder.setParameter).not.toHaveBeenCalledWith('userId', 'hod-1');
    });

    it('should apply search filter when provided', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([sampleReviewedRequest]);
      const hodUser: User = {
        ...mockApplicant,
        id: 'hod-1',
        role: UserRole.HOD,
        departmentId: 'dept-com-1',
      };

      await service.getReviewHistory(hodUser, 1, 10, 'all', 'UTR-2026');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('request.trackingNumber ILIKE :search'),
        { search: '%UTR-2026%' },
      );
    });
  });
});
