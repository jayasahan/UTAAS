import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { UserRole } from '../../../database/entities/user.entity';

export class UpdateAdminUserDto {
  @ApiPropertyOptional({ example: 'Dr. A.B. Wickramasinghe', description: 'Updated full name' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'updated.email@eng.ruh.ac.lk', description: 'Updated email address' })
  @IsOptional()
  @IsEmail({}, { message: 'Must be a valid email address' })
  email?: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.HOD, description: 'Updated role' })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Valid university role is required' })
  role?: UserRole;

  @ApiPropertyOptional({ example: 'Professor', description: 'Updated designation' })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional({ example: 'ENG/AC/0101', description: 'Updated staff ID' })
  @IsOptional()
  @IsString()
  staffId?: string;

  @ApiPropertyOptional({ description: 'Updated Department UUID or null' })
  @IsOptional()
  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  departmentId?: string | null;

  @ApiPropertyOptional({ description: 'Optional password reset for the user' })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password?: string;
}
