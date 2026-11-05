import { useState, type FormEvent } from 'react';
import { userRoles } from '../../auth/contracts';
import { useSession } from '../../auth/session';
import { Alert, EmptyState, Skeleton } from '../../components/common/Feedback';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Table, TableCell, TableHead } from '../../components/common/Table';
import { ApiError } from '../../services/apiClient';
import { useRequestResource } from '../requests/useRequestResource';
import {
  decodeAdminUser,
  decodeAdminUserPage,
  decodeDepartmentPage,
  type AdminRole,
  type AdminUser,
} from './resourceContracts';

const roleLabels: Record<AdminRole, string> = {
  LECTURER: 'Lecturer',
  HOD: 'Head of Department',
  DEAN: 'Dean',
  EXAMINATION_OFFICER: 'Examination Officer',
  FINANCIAL_OFFICER: 'Financial Officer',
  ASSISTANT_BURSAR: 'Assistant Bursar',
  ADMIN: 'Administrator',
};
const requiresDepartment = (role: AdminRole) =>
  role === 'LECTURER' || role === 'HOD';

function messageFor(error: unknown): string {
  if (error instanceof ApiError && error.validationMessages.length)
    return error.validationMessages.join(' ');
  return error instanceof ApiError
    ? error.message
    : 'The change could not be saved.';
}

export function AdminUsersPage() {
  const session = useSession();
  const client = session.client;
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [isActive, setIsActive] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editRole, setEditRole] = useState<AdminRole>('LECTURER');
  const [editDepartmentId, setEditDepartmentId] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('LECTURER');
  const [departmentId, setDepartmentId] = useState('');
  const [password, setPassword] = useState('');

  const query: Record<string, string> = { page: String(page), limit: '10' };
  if (search) query.search = search;
  if (role) query.role = role;
  if (departmentFilter) query.departmentId = departmentFilter;
  if (isActive) query.isActive = isActive;
  const users = useRequestResource('/admin/users', decodeAdminUserPage, query);
  const departments = useRequestResource(
    '/admin/departments',
    decodeDepartmentPage,
    { page: '1', limit: '100' },
  );

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    setError('');
    setNotice('');
    setPendingId('new');
    try {
      await client.post(
        '/admin/users',
        {
          fullName,
          email,
          role: newRole,
          ...(designation.trim() ? { designation: designation.trim() } : {}),
          ...(departmentId ? { departmentId } : {}),
          password,
        },
        decodeAdminUser,
      );
      setFullName('');
      setEmail('');
      setDesignation('');
      setDepartmentId('');
      setPassword('');
      setShowCreate(false);
      setNotice('The user account was created.');
      users.retry();
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setPendingId(null);
    }
  }

  async function toggleUser(id: string, active: boolean) {
    if (!client) return;
    setError('');
    setNotice('');
    setPendingId(id);
    try {
      if (!client.patch) throw new Error('Account management is unavailable.');
      await client.patch(
        `/admin/users/${encodeURIComponent(id)}/status`,
        {
          isActive: !active,
        },
        (value) => {
          const result = value as { user?: unknown };
          if (!result || typeof result !== 'object' || !result.user)
            throw new Error('Invalid user status response');
          return decodeAdminUser(result.user);
        },
      );
      setNotice(`The account was ${active ? 'deactivated' : 'activated'}.`);
      users.retry();
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setPendingId(null);
    }
  }

  function beginEdit(user: AdminUser) {
    setEditingUser(user);
    setEditName(user.fullName);
    setEditEmail(user.email);
    setEditDesignation(user.designation ?? '');
    setEditRole(user.role);
    setEditDepartmentId(user.departmentId ?? '');
    setEditPassword('');
    setShowCreate(false);
    setError('');
    setNotice('');
  }

  async function updateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !editingUser?.id || !client.patch) return;
    const securityChange =
      editRole !== editingUser.role || Boolean(editPassword);
    if (
      securityChange &&
      !window.confirm(
        'Changing this role or resetting this password will invalidate the user’s current sign-in session. Continue?',
      )
    )
      return;
    setPendingId(editingUser.id);
    setError('');
    setNotice('');
    try {
      await client.patch(
        `/admin/users/${encodeURIComponent(editingUser.id)}`,
        {
          fullName: editName,
          email: editEmail,
          role: editRole,
          designation: editDesignation,
          departmentId: editDepartmentId || null,
          ...(editPassword ? { password: editPassword } : {}),
        },
        decodeAdminUser,
      );
      setEditingUser(null);
      setEditPassword('');
      setNotice('The user account was updated.');
      users.retry();
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section aria-labelledby="admin-users-title" className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-action">
            Administration
          </p>
          <h1
            id="admin-users-title"
            className="mt-1 text-display font-bold text-brand"
          >
            User directory
          </h1>
          <p className="mt-2 text-muted">
            Find staff accounts, assign roles, and manage account access.
          </p>
        </div>
        <Button
          onClick={() => {
            setShowCreate((value) => !value);
            setError('');
          }}
        >
          {showCreate ? 'Close form' : 'Add user'}
        </Button>
      </header>

      {notice && (
        <Alert title="Saved" tone="success">
          <p>{notice}</p>
        </Alert>
      )}
      {error && (
        <Alert title="Could not save changes" tone="danger" urgent>
          <p>{error}</p>
        </Alert>
      )}

      {showCreate && (
        <Card>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={createUser}>
            <div className="md:col-span-2">
              <h2 className="text-lg font-bold text-brand">
                Create staff account
              </h2>
              <p className="mt-1 text-sm text-muted">
                The initial password is set here and is never shown again.
              </p>
            </div>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Full name
              <input
                required
                maxLength={160}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="min-h-11 rounded-control border border-border px-3 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Institutional email
              <input
                required
                type="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11 rounded-control border border-border px-3 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Role
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as AdminRole)}
                className="min-h-11 rounded-control border border-border bg-white px-3 font-normal"
              >
                {userRoles.map((item) => (
                  <option key={item} value={item}>
                    {roleLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Department{requiresDepartment(newRole) ? ' (required)' : ''}
              <select
                required={requiresDepartment(newRole)}
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="min-h-11 rounded-control border border-border bg-white px-3 font-normal"
              >
                <option value="">
                  {departments.status === 'ready'
                    ? 'No department'
                    : 'Loading departments…'}
                </option>
                {departments.data?.data.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Designation{' '}
              <span className="font-normal text-muted">(optional)</span>
              <input
                maxLength={120}
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="min-h-11 rounded-control border border-border px-3 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Initial password
              <input
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-11 rounded-control border border-border px-3 font-normal"
              />
            </label>
            {departments.status !== 'ready' && (
              <p className="text-sm text-muted md:col-span-2">
                Department choices are unavailable, so account creation is
                paused.
              </p>
            )}
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button
                type="submit"
                pending={pendingId === 'new'}
                disabled={!client || departments.status !== 'ready'}
              >
                Create account
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {editingUser && (
        <Card>
          <form onSubmit={updateUser} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <h2 className="text-lg font-bold text-brand">
                Edit {editingUser.fullName}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Role or password changes revoke the user’s current session.
              </p>
            </div>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Full name
              <input
                required
                maxLength={160}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="min-h-11 rounded-control border border-border px-3 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Email
              <input
                required
                type="email"
                maxLength={254}
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="min-h-11 rounded-control border border-border px-3 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Role
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as AdminRole)}
                className="min-h-11 rounded-control border border-border bg-white px-3 font-normal"
              >
                {userRoles.map((item) => (
                  <option key={item} value={item}>
                    {roleLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Department{requiresDepartment(editRole) ? ' (required)' : ''}
              <select
                required={requiresDepartment(editRole)}
                value={editDepartmentId}
                onChange={(e) => setEditDepartmentId(e.target.value)}
                className="min-h-11 rounded-control border border-border bg-white px-3 font-normal"
              >
                <option value="">No department</option>
                {departments.data?.data.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Designation
              <input
                maxLength={120}
                value={editDesignation}
                onChange={(e) => setEditDesignation(e.target.value)}
                className="min-h-11 rounded-control border border-border px-3 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Reset password{' '}
              <span className="font-normal text-muted">
                (leave blank to keep current)
              </span>
              <input
                type="password"
                minLength={6}
                autoComplete="new-password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                className="min-h-11 rounded-control border border-border px-3 font-normal"
              />
            </label>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button
                type="submit"
                pending={pendingId === editingUser.id}
                disabled={!client || !client.patch}
              >
                Save changes
              </Button>
              <Button variant="ghost" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="space-y-4">
        <form
          onSubmit={applySearch}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_auto_auto_auto_auto] xl:items-end"
        >
          <label className="grid gap-1 text-sm font-semibold text-brand">
            Search name or email
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="min-h-11 rounded-control border border-border px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-brand">
            Department
            <select
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setPage(1);
              }}
              className="min-h-11 rounded-control border border-border bg-white px-3 font-normal"
            >
              <option value="">All departments</option>
              {departments.data?.data.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-brand">
            Role
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
              className="min-h-11 rounded-control border border-border bg-white px-3 font-normal"
            >
              <option value="">All roles</option>
              {userRoles.map((item) => (
                <option key={item} value={item}>
                  {roleLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-brand">
            Account
            <select
              value={isActive}
              onChange={(e) => {
                setIsActive(e.target.value);
                setPage(1);
              }}
              className="min-h-11 rounded-control border border-border bg-white px-3 font-normal"
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <Button type="submit">Search</Button>
        </form>

        {users.status === 'loading' && <Skeleton label="Loading users" />}
        {(users.status === 'error' || users.status === 'unavailable') && (
          <Alert
            title={
              users.errorKind === 'forbidden'
                ? 'User directory access denied'
                : 'User directory unavailable'
            }
            tone={users.status === 'error' ? 'danger' : 'info'}
          >
            <p>{users.message}</p>
            {users.status === 'error' &&
              users.errorKind !== 'forbidden' &&
              users.errorKind !== 'unauthorized' && (
                <Button className="mt-3" variant="ghost" onClick={users.retry}>
                  Retry
                </Button>
              )}
          </Alert>
        )}
        {users.data && users.data.data.length === 0 && (
          <EmptyState title="No matching users">
            <p>Adjust the filters or create an account.</p>
          </EmptyState>
        )}
        {users.data && users.data.data.length > 0 && (
          <>
            <Table caption="Staff user directory" variant="officer">
              <thead>
                <tr>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </tr>
              </thead>
              <tbody>
                {users.data.data.map((user) => (
                  <tr key={user.id}>
                    <TableCell>
                      <span className="font-semibold text-brand">
                        {user.fullName}
                      </span>
                      <span className="block text-xs text-muted">
                        {user.email}
                      </span>
                      {user.designation && (
                        <span className="block text-xs text-muted">
                          {user.designation}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{roleLabels[user.role]}</TableCell>
                    <TableCell>{user.departmentName ?? '—'}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${user.isActive ? 'bg-success-subtle text-success-ink' : 'bg-slate-100 text-slate-700'}`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="ghost"
                          disabled={pendingId !== null}
                          onClick={() => beginEdit(user)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          pending={pendingId === user.id}
                          disabled={pendingId !== null}
                          onClick={() =>
                            void toggleUser(user.id, user.isActive)
                          }
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
              <p>
                Page {users.data.meta.page} of{' '}
                {Math.max(users.data.meta.totalPages, 1)} ·{' '}
                {users.data.meta.total} accounts
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  disabled={page <= 1 || users.status === 'loading'}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  disabled={
                    page >= users.data.meta.totalPages ||
                    users.status === 'loading'
                  }
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </section>
  );
}
