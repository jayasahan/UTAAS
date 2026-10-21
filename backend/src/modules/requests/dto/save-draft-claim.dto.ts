import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  Min,
  IsOptional,
  ValidateNested,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PaperRowDto,
  PersonalInfoDto,
  ClaimItemsDto,
  SupportingDocumentDto,
} from './create-paper-marking-claim.dto';

export class PartialCourseMetadataDto {
  @ApiPropertyOptional({ example: '2023/2024' })
  @IsOptional()
  @IsString()
  academicYear?: string;

  @ApiPropertyOptional({ example: 'Semester 1' })
  @IsOptional()
  @IsString()
  semester?: string;

  @ApiPropertyOptional({ example: 'BScEng (Hons) in Computer Engineering' })
  @IsOptional()
  @IsString()
  degreeProgramme?: string;

  @ApiPropertyOptional({ example: 'EC5060' })
  @IsOptional()
  @IsString()
  courseCode?: string;

  @ApiPropertyOptional({ example: 'Software Engineering' })
  @IsOptional()
  @IsString()
  courseTitle?: string;

  @ApiPropertyOptional({ example: 'End Semester Examination' })
  @IsOptional()
  @IsString()
  examType?: string;

  @ApiPropertyOptional({ example: 'First Examiner' })
  @IsOptional()
  @IsString()
  examinerRole?: string;
}

export class SaveDraftClaimDto {
  @ApiPropertyOptional({ type: PartialCourseMetadataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PartialCourseMetadataDto)
  metadata?: PartialCourseMetadataDto;

  @ApiPropertyOptional({ type: PartialCourseMetadataDto, description: 'Alias for metadata' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PartialCourseMetadataDto)
  academic?: PartialCourseMetadataDto;

  @ApiPropertyOptional({ type: PersonalInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonalInfoDto)
  personal?: PersonalInfoDto;

  @ApiPropertyOptional({ type: [PaperRowDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaperRowDto)
  papers?: PaperRowDto[];

  @ApiPropertyOptional({ type: ClaimItemsDto })
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

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  declaration?: boolean;

  @ApiPropertyOptional({ example: 'APPOINTMENT_LETTER' })
  @IsOptional()
  @IsString()
  selectedDocumentCategory?: string;

  @ApiPropertyOptional({ example: 'Draft notes' })
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiPropertyOptional({ example: 'd1e2f3a4-5b6c-7d8e-9f0a-1b2c3d4e5f6a' })
  @IsOptional()
  @IsString()
  departmentId?: string;
}
