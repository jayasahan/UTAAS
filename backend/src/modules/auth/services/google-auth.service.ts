import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../database/entities/user.entity';

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private oauthClient: OAuth2Client;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    this.oauthClient = new OAuth2Client(clientId);
  }

  async verifyAndAuthenticate(idToken: string): Promise<User> {
    if (!idToken || typeof idToken !== 'string') {
      throw new UnauthorizedException('Valid Google ID token is required');
    }

    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new UnauthorizedException(
        'Google OAuth authentication is not configured on the server (GOOGLE_CLIENT_ID is missing)',
      );
    }

    let payload: any;
    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken,
        audience: clientId,
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

    // Check if user exists in database with verified role and department
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['department'],
    });

    if (!user) {
      throw new UnauthorizedException(
        `User account '${email}' is not registered in UTAAS. Access is restricted to pre-registered university faculty and staff.`,
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException('University account has been deactivated');
    }

    return user;
  }
}
