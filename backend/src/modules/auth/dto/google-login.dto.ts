import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
    description: 'Google OAuth2 / OIDC ID Token obtained from Google Sign-In',
  })
  @IsString()
  @IsNotEmpty({ message: 'Google ID token is required' })
  idToken: string;
}
