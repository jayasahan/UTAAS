import { ApiProperty } from '@nestjs/swagger';

export class ReviewHistoryEventDto {
  @ApiProperty({ example: 'b8e9f5e1-8f0a-4c5b-b9d1-8f0a4c5bb9d1' })
  id: string;

  @ApiProperty({ example: 'APPROVE' })
  action: string;

  @ApiProperty({ example: 'Dr. Jane Smith' })
  actor: string;

  @ApiProperty({ example: 'HOD' })
  role: string;

  @ApiProperty({ example: '2026-10-21T14:30:00.000Z' })
  occurredAt: string;

  @ApiProperty({ example: 'Approved and recommended for faculty review' })
  summary: string;
}

export class ReviewHistoryEntryDto {
  @ApiProperty({ example: '59ca45ea-b576-4e81-8524-7bf48e747275' })
  id: string;

  @ApiProperty({ example: 'UTR-2026-0001' })
  trackingNumber: string;

  @ApiProperty({ example: 'Dr. Kamal Perera' })
  applicant: string;

  @ApiProperty({ example: 'Paper Setting & Marking Claim' })
  claimType: string;

  @ApiProperty({ example: 'Computer Engineering' })
  department: string;

  @ApiProperty({ example: 'COM', nullable: true })
  departmentCode: string | null;

  @ApiProperty({ example: 'APPROVED', enum: ['APPROVED', 'RETURNED_FOR_CORRECTION', 'REJECTED'] })
  decision: 'APPROVED' | 'RETURNED_FOR_CORRECTION' | 'REJECTED';

  @ApiProperty({ example: '2026-10-21T14:30:00.000Z' })
  decisionDate: string;

  @ApiProperty({ example: 29900 })
  totalAmount: number;

  @ApiProperty({ type: [ReviewHistoryEventDto] })
  events: ReviewHistoryEventDto[];
}

export class ReviewHistorySummaryCountsDto {
  @ApiProperty({ example: 4 })
  approved: number;

  @ApiProperty({ example: 1 })
  returned: number;

  @ApiProperty({ example: 0 })
  rejected: number;
}

export class ReviewHistoryMetaDto {
  @ApiProperty({ example: 5 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 1 })
  totalPages: number;

  @ApiProperty({ type: ReviewHistorySummaryCountsDto })
  summaryCounts: ReviewHistorySummaryCountsDto;
}

export class ReviewHistoryResponseDto {
  @ApiProperty({ type: [ReviewHistoryEntryDto] })
  data: ReviewHistoryEntryDto[];

  @ApiProperty({ type: ReviewHistoryMetaDto })
  meta: ReviewHistoryMetaDto;
}
