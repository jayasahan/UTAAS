import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CourseMetadataDto {
  @ApiProperty({ example: '2023/2024', description: 'Academic year for examination' })
  @IsString()
  @IsNotEmpty()
  academicYear: string;

  @ApiProperty({ example: 'Semester 1', description: 'Semester of the course' })
  @IsString()
  @IsNotEmpty()
  semester: string;

  @ApiProperty({
    example: 'BScEng (Hons) in Computer Engineering',
    description: 'Degree programme under Faculty of Engineering',
  })
  @IsString()
  @IsNotEmpty()
  degreeProgramme: string;

  @ApiProperty({ example: 'EC5060', description: 'Official course module code' })
  @IsString()
  @IsNotEmpty()
  courseCode: string;

  @ApiProperty({ example: 'Software Engineering', description: 'Course title' })
  @IsString()
  @IsNotEmpty()
  courseTitle: string;

  @ApiProperty({
    example: 'End Semester Examination',
    description: 'Examination category (End Semester, Mid Semester, Continuous Assessment)',
  })
  @IsString()
  @IsNotEmpty()
  examType: string;

  @ApiProperty({
    example: 'First Examiner',
    description: 'Examiner appointment capacity (First Examiner, Second Examiner, Chief Examiner, Moderator)',
  })
  @IsString()
  @IsNotEmpty()
  examinerRole: string;
}

export class ClaimItemsDto {
  @ApiProperty({ example: 1, description: 'Number of question papers set' })
  @IsNumber()
  @Min(0)
  paperSettingCount: number;

  @ApiProperty({ example: 0, description: 'Number of question papers moderated' })
  @IsNumber()
  @Min(0)
  paperModerationCount: number;

  @ApiProperty({ example: 120, description: 'Number of student answer scripts marked' })
  @IsNumber()
  @Min(0)
  scriptMarkingCount: number;

  @ApiProperty({ example: 4, description: 'Total hours of practical / laboratory / oral examination assessment' })
  @IsNumber()
  @Min(0)
  practicalAssessmentHours: number;

  @ApiProperty({ example: 0, description: 'Number of answer scripts verified as Second Examiner' })
  @IsNumber()
  @Min(0)
  secondMarkingCount: number;
}

export class SupportingDocumentDto {
  @ApiProperty({ example: 'appointment_letter.pdf' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'https://utaas-storage.ruh.ac.lk/docs/appointment_letter.pdf' })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({
    example: 'APPOINTMENT_LETTER',
    description: 'Document category: APPOINTMENT_LETTER, ATTENDANCE_MARKS_SHEET, EXAM_TIMETABLE',
  })
  @IsString()
  @IsNotEmpty()
  documentType: string;
}

export class CreatePaperMarkingClaimDto {
  @ApiProperty({ type: CourseMetadataDto })
  @ValidateNested()
  @Type(() => CourseMetadataDto)
  metadata: CourseMetadataDto;

  @ApiProperty({ type: ClaimItemsDto })
  @ValidateNested()
  @Type(() => ClaimItemsDto)
  items: ClaimItemsDto;

  @ApiPropertyOptional({ type: [SupportingDocumentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupportingDocumentDto)
  supportingDocuments?: SupportingDocumentDto[];

  @ApiPropertyOptional({
    example: 'd1e2f3a4-5b6c-7d8e-9f0a-1b2c3d4e5f6a',
    description: 'Target department ID (defaults to user department)',
  })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({
    example: 'Claim submitted for Semester 1 EC5060 final examinations.',
    description: 'Applicant comments or notes for reviewers',
  })
  @IsOptional()
  @IsString()
  comments?: string;
}
