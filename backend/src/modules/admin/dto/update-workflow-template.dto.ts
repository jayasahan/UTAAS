import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkflowStageConfigDto } from './workflow-stage-config.dto';

export class UpdateWorkflowTemplateDto {
  @ApiPropertyOptional({
    type: [WorkflowStageConfigDto],
    description: 'Updated stage configurations',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2, { message: 'Workflow must have at least 2 stages' })
  @ValidateNested({ each: true })
  @Type(() => WorkflowStageConfigDto)
  stages?: WorkflowStageConfigDto[];

  @ApiPropertyOptional({ description: 'Active status flag' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
