import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'lecturer@eng.ruh.ac.lk',
    description: 'University email address of the faculty member or administrator',
  })
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiPropertyOptional({
    example: 'password123',
    description: 'Password (optional in Mock University SSO mode)',
  })
  @IsOptional()
  @IsString()
  password?: string;
}
