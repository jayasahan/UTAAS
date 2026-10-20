import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { AUTH_PROVIDER, IAuthProvider } from './interfaces/auth-provider.interface';
import { MockUniversityAuthProvider, TestActorInfo } from './providers/mock-university-auth.provider';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, UserProfileDto } from './dto/auth-response.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(AUTH_PROVIDER)
    private readonly authProvider: IAuthProvider,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.authProvider.authenticate(loginDto.email, loginDto.password);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId || user.department?.id || null,
      departmentCode: user.department?.code || null,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: this.mapToProfileDto(user),
    };
  }

  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['department'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.mapToProfileDto(user);
  }

  getTestActors(): TestActorInfo[] {
    if (this.authProvider instanceof MockUniversityAuthProvider) {
      return this.authProvider.getTestActors();
    }
    return [];
  }

  private mapToProfileDto(user: User): UserProfileDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      departmentCode: user.department?.code || null,
      departmentId: user.departmentId || user.department?.id || null,
    };
  }
}
