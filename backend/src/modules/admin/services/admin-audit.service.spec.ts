import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AdminAuditService } from './admin-audit.service';
import { AuditEvent } from '../../../database/entities/audit-event.entity';

describe('AdminAuditService', () => {
  let service: AdminAuditService;
  let auditRepoMock: any;

  const mockAuditEvent: AuditEvent = {
    id: 'audit-uuid-1',
    requestId: 'req-uuid-1',
    request: {
      id: 'req-uuid-1',
      trackingNumber: 'UTR-2026-0001',
      status: 'UNDER_REVIEW',
      totalAmount: 12500,
    } as any,
    actorId: 'user-uuid-1',
    actorName: 'Dr. Hansana H.A.J.',
    actorRole: 'LECTURER',
    actionType: 'SUBMIT',
    previousStatus: 'DRAFT',
    newStatus: 'UNDER_REVIEW',
    fieldDiff: { totalAmount: 12500 },
    comment: 'Claim submitted for HOD review',
    ipAddress: '127.0.0.1',
    createdAt: new Date('2026-10-22T10:00:00Z'),
  };

  beforeEach(async () => {
    const qbMock: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockAuditEvent], 1]),
    };

    auditRepoMock = {
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuditService,
        {
          provide: getRepositoryToken(AuditEvent),
          useValue: auditRepoMock,
        },
      ],
    }).compile();

    service = module.get<AdminAuditService>(AdminAuditService);
  });

  describe('getAuditLogs', () => {
    it('should return paginated audit logs with meta', async () => {
      const result = await service.getAuditLogs({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('audit-uuid-1');
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should apply all filters', async () => {
      const qb = auditRepoMock.createQueryBuilder();
      await service.getAuditLogs({
        requestId: 'req-uuid-1',
        trackingNumber: 'UTR-2026',
        actorId: 'user-uuid-1',
        actorRole: 'LECTURER',
        actionType: 'SUBMIT',
        startDate: '2026-10-01T00:00:00Z',
        endDate: '2026-10-31T23:59:59Z',
      });

      expect(qb.andWhere).toHaveBeenCalledWith('audit.requestId = :requestId', {
        requestId: 'req-uuid-1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('LOWER(req.trackingNumber) LIKE :term', {
        term: '%utr-2026%',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('audit.actorId = :actorId', {
        actorId: 'user-uuid-1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('audit.actorRole = :actorRole', {
        actorRole: 'LECTURER',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('audit.actionType = :actionType', {
        actionType: 'SUBMIT',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('audit.createdAt >= :startDate', expect.any(Object));
      expect(qb.andWhere).toHaveBeenCalledWith('audit.createdAt <= :endDate', expect.any(Object));
    });
  });

  describe('getAuditLogById', () => {
    it('should return single audit event by ID', async () => {
      auditRepoMock.findOne.mockResolvedValueOnce(mockAuditEvent);

      const result = await service.getAuditLogById('audit-uuid-1');

      expect(result.id).toBe('audit-uuid-1');
      expect(result.actionType).toBe('SUBMIT');
    });

    it('should throw NotFoundException if event does not exist', async () => {
      auditRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(service.getAuditLogById('missing-id')).rejects.toThrow(NotFoundException);
    });
  });
});
