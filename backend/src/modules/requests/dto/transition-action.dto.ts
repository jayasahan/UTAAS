import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { StageAction } from '../../../database/entities/request-stage-history.entity';
import { UserRole } from '../../../database/entities/user.entity';

export enum WorkflowActionType {
  APPROVE = 'APPROVE',
  REJECT_RETURN = 'REJECT_RETURN',
  APPROVE_PAYOUT = 'APPROVE_PAYOUT',
  DIRECT_QUERY = 'DIRECT_QUERY',
  RESUBMIT = 'RESUBMIT',
  SETTLE = 'SETTLE',
}

export class TransitionActionDto {
  @ApiProperty({
    enum: WorkflowActionType,
    example: WorkflowActionType.APPROVE,
    description: 'Workflow transition action to execute',
  })
  @IsEnum(WorkflowActionType, { message: 'Action must be a valid workflow action' })
  @IsNotEmpty()
  action: WorkflowActionType;

  @ApiPropertyOptional({
    example: 'Verified student attendance records and answer script counts. Approved.',
    description: 'Reviewer comments, return rationale, or applicant clarification',
  })
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiPropertyOptional({
    description: 'Optional updated form data for corrections when resubmitting',
  })
  @IsOptional()
  updatedFormData?: Record<string, any>;

  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Specific return target role (e.g., LECTURER or HOD) when returning claim',
  })
  @IsOptional()
  @IsEnum(UserRole)
  targetReturnRole?: UserRole;
}
