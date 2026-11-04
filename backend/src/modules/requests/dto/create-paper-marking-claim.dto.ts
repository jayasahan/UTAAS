import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  ValidateNested,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CourseMetadataDto {
  @ApiPropertyOptional({ example: '2023/2024', description: 'Academic year for examination' })
  @IsString()
  @IsNotEmpty()
  academicYear: string;

  @ApiPropertyOptional({ example: 'Semester 1', description: 'Semester of the course' })
  @IsString()
  @IsNotEmpty()
  semester: string;

  @ApiPropertyOptional({
    example: 'BScEng (Hons) in Computer Engineering',
    description: 'Degree programme under Faculty of Engineering',
  })
  @IsString()
  @IsNotEmpty()
  degreeProgramme: string;

  @ApiPropertyOptional({ example: 'EC5060', description: 'Official course module code' })
  @IsOptional()
  @IsString()
  courseCode?: string;

  @ApiPropertyOptional({ example: 'Software Engineering', description: 'Course title' })
  @IsOptional()
  @IsString()
  courseTitle?: string;

  @ApiPropertyOptional({
    example: 'End Semester Examination',
    description: 'Examination category (End Semester, Mid Semester, Continuous Assessment, etc.)',
  })
  @IsString()
  @IsNotEmpty()
  examType: string;

  @ApiPropertyOptional({
    example: 'First Examiner',
    description: 'Examiner appointment capacity (First Examiner, Second Examiner, Chief Examiner, Moderator)',
  })
  @IsString()
  @IsNotEmpty()
  examinerRole: string;
}

export class MultiExaminerShareDto {
  @ApiPropertyOptional({ example: false, description: 'True if paper setting/marking is shared with other examiners' })
  @IsOptional()
  @IsBoolean()
  isShared?: boolean;

  @ApiPropertyOptional({ example: 5, description: 'Total number of questions in paper/script' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalQuestions?: number;

  @ApiPropertyOptional({ example: 2, description: 'Number of questions set or marked by this examiner' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  questionsClaimed?: number;

  @ApiPropertyOptional({ example: 0.4, description: 'Fractional proportion of the task claimed (questionsClaimed / totalQuestions)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  proportion?: number;
}

export class CombinedPaperConfigDto {
  @ApiPropertyOptional({ example: false, description: 'True if paper combines Essay and MCQ sections' })
  @IsOptional()
  @IsBoolean()
  isCombinedPaper?: boolean;

  @ApiPropertyOptional({ example: 75, description: 'Essay section weight percentage determined by HOD (e.g. 75%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  essayWeightPercent?: number;

  @ApiPropertyOptional({ example: 25, description: 'MCQ section weight percentage determined by HOD (e.g. 25%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  mcqWeightPercent?: number;

  @ApiPropertyOptional({ example: 20, description: 'Number of MCQ questions in combined paper' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  mcqQuestionCount?: number;
}

export class PaperRowDto {
  @ApiPropertyOptional({ example: 'paper-1' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({ example: 'Software Engineering (EC5060)', description: 'Title of the question paper' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 3, description: 'Duration in hours' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  durationHours?: number;

  @ApiPropertyOptional({ example: 1, description: 'Number of papers set' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  settingCount?: number;

  @ApiPropertyOptional({ example: 0, description: 'Number of papers moderated' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  moderationCount?: number;

  @ApiPropertyOptional({ example: 0, description: 'Number of papers translated' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  translationCount?: number;

  @ApiPropertyOptional({ example: 120, description: 'Number of student answer scripts marked' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  scriptCount?: number;

  @ApiPropertyOptional({ example: 30, description: 'Number of scripts second-marked' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  secondMarkingCount?: number;

  @ApiPropertyOptional({ example: 'candidates', enum: ['candidates', 'hours'] })
  @IsOptional()
  @IsString()
  assessmentUnit?: 'candidates' | 'hours';

  @ApiPropertyOptional({ example: 0, description: 'Practical assessment quantity (hours or candidates)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  assessmentQuantity?: number;

  // Multi-examiner shared task details (UGC Circular 981 Rule 2)
  @ApiPropertyOptional({ type: MultiExaminerShareDto, description: 'Multi-examiner setting proportion' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MultiExaminerShareDto)
  settingShare?: MultiExaminerShareDto;

  @ApiPropertyOptional({ type: MultiExaminerShareDto, description: 'Multi-examiner script marking proportion' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MultiExaminerShareDto)
  markingShare?: MultiExaminerShareDto;

  @ApiPropertyOptional({ example: 0, description: 'Pages typed by teacher setting paper (Rs. 100/page, max Rs. 500)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  typedPageCount?: number;

  @ApiPropertyOptional({ type: CombinedPaperConfigDto, description: 'Combined Essay + MCQ configuration' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CombinedPaperConfigDto)
  combinedPaperConfig?: CombinedPaperConfigDto;
}

export class PersonalInfoDto {
  @ApiPropertyOptional({ example: 'Dr. Hansana H.A.J.' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'Senior Lecturer (Grade II)' })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional({ example: 'Department of Computer Engineering' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ example: 'ENG/COM/042' })
  @IsOptional()
  @IsString()
  staffId?: string;

  @ApiPropertyOptional({ example: 'EC5060 First Marking 2023/2024' })
  @IsOptional()
  @IsString()
  referenceTitle?: string;
}

export class ClaimItemsDto {
  @ApiPropertyOptional({ example: 1, description: 'Number of question papers set' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paperSettingCount?: number;

  @ApiPropertyOptional({ example: 0, description: 'Number of question papers moderated' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paperModerationCount?: number;

  @ApiPropertyOptional({ example: 120, description: 'Number of student answer scripts marked' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  scriptMarkingCount?: number;

  @ApiPropertyOptional({ example: 4, description: 'Total hours of practical / laboratory / oral examination assessment' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  practicalAssessmentHours?: number;

  @ApiPropertyOptional({ example: 0, description: 'Number of answer scripts verified as Second Examiner' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  secondMarkingCount?: number;

  @ApiPropertyOptional({ example: 0, description: 'Number of question papers translated' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paperTranslationCount?: number;

  @ApiPropertyOptional({ example: 0, description: 'Number of candidates assessed in practical / oral exam' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  candidateAssessmentCount?: number;

  // Extended UGC Circular 981 / 681 / 636 claims
  @ApiPropertyOptional({ example: 3, description: 'Number of question paper pages typed by setter (Rs. 100/page, max Rs. 500)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paperTypingPages?: number;

  @ApiPropertyOptional({ example: 0, description: 'Number of Continuous Assessments evaluated (Circular 681, 25% of final rate)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  continuousAssessmentCount?: number;

  @ApiPropertyOptional({ example: 0, description: 'Number of Undergraduate FYP Dissertations examined (Rs. 600 each)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  dissertationUndergradCount?: number;

  @ApiPropertyOptional({ example: 0, description: 'Number of Postgraduate Masters Dissertations examined (Rs. 2000 each)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  dissertationPostgradCount?: number;

  @ApiPropertyOptional({ example: 0, description: 'Number of M.Phil Theses examined (Rs. 3000 each)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  thesisMPhilCount?: number;

  @ApiPropertyOptional({ example: 0, description: 'Number of Ph.D. Theses examined (Rs. 5000 each)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  thesisPhDCount?: number;
}

export class SupportingDocumentDto {
  @ApiPropertyOptional({ example: 'appointment_letter.pdf' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'https://utaas-storage.ruh.ac.lk/docs/appointment_letter.pdf' })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiPropertyOptional({
    example: 'APPOINTMENT_LETTER',
    description: 'Document category: APPOINTMENT_LETTER, ATTENDANCE_MARKS_SHEET, EXAM_TIMETABLE',
  })
  @IsString()
  @IsNotEmpty()
  documentType: string;

  @ApiPropertyOptional({ example: 102400 })
  @IsOptional()
  @IsNumber()
  size?: number;
}

export class CreatePaperMarkingClaimDto {
  @ApiPropertyOptional({ type: CourseMetadataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CourseMetadataDto)
  metadata?: CourseMetadataDto;

  @ApiPropertyOptional({ type: CourseMetadataDto, description: 'Alias for metadata matching frontend model' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CourseMetadataDto)
  academic?: CourseMetadataDto;

  @ApiPropertyOptional({ type: PersonalInfoDto, description: 'Lecturer personal information' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonalInfoDto)
  personal?: PersonalInfoDto;

  @ApiPropertyOptional({ type: [PaperRowDto], description: 'Detailed individual paper rows from table' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaperRowDto)
  papers?: PaperRowDto[];

  @ApiPropertyOptional({ type: ClaimItemsDto, description: 'Aggregate quantities (computed automatically if papers provided)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ClaimItemsDto)
  items?: ClaimItemsDto;

  @ApiPropertyOptional({ type: [SupportingDocumentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupportingDocumentDto)
  supportingDocuments?: SupportingDocumentDto[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  declaration?: boolean;

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
