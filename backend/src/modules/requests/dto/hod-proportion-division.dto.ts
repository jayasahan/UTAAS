import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class HodProportionDivisionDto {
  @ApiProperty({ example: 'EC5060', description: 'Course code' })
  @IsString()
  @IsNotEmpty()
  courseCode: string;

  @ApiProperty({ example: '2023/2024', description: 'Academic year' })
  @IsString()
  @IsNotEmpty()
  academicYear: string;

  @ApiProperty({ example: 'Semester 1', description: 'Semester' })
  @IsString()
  @IsNotEmpty()
  semester: string;

  @ApiProperty({ example: 'End Semester Examination', description: 'Examination type' })
  @IsString()
  @IsNotEmpty()
  examType: string;

  @ApiProperty({ example: 60, description: 'Essay weight percentage (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  essayWeightPercent: number;

  @ApiProperty({ example: 40, description: 'MCQ weight percentage (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  mcqWeightPercent: number;

  @ApiPropertyOptional({
    example: 'Essay section comprises 60% with 4 design problems, MCQ comprises 40% with 30 questions.',
    description: 'HOD remarks and rationale on proportion split',
  })
  @IsOptional()
  @IsString()
  comments?: string;
}
