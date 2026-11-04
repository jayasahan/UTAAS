import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkflowStageConfigDto } from './workflow-stage-config.dto';

export class CreateWorkflowTemplateDto {
  @ApiProperty({ description: 'Request Type UUID to associate this template with' })
  @IsUUID('4', { message: 'requestTypeId must be a valid UUID' })
  @IsNotEmpty({ message: 'requestTypeId is required' })
  requestTypeId: string;

  @ApiProperty({
    type: [WorkflowStageConfigDto],
    description: 'Ordered array of workflow stage definitions',
  })
  @IsArray()
  @ArrayMinSize(2, { message: 'Workflow must have at least 2 stages' })
  @ValidateNested({ each: true })
  @Type(() => WorkflowStageConfigDto)
  stages: WorkflowStageConfigDto[];

  @ApiPropertyOptional({
    default: true,
    description: 'Whether to activate this template immediately upon creation',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
