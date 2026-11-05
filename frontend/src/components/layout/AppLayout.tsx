import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import type { NavigationItem } from './Sidebar';
import { Header } from './Header';
import { PageContainer } from './PageContainer';
import { useSession } from '../../auth/session';

const navigation = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/requests', label: 'My Applications', end: true },
  { to: '/requests/new', label: 'New Application', end: true },
];

interface AppLayoutProps {
  variant?: 'lecturer' | 'officer' | 'admin';
  items?: readonly NavigationItem[];
  workspaceLabel?: string;
}
export function AppLayout({
  variant = 'lecturer',
  items,
  workspaceLabel = 'Faculty Administration',
}: AppLayoutProps) {
  const session = useSession();
  const defaultItems =
    variant === 'lecturer' && session.user?.role === 'LECTURER'
      ? navigation
      : [];
  return (
    <div
      className={
        'min-h-screen md:grid ' +
        (variant === 'officer'
          ? 'md:grid-cols-[14.875rem_1fr]'
          : variant === 'admin'
            ? 'md:grid-cols-[14.875rem_1fr]'
            : 'md:grid-cols-[15.375rem_1fr]')
      }
    >
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Sidebar
        items={items ?? defaultItems}
        portalLabel={
          variant === 'officer'
            ? 'Officer portal'
            : variant === 'admin'
              ? 'Admin portal'
              : 'Lecturer portal'
        }
      />
      <div className="min-w-0">
        <Header workspaceLabel={workspaceLabel} />
        <PageContainer>
          <Outlet />
        </PageContainer>
      </div>
    </div>
  );
}
