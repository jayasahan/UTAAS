import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'DIS', description: 'Unique department code (e.g. COM, CIV, EIE, MEC)' })
  @IsString()
  @IsNotEmpty({ message: 'Department code is required' })
  @Length(2, 20, { message: 'Department code must be between 2 and 20 characters' })
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'Department code must contain only uppercase letters, numbers, and dashes',
  })
  code: string;

  @ApiProperty({
    example: 'Department of Interdisciplinary Studies',
    description: 'Full academic department name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Department name is required' })
  @Length(3, 150, { message: 'Department name must be between 3 and 150 characters' })
  name: string;

  @ApiPropertyOptional({
    description: 'Optional User UUID to appoint as initial Head of Department (HOD)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'hodUserId must be a valid UUID' })
  hodUserId?: string;
}
