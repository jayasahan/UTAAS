import { User } from '../../../database/entities/user.entity';

export interface IAuthProvider {
  authenticate(email: string, password?: string): Promise<User>;
}

export const AUTH_PROVIDER = 'AUTH_PROVIDER';
