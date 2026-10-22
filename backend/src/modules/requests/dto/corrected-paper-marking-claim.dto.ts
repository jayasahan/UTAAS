import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  ValidateNested,
  IsArray,
  IsBoolean,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PaperRowDto,
  PersonalInfoDto,
  ClaimItemsDto,
  SupportingDocumentDto,
} from './create-paper-marking-claim.dto';
import { PartialCourseMetadataDto } from './save-draft-claim.dto';

export class CorrectedPaperMarkingClaimDto {
  @ApiPropertyOptional({ type: PartialCourseMetadataDto, description: 'Corrected examination course metadata' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PartialCourseMetadataDto)
  metadata?: PartialCourseMetadataDto;

  @ApiPropertyOptional({ type: PartialCourseMetadataDto, description: 'Alias for metadata' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PartialCourseMetadataDto)
  academic?: PartialCourseMetadataDto;

  @ApiPropertyOptional({ type: PersonalInfoDto, description: 'Lecturer personal/contact details' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonalInfoDto)
  personal?: PersonalInfoDto;

  @ApiPropertyOptional({ type: [PaperRowDto], description: 'Multi-paper rows with updated quantities' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaperRowDto)
  papers?: PaperRowDto[];

  @ApiPropertyOptional({ type: ClaimItemsDto, description: 'Aggregated claim items' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ClaimItemsDto)
  items?: ClaimItemsDto;

  @ApiPropertyOptional({ type: [SupportingDocumentDto], description: 'Preserved and newly attached documents' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupportingDocumentDto)
  supportingDocuments?: SupportingDocumentDto[];

  @ApiPropertyOptional({ example: true, description: 'Applicant confirmation statement' })
  @IsOptional()
  @IsBoolean()
  declaration?: boolean;

  @ApiPropertyOptional({ example: 'Corrected student counts according to final marks sheets', description: 'Applicant correction explanation' })
  @IsOptional()
  @IsString()
  comments?: string;
}
