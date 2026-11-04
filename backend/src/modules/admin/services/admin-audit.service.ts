import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEvent } from '../../../database/entities/audit-event.entity';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';

export interface PaginatedAuditLogsResponse {
  data: AuditEvent[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class AdminAuditService {
  constructor(
    @InjectRepository(AuditEvent)
    private readonly auditRepo: Repository<AuditEvent>,
  ) {}

  /**
   * Query the system-wide immutable audit event trail with comprehensive filters and pagination.
   */
  async getAuditLogs(query: AuditLogQueryDto): Promise<PaginatedAuditLogsResponse> {
    const page = query.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query.limit && query.limit > 0 ? Number(query.limit) : 20;
    const skip = (page - 1) * limit;

    const qb = this.auditRepo
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.request', 'req');

    if (query.requestId) {
      qb.andWhere('audit.requestId = :requestId', { requestId: query.requestId });
    }

    if (query.trackingNumber && query.trackingNumber.trim()) {
      const term = `%${query.trackingNumber.trim().toLowerCase()}%`;
      qb.andWhere('LOWER(req.trackingNumber) LIKE :term', { term });
    }

    if (query.actorId) {
      qb.andWhere('audit.actorId = :actorId', { actorId: query.actorId });
    }

    if (query.actorRole && query.actorRole.trim()) {
      qb.andWhere('audit.actorRole = :actorRole', { actorRole: query.actorRole.trim() });
    }

    if (query.actionType && query.actionType.trim()) {
      qb.andWhere('audit.actionType = :actionType', { actionType: query.actionType.trim() });
    }

    if (query.startDate) {
      qb.andWhere('audit.createdAt >= :startDate', { startDate: new Date(query.startDate) });
    }

    if (query.endDate) {
      qb.andWhere('audit.createdAt <= :endDate', { endDate: new Date(query.endDate) });
    }

    qb.orderBy('audit.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single audit event details by ID.
   */
  async getAuditLogById(id: string): Promise<AuditEvent> {
    const event = await this.auditRepo.findOne({
      where: { id },
      relations: ['request'],
    });

    if (!event) {
      throw new NotFoundException(`AuditEvent with ID "${id}" not found`);
    }

    return event;
  }
}
