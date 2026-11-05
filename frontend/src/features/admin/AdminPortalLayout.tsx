import { AppLayout } from '../../components/layout/AppLayout';

const adminNavigation = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/users', label: 'User directory' },
  { to: '/admin/departments', label: 'Departments' },
  { to: '/admin/modules', label: 'Course modules' },
  { to: '/admin/workflows', label: 'Workflow setup' },
  { to: '/admin/audit', label: 'Audit trail' },
] as const;

export function AdminPortalLayout() {
  return (
    <AppLayout
      variant="admin"
      workspaceLabel="Administration"
      items={adminNavigation}
    />
  );
}
