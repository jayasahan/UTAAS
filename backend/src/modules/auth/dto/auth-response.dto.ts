import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../database/entities/user.entity';

export class UserProfileDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'lecturer@eng.ruh.ac.lk' })
  email: string;

  @ApiProperty({ example: 'Dr. Kamal Perera' })
  fullName: string;

  @ApiProperty({ enum: UserRole, example: UserRole.LECTURER })
  role: UserRole;

  @ApiProperty({ example: 'COM', nullable: true })
  departmentCode?: string | null;

  @ApiProperty({ example: 'd1e2f3a4-5b6c-7d8e-9f0a-1b2c3d4e5f6a', nullable: true })
  departmentId?: string | null;
}

export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT Bearer Access Token',
  })
  accessToken: string;

  @ApiProperty({ type: UserProfileDto })
  user: UserProfileDto;
}
