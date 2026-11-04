import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { UserRole } from '../../../database/entities/user.entity';

export class WorkflowStageConfigDto {
  @ApiProperty({ example: 0, description: 'Sequential zero-indexed stage order' })
  @IsInt()
  @Min(0)
  order: number;

  @ApiProperty({ example: 'SUBMISSION', description: 'Unique programmatic key for this stage' })
  @IsString()
  @IsNotEmpty({ message: 'stageKey is required' })
  stageKey: string;

  @ApiProperty({ example: 'Lecturer Submission', description: 'Human-readable title of stage' })
  @IsString()
  @IsNotEmpty({ message: 'stageName is required' })
  stageName: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.LECTURER,
    description: 'Role authorized to act on this stage',
  })
  @IsEnum(UserRole, { message: 'requiredRole must be a valid UserRole' })
  requiredRole: UserRole;

  @ApiPropertyOptional({
    default: false,
    description: 'Whether action is restricted to the applicant department',
  })
  @IsOptional()
  @IsBoolean()
  isDepartmentScoped?: boolean;
}
