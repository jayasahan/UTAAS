import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class UpdateCourseModuleDto {
  @ApiPropertyOptional({ example: 'IS5302', description: 'Updated module code' })
  @IsOptional()
  @IsString()
  @Length(4, 20)
  code?: string;

  @ApiPropertyOptional({ example: 'Operations Research & Optimization', description: 'Updated title' })
  @IsOptional()
  @IsString()
  @Length(3, 200)
  name?: string;

  @ApiPropertyOptional({ description: 'Reassign to another department UUID' })
  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 8, description: 'Semester (1 to 8)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  semester?: number;

  @ApiPropertyOptional({ example: 3, minimum: 1, maximum: 6, description: 'Credits (1 to 6)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  credits?: number;

  @ApiPropertyOptional({ description: 'Active curriculum status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
