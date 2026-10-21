import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import type { NavigationItem } from './Sidebar';
import { Header } from './Header';
import { PageContainer } from './PageContainer';

const navigation = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/requests', label: 'My Applications', end: true },
  { to: '/requests/new', label: 'New Application', end: true },
];

interface AppLayoutProps {
  variant?: 'lecturer' | 'officer';
  items?: readonly NavigationItem[];
  workspaceLabel?: string;
}
export function AppLayout({
  variant = 'lecturer',
  items = navigation,
  workspaceLabel = 'Faculty Administration',
}: AppLayoutProps) {
  return (
    <div
      className={
        'min-h-screen md:grid ' +
        (variant === 'officer'
          ? 'md:grid-cols-[14.875rem_1fr]'
          : 'md:grid-cols-[15.375rem_1fr]')
      }
    >
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Sidebar
        items={items}
        portalLabel={
          variant === 'officer' ? 'Officer portal' : 'Lecturer portal'
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
