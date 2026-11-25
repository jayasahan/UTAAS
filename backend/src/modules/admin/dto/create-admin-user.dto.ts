import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { UserRole } from '../../../database/entities/user.entity';

export class CreateAdminUserDto {
  @ApiProperty({ example: 'lecturer.new@eng.ruh.ac.lk', description: 'Institutional email address' })
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: 'Dr. A.B. Wickramasinghe', description: 'Full name and title of the user' })
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @ApiProperty({ enum: UserRole, example: UserRole.LECTURER, description: 'University system role' })
  @IsEnum(UserRole, { message: 'Valid university role is required' })
  @IsNotEmpty({ message: 'Role is required' })
  role: UserRole;

  @ApiPropertyOptional({ example: 'Senior Lecturer (Grade I)', description: 'Academic or administrative designation' })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional({ example: 'ENG/AC/0101', description: 'University staff ID number' })
  @IsOptional()
  @IsString()
  staffId?: string;

  @ApiPropertyOptional({ description: 'Department UUID (required for LECTURER and HOD roles)' })
  @IsOptional()
  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  departmentId?: string;

  @ApiPropertyOptional({ example: 'TemporaryPassword@2026', description: 'Initial password (defaults to standard seed password if omitted)' })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password?: string;
}
