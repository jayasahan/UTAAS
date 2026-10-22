import { createContext, useContext } from 'react';
import type { ApiClient } from '../services/apiClient';
import type { StaffProfile } from './contracts';
export type SessionStatus =
  | 'unavailable'
  | 'initializing'
  | 'signed-out'
  | 'signing-in'
  | 'signing-out'
  | 'authenticated'
  | 'expired'
  | 'unauthorized'
  | 'error';
export interface Session {
  status: SessionStatus;
  message: string;
  client: ApiClient | null;
  version: number;
  user?: StaffProfile | null;
  login?: (email: string, password: string) => Promise<StaffProfile>;
  logout?: () => Promise<boolean>;
}
export const SessionContext = createContext<Session>({
  status: 'unavailable',
  message:
    'Authenticated identity and rates are unavailable. Production authentication is not implemented.',
  client: null,
  version: 0,
  user: null,
});
export function useSession(): Session {
  return useContext(SessionContext);
}
