import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateRequestTypeDto {
  @ApiProperty({
    example: 'GENERAL_REIMBURSEMENT',
    description: 'Unique alphanumeric uppercase code',
  })
  @IsString()
  @IsNotEmpty({ message: 'Request type code is required' })
  @Length(2, 50, { message: 'Code must be between 2 and 50 characters' })
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'Code must contain only uppercase letters, numbers, and underscores/dashes',
  })
  code: string;

  @ApiProperty({
    example: 'General Administrative Reimbursement',
    description: 'Display name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Request type name is required' })
  @Length(3, 150, { message: 'Name must be between 3 and 150 characters' })
  name: string;

  @ApiPropertyOptional({ description: 'Detailed description of the claim type' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true, description: 'Whether the request type is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
