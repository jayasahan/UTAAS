import { ConfigService } from '@nestjs/config';
import { getJwtSecret, DEFAULT_JWT_SECRET, DEV_SAMPLE_JWT_SECRET } from './auth.constants';

describe('auth.constants - getJwtSecret', () => {
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn(),
    } as any;
  });

  describe('in development environment', () => {
    it('should return default secret if JWT_SECRET is not configured', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'JWT_SECRET') return undefined;
        return defaultValue;
      });

      const secret = getJwtSecret(mockConfigService);
      expect(secret).toBe(DEFAULT_JWT_SECRET);
    });

    it('should return configured secret if set', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'JWT_SECRET') return 'custom-dev-secret';
        return defaultValue;
      });

      const secret = getJwtSecret(mockConfigService);
      expect(secret).toBe('custom-dev-secret');
    });
  });

  describe('in production environment', () => {
    it('should throw an error if JWT_SECRET is missing', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'JWT_SECRET') return undefined;
        return defaultValue;
      });

      expect(() => getJwtSecret(mockConfigService)).toThrow(
        /Production security violation: JWT_SECRET must be explicitly set/,
      );
    });

    it('should throw an error if JWT_SECRET is the default fallback secret', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'JWT_SECRET') return DEFAULT_JWT_SECRET;
        return defaultValue;
      });

      expect(() => getJwtSecret(mockConfigService)).toThrow(
        /Production security violation: JWT_SECRET must be explicitly set and cannot use default\/fallback secrets/,
      );
    });

    it('should throw an error if JWT_SECRET is the dev sample secret', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'JWT_SECRET') return DEV_SAMPLE_JWT_SECRET;
        return defaultValue;
      });

      expect(() => getJwtSecret(mockConfigService)).toThrow(
        /Production security violation: JWT_SECRET must be explicitly set and cannot use default\/fallback secrets/,
      );
    });

    it('should throw an error if JWT_SECRET is less than 32 characters', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'JWT_SECRET') return 'short-secret-key-too-short!';
        return defaultValue;
      });

      expect(() => getJwtSecret(mockConfigService)).toThrow(
        /Production security violation: JWT_SECRET must be at least 32 characters long/,
      );
    });

    it('should return valid secret if >= 32 characters in production', () => {
      const validProductionSecret = 'a-very-secure-production-jwt-secret-key-at-least-32-chars-long';
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'JWT_SECRET') return validProductionSecret;
        return defaultValue;
      });

      const secret = getJwtSecret(mockConfigService);
      expect(secret).toBe(validProductionSecret);
    });
  });
});
