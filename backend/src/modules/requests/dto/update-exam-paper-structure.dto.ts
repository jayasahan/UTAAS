import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateExamPaperStructureDto {
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

  @ApiPropertyOptional({ example: 4, description: 'Corrected total essay questions' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalQuestions?: number;

  @ApiPropertyOptional({ example: 30, description: 'Corrected total MCQ questions' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalMcqQuestions?: number;

  @ApiPropertyOptional({ example: 120, description: 'Corrected total candidate count' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalCandidates?: number;

  @ApiPropertyOptional({ example: 3, description: 'Corrected paper duration in hours' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  paperDurationHours?: number;

  @ApiPropertyOptional({ example: 'COMBINED', description: 'Paper type: ESSAY, MCQ, COMBINED' })
  @IsOptional()
  @IsString()
  paperType?: string;

  @ApiPropertyOptional({ example: 60, description: 'Essay weight percentage' })
  @IsOptional()
  @IsNumber()
  essayWeightPercent?: number;

  @ApiPropertyOptional({ example: 40, description: 'MCQ weight percentage' })
  @IsOptional()
  @IsNumber()
  mcqWeightPercent?: number;

  @ApiProperty({
    example: 'Question paper had 4 compulsory design questions rather than 5',
    description: 'Mandatory reason for paper structure modification',
  })
  @IsString()
  @IsNotEmpty()
  correctionReason: string;
}
