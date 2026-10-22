import { ConfigService } from '@nestjs/config';

export const DEFAULT_JWT_SECRET = 'utaas-secure-jwt-secret-key-2026';
export const DEV_SAMPLE_JWT_SECRET = 'utaas_development_super_secret_jwt_key_2026';

export function getJwtSecret(config: ConfigService): string {
  const nodeEnv = config.get<string>('NODE_ENV', process.env.NODE_ENV || 'development');
  const secret = config.get<string>('JWT_SECRET');

  if (nodeEnv === 'production') {
    if (!secret || secret === DEFAULT_JWT_SECRET || secret === DEV_SAMPLE_JWT_SECRET) {
      throw new Error(
        'Production security violation: JWT_SECRET must be explicitly set and cannot use default/fallback secrets in production',
      );
    }
    if (secret.length < 32) {
      throw new Error(
        'Production security violation: JWT_SECRET must be at least 32 characters long for production cryptographic safety',
      );
    }
    return secret;
  }

  return secret || DEFAULT_JWT_SECRET;
}
