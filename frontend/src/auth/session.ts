import { createContext, useContext } from 'react';
import type { ApiClient } from '../services/apiClient';
export type SessionStatus =
  | 'unavailable'
  | 'signed-out'
  | 'signing-in'
  | 'authenticated'
  | 'expired'
  | 'unauthorized'
  | 'error';
export interface Session {
  status: SessionStatus;
  message: string;
  client: ApiClient | null;
  version: number;
}
export const SessionContext = createContext<Session>({
  status: 'unavailable',
  message:
    'Authenticated identity and rates are unavailable. Production authentication is not implemented.',
  client: null,
  version: 0,
});
export function useSession(): Session {
  return useContext(SessionContext);
}
