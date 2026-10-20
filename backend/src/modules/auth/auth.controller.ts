import { Controller, Post, Body, Get, UseGuards, Param, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, UserProfileDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import { TestActorInfo } from './providers/mock-university-auth.provider';

@ApiTags('Authentication & Identity')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'University Identity SSO Login',
    description: 'Authenticates a university faculty or staff member and returns a JWT access token',
  })
  @ApiResponse({ status: 200, description: 'Authentication successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid university credentials or unverified identity' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('mock-login/:role')
  @ApiOperation({
    summary: 'One-Click Persona Login (Development / Testing)',
    description: 'Instant login as one of the 7 standard university test personas',
  })
  @ApiParam({
    name: 'role',
    enum: UserRole,
    description: 'Role persona to impersonate for testing',
  })
  @ApiResponse({ status: 200, description: 'Mock login successful', type: AuthResponseDto })
  async mockLoginRole(@Param('role') role: UserRole): Promise<AuthResponseDto> {
    const roleEmailMap: Record<UserRole, string> = {
      [UserRole.LECTURER]: 'lecturer@eng.ruh.ac.lk',
      [UserRole.HOD]: 'hod.computer@eng.ruh.ac.lk',
      [UserRole.DEAN]: 'dean@eng.ruh.ac.lk',
      [UserRole.EXAMINATION_OFFICER]: 'exam.officer@eng.ruh.ac.lk',
      [UserRole.FINANCIAL_OFFICER]: 'finance.officer@eng.ruh.ac.lk',
      [UserRole.ASSISTANT_BURSAR]: 'asst.bursar@eng.ruh.ac.lk',
      [UserRole.ADMIN]: 'admin@eng.ruh.ac.lk',
    };

    const email = roleEmailMap[role];
    if (!email) {
      throw new BadRequestException(`Unknown role persona: ${role}`);
    }

    return this.authService.login({ email });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Current Authenticated User Profile',
    description: 'Returns profile, role, and department of the logged-in university member',
  })
  @ApiResponse({ status: 200, description: 'Current user profile', type: UserProfileDto })
  @ApiResponse({ status: 401, description: 'Unauthorized / Token invalid' })
  async getProfile(@CurrentUser() user: User): Promise<UserProfileDto> {
    return this.authService.getProfile(user.id);
  }

  @Get('test-actors')
  @ApiOperation({
    summary: 'List Seeded University Test Personas',
    description: 'Returns the list of seeded university actors for workflow testing and role verification',
  })
  @ApiResponse({ status: 200, description: 'List of test actors' })
  getTestActors(): TestActorInfo[] {
    return this.authService.getTestActors();
  }
}
