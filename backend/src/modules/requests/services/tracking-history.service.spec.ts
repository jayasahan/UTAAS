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

  beforeEach(async () => {
    mockRequestRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[sampleRequest], 1]),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[sampleRequest], 1]),
      }),
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

    it('should throw NotFoundException if request does not exist', async () => {
      mockRequestRepo.findOne.mockResolvedValue(null);

      await expect(service.getTrackingInfo('invalid-id', mockApplicant)).rejects.toThrow(
        NotFoundException,
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
  });
});
