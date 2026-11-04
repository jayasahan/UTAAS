import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateCourseModuleDto {
  @ApiProperty({
    example: 'IS5302',
    description: 'Course module code (e.g. IS5302, EC5060, CE3301)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Module code is required' })
  @Length(4, 20, { message: 'Module code must be between 4 and 20 characters' })
  code: string;

  @ApiProperty({
    example: 'Operations Research & Quantitative Methods',
    description: 'Full course module title',
  })
  @IsString()
  @IsNotEmpty({ message: 'Module name is required' })
  @Length(3, 200, { message: 'Module name must be between 3 and 200 characters' })
  name: string;

  @ApiProperty({
    description: 'Department UUID offering this course module (CEE, MME, EIE, IS, MENA)',
  })
  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  @IsNotEmpty({ message: 'departmentId is required' })
  departmentId: string;

  @ApiPropertyOptional({
    example: 5,
    minimum: 1,
    maximum: 8,
    description: 'Academic semester (1 to 8). Auto-inferred from code if omitted.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  semester?: number;

  @ApiPropertyOptional({
    example: 3,
    minimum: 1,
    maximum: 6,
    description: 'Course academic credits (1 to 6). Auto-inferred from code if omitted.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  credits?: number;

  @ApiPropertyOptional({
    example: 'IS',
    description: 'Discipline prefix (e.g. CE, ME, EE, EC, MN, IS). Auto-inferred if omitted.',
  })
  @IsOptional()
  @IsString()
  prefix?: string;

  @ApiPropertyOptional({ default: true, description: 'Active curriculum status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
