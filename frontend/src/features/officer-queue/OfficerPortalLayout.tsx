import { decodeProfile } from '../../auth/contracts';
import { AppLayout } from '../../components/layout/AppLayout';
import { useRequestResource } from '../requests/useRequestResource';
import { officerQueueRoles } from './contracts';
import { OfficerAccessProvider } from './officerAccess';
import { useOfficerAccess } from './officerAccess';
import type { OfficerAccessFeedbackProps } from './officerAccess';

const officerNavigation = [
  { to: '/officer', label: 'Dashboard', end: true },
  { to: '/officer/queue', label: 'Approval Queue', end: false },
  { to: '/officer/review-history', label: 'Review History', end: true },
] as const;

export function OfficerPortalLayout() {
  const profile = useRequestResource('/auth/me', decodeProfile);
  const role = profile.data?.role;
  const isOfficer = Boolean(
    role && officerQueueRoles.some((allowedRole) => allowedRole === role),
  );
  const departmentScopeMissing = role === 'HOD' && !profile.data?.departmentId;
  const allowed = isOfficer && !departmentScopeMissing;

  return (
    <OfficerAccessProvider value={{ profile, allowed, departmentScopeMissing }}>
      <AppLayout
        variant="officer"
        workspaceLabel="Officer Portal"
        items={
          allowed
            ? role === 'ADMIN'
              ? officerNavigation.slice(1)
              : officerNavigation
            : []
        }
      />
    </OfficerAccessProvider>
  );
}

export function OfficerAccessFeedback({
  children,
}: OfficerAccessFeedbackProps) {
  const { profile, allowed, departmentScopeMissing } = useOfficerAccess();
  if (profile.status === 'loading')
    return (
      <div
        role="status"
        className="rounded-card border border-border bg-surface p-6"
      >
        <span className="sr-only">Loading authenticated officer profile</span>
        <div
          aria-hidden="true"
          className="h-5 w-2/3 animate-pulse rounded bg-slate-200"
        />
        <div aria-hidden="true" className="mt-3 h-5 rounded bg-slate-200" />
      </div>
    );
  if (profile.status === 'error' || profile.status === 'unavailable')
    return (
      <div
        role="status"
        className="rounded-control border border-info-ink/20 bg-info-subtle p-4 text-info-ink"
      >
        <p className="font-semibold">Officer access is unavailable</p>
        <p className="mt-2 text-sm">{profile.message}</p>
        {profile.status === 'error' && (
          <button
            type="button"
            onClick={profile.retry}
            className="mt-3 rounded-control border border-current px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          >
            Retry
          </button>
        )}
      </div>
    );
  if (!allowed)
    return (
      <div
        role="alert"
        className="rounded-control border border-danger/20 bg-red-50 p-4 text-red-900"
      >
        <p className="font-semibold">
          {departmentScopeMissing
            ? 'Your department assignment is unavailable.'
            : 'This account does not have an officer queue role.'}
        </p>
        <p className="mt-2 text-sm">
          {departmentScopeMissing
            ? 'The queue was not requested because its department scope cannot be verified.'
            : 'The queue is available only to a verified reviewer or administrator account.'}
        </p>
      </div>
    );
  return children;
}
