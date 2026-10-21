import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { StaffProfile } from '../../auth/contracts';
import type { RequestResource } from '../requests/useRequestResource';

export interface OfficerAccess {
  profile: RequestResource<StaffProfile>;
  allowed: boolean;
  departmentScopeMissing: boolean;
}

const OfficerAccessContext = createContext<OfficerAccess | null>(null);

export const OfficerAccessProvider = OfficerAccessContext.Provider;

export function useOfficerAccess(): OfficerAccess {
  const access = useContext(OfficerAccessContext);
  if (!access) throw new Error('Officer pages require OfficerPortalLayout.');
  return access;
}

export interface OfficerAccessFeedbackProps {
  children: ReactNode;
}
