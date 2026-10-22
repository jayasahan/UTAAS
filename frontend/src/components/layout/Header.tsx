import { useNavigate } from 'react-router-dom';
import { Button } from '../common/Button';
import { useSession } from '../../auth/session';

const roleNames = {
  LECTURER: 'Lecturer',
  HOD: 'Head of Department',
  DEAN: 'Dean',
  EXAMINATION_OFFICER: 'Examination Officer',
  FINANCIAL_OFFICER: 'Financial Officer',
  ASSISTANT_BURSAR: 'Assistant Bursar',
  ADMIN: 'Administrator',
} as const;

export function Header({ workspaceLabel }: { workspaceLabel: string }) {
  const session = useSession();
  const navigate = useNavigate();
  async function signOut() {
    if (!session.logout) return;
    const logoutRequest = session.logout();
    navigate('/login', { replace: true });
    await logoutRequest;
  }

  return (
    <header className="flex min-h-18 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 text-sm text-brand md:px-9">
      <span>University of Ruhuna / {workspaceLabel}</span>
      {!import.meta.env.DEV && session.user && session.logout && (
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="font-semibold">{session.user.fullName}</p>
            <p className="text-xs text-muted">
              {roleNames[session.user.role]}
              {session.user.departmentCode
                ? ` · ${session.user.departmentCode}`
                : ''}
            </p>
          </div>
          <Button
            variant="ghost"
            pending={session.status === 'signing-out'}
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
        </div>
      )}
    </header>
  );
}
