import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '../../../database/entities/request.entity';
import { UserRole } from '../../../database/entities/user.entity';

export class StageStepperItemDto {
  @ApiProperty({ example: 'HEAD_OF_DEPARTMENT' })
  key: string;

  @ApiProperty({ example: 'Head of Department Recommendation' })
  name: string;

  @ApiProperty({ example: 1 })
  order: number;

  @ApiProperty({ enum: UserRole, example: UserRole.HOD })
  requiredRole: UserRole;

  @ApiProperty({
    enum: ['PENDING', 'IN_PROGRESS', 'APPROVED', 'RETURNED'],
    example: 'APPROVED',
  })
  status: 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'RETURNED';

  @ApiPropertyOptional({ example: 'Prof. Sunimal Silva' })
  actorName?: string | null;

  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  actorId?: string | null;

  @ApiPropertyOptional({ example: '2026-10-21T00:30:00.000Z' })
  enteredAt?: string | null;

  @ApiPropertyOptional({ example: '2026-10-21T01:15:00.000Z' })
  completedAt?: string | null;

  @ApiPropertyOptional({ example: 'Recommended for examination office checking.' })
  comments?: string | null;
}

export class CurrentStageInfoDto {
  @ApiProperty({ example: 'EXAMINATION_OFFICE' })
  key: string;

  @ApiProperty({ example: 'Examination Office Checking & Verification' })
  name: string;

  @ApiProperty({ example: 3 })
  order: number;

  @ApiProperty({ enum: UserRole, example: UserRole.EXAMINATION_OFFICER })
  assignedRole: UserRole;
}

export class TrackingResponseDto {
  @ApiProperty({ example: 'UTR-2026-0001' })
  trackingNumber: string;

  @ApiProperty({ example: 'Paper Setting & Marking Claim' })
  requestType: string;

  @ApiProperty({ enum: RequestStatus, example: RequestStatus.UNDER_REVIEW })
  status: RequestStatus;

  @ApiProperty({ example: 23500.0 })
  totalAmount: number;

  @ApiPropertyOptional({ example: null })
  returningOfficerId?: string | null;

  @ApiProperty({ type: CurrentStageInfoDto })
  currentStage: CurrentStageInfoDto;

  @ApiProperty({ type: [StageStepperItemDto] })
  stages: StageStepperItemDto[];
}
