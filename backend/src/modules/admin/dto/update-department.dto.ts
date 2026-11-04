import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ example: 'COM', description: 'Department code' })
  @IsOptional()
  @IsString()
  @Length(2, 20, { message: 'Department code must be between 2 and 20 characters' })
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'Department code must contain only uppercase letters, numbers, and dashes',
  })
  code?: string;

  @ApiPropertyOptional({
    example: 'Department of Computer Engineering',
    description: 'Full academic department name',
  })
  @IsOptional()
  @IsString()
  @Length(3, 150, { message: 'Department name must be between 3 and 150 characters' })
  name?: string;

  @ApiPropertyOptional({
    description: 'User UUID to assign as Head of Department (HOD), or null to unassign current HOD',
  })
  @IsOptional()
  @IsUUID('4', { message: 'hodUserId must be a valid UUID' })
  hodUserId?: string | null;
}
