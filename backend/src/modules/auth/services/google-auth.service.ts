import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../../database/entities/user.entity';
import { Department } from '../../../database/entities/department.entity';

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private oauthClient: OAuth2Client;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    this.oauthClient = new OAuth2Client(clientId);
  }

  async verifyAndAuthenticate(idToken: string): Promise<User> {
    if (!idToken || typeof idToken !== 'string') {
      throw new UnauthorizedException('Valid Google ID token is required');
    }

    let payload: any;
    try {
      const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
      const ticket = await this.oauthClient.verifyIdToken({
        idToken,
        audience: clientId || undefined,
      });
      payload = ticket.getPayload();
    } catch (err) {
      this.logger.warn(`Google token verification failed: ${err.message}`);
      throw new UnauthorizedException(`Invalid Google ID token: ${err.message}`);
    }

    if (!payload || !payload.email) {
      throw new UnauthorizedException('Google ID token did not contain an email');
    }

    const email = payload.email.trim().toLowerCase();
    const isEmailVerified = payload.email_verified;

    if (!isEmailVerified) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    // Enforce university domain restriction
    const isUniversityDomain = email.endsWith('@eng.ruh.ac.lk') || email.endsWith('@ruh.ac.lk');
    if (!isUniversityDomain) {
      throw new UnauthorizedException(
        `Access restricted to University of Ruhuna accounts (@eng.ruh.ac.lk / @ruh.ac.lk). Attempted login with: ${email}`,
      );
    }

    // Check if user exists in database
    let user = await this.userRepository.findOne({
      where: { email },
      relations: ['department'],
    });

    if (user) {
      if (!user.isActive) {
        throw new UnauthorizedException('University account has been deactivated');
      }
      return user;
    }

    // Auto-provision verified university Google user as LECTURER in default COM department
    const defaultDept = await this.departmentRepository.findOne({
      where: { code: 'COM' },
    });

    const fullName = payload.name || payload.email.split('@')[0];

    user = this.userRepository.create({
      email,
      fullName: fullName.startsWith('Dr.') || fullName.startsWith('Prof.') ? fullName : `Dr. ${fullName}`,
      role: UserRole.LECTURER,
      department: defaultDept || undefined,
      departmentId: defaultDept?.id || undefined,
      isActive: true,
    });

    this.logger.log(`Auto-provisioning verified Google university user: ${email}`);
    return await this.userRepository.save(user);
  }
}
