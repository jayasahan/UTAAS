import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuditEventItemDto {
  @ApiProperty({ example: 'evt-123-uuid' })
  id: string;

  @ApiProperty({ example: 'SUBMIT' })
  actionType: string;

  @ApiProperty({ example: 'Dr. Kamal Perera' })
  actorName: string;

  @ApiProperty({ example: 'LECTURER' })
  actorRole: string;

  @ApiProperty({ example: 'DRAFT' })
  previousStatus: string;

  @ApiProperty({ example: 'UNDER_REVIEW' })
  newStatus: string;

  @ApiPropertyOptional({ example: { totalAmount: 23500.0, courseCode: 'EC5060' } })
  fieldDiff?: Record<string, any>;

  @ApiProperty({ example: 'Claim submitted and routed to Head of Department' })
  comment: string;

  @ApiProperty({ example: '2026-10-21T00:30:00.000Z' })
  createdAt: string;
}

export class HistoryResponseDto {
  @ApiProperty({ example: 'req-uuid-123' })
  requestId: string;

  @ApiProperty({ example: 'UTR-2026-0001' })
  trackingNumber: string;

  @ApiProperty({ type: [AuditEventItemDto] })
  events: AuditEventItemDto[];
}
