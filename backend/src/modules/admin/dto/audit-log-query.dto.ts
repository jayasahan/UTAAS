import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class AuditLogQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by Request UUID' })
  @IsOptional()
  @IsUUID('4', { message: 'requestId must be a valid UUID' })
  requestId?: string;

  @ApiPropertyOptional({ description: 'Filter by Claim Tracking Number (e.g. UTR-2026-0001)' })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional({ description: 'Filter by Actor UUID' })
  @IsOptional()
  @IsUUID('4', { message: 'actorId must be a valid UUID' })
  actorId?: string;

  @ApiPropertyOptional({ description: 'Filter by Actor Role' })
  @IsOptional()
  @IsString()
  actorRole?: string;

  @ApiPropertyOptional({
    description: 'Filter by Action Type (e.g. SUBMIT, APPROVE, REJECT_RETURN, APPROVE_PAYOUT)',
  })
  @IsOptional()
  @IsString()
  actionType?: string;

  @ApiPropertyOptional({ description: 'Filter events from ISO start date' })
  @IsOptional()
  @IsDateString({}, { message: 'startDate must be a valid ISO-8601 date string' })
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter events up to ISO end date' })
  @IsOptional()
  @IsDateString({}, { message: 'endDate must be a valid ISO-8601 date string' })
  endDate?: string;
}
