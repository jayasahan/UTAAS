import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { User } from '../../database/entities/user.entity';
import { Department } from '../../database/entities/department.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AUTH_PROVIDER } from './interfaces/auth-provider.interface';
import { MockUniversityAuthProvider } from './providers/mock-university-auth.provider';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { DepartmentScopeGuard } from './guards/department-scope.guard';
import { getJwtSecret } from './auth.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Department]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: getJwtSecret(config),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN') || config.get<string>('JWT_EXPIRATION') || '1d',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    DepartmentScopeGuard,
    MockUniversityAuthProvider,
    {
      provide: AUTH_PROVIDER,
      useExisting: MockUniversityAuthProvider,
    },
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    DepartmentScopeGuard,
    PassportModule,
    JwtModule,
    AUTH_PROVIDER,
  ],
})
export class AuthModule {}
