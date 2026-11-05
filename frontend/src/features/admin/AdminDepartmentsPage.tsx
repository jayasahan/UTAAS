import { useState, type FormEvent } from 'react';
import { useSession } from '../../auth/session';
import { Alert, EmptyState, Skeleton } from '../../components/common/Feedback';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Table, TableCell, TableHead } from '../../components/common/Table';
import { ApiError } from '../../services/apiClient';
import { useRequestResource } from '../requests/useRequestResource';
import {
  decodeAdminUserList,
  decodeDepartment,
  decodeDepartmentPage,
  type AdminDepartment,
  type AdminUser,
} from './resourceContracts';

export function AdminDepartmentsPage() {
  const session = useSession();
  const client = session.client;
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [hodDepartment, setHodDepartment] = useState<AdminDepartment | null>(
    null,
  );
  const [staffOptions, setStaffOptions] = useState<AdminUser[]>([]);
  const [selectedHodId, setSelectedHodId] = useState('');
  const query: Record<string, string> = { page: String(page), limit: '20' };
  if (search) query.search = search;
  const departments = useRequestResource(
    '/admin/departments',
    decodeDepartmentPage,
    query,
  );

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function createDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    setPending(true);
    setError('');
    setNotice('');
    try {
      if (!client.post)
        throw new Error('Department management is unavailable.');
      await client.post('/admin/departments', { code, name }, decodeDepartment);
      setCode('');
      setName('');
      setShowCreate(false);
      setNotice('The department was created.');
      departments.retry();
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.validationMessages.length
          ? cause.validationMessages.join(' ')
          : cause instanceof ApiError
            ? cause.message
            : 'The department could not be created.',
      );
    } finally {
      setPending(false);
    }
  }

  async function manageHod(department: AdminDepartment) {
    if (!client) return;
    setError('');
    setHodDepartment(department);
    setSelectedHodId(department.hodUserId ?? '');
    setPending(true);
    try {
      const staff = await client.get(
        `/admin/departments/${encodeURIComponent(department.id)}/staff`,
        decodeAdminUserList,
      );
      setStaffOptions(
        staff.filter((user) => user.role === 'LECTURER' || user.role === 'HOD'),
      );
    } catch (cause) {
      setHodDepartment(null);
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Department staff could not be loaded.',
      );
    } finally {
      setPending(false);
    }
  }

  async function saveHod() {
    if (!client?.patch || !hodDepartment) return;
    if (
      !window.confirm(
        selectedHodId
          ? 'Assigning this staff member as HOD changes their role and invalidates their current session. Continue?'
          : 'Remove the current HOD assignment? The current HOD will return to the lecturer role.',
      )
    )
      return;
    setPending(true);
    setError('');
    setNotice('');
    try {
      await client.patch(
        `/admin/departments/${encodeURIComponent(hodDepartment.id)}`,
        { hodUserId: selectedHodId || null },
        decodeDepartment,
      );
      setNotice(
        selectedHodId
          ? 'Head of department updated.'
          : 'HOD assignment removed.',
      );
      setHodDepartment(null);
      departments.retry();
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.validationMessages.length
          ? cause.validationMessages.join(' ')
          : cause instanceof ApiError
            ? cause.message
            : 'The HOD assignment could not be updated.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="admin-departments-title" className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-action">
            Administration
          </p>
          <h1
            id="admin-departments-title"
            className="mt-1 text-display font-bold text-brand"
          >
            Departments
          </h1>
          <p className="mt-2 text-muted">
            Review department workload and register academic departments.
          </p>
        </div>
        <Button
          onClick={() => {
            setShowCreate((value) => !value);
            setError('');
          }}
        >
          {showCreate ? 'Close form' : 'Add department'}
        </Button>
      </header>

      {notice && (
        <Alert title="Saved" tone="success">
          <p>{notice}</p>
        </Alert>
      )}
      {error && (
        <Alert title="Could not save department" tone="danger" urgent>
          <p>{error}</p>
        </Alert>
      )}

      {showCreate && (
        <Card>
          <form
            onSubmit={createDepartment}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="sm:col-span-2">
              <h2 className="text-lg font-bold text-brand">
                Register department
              </h2>
              <p className="mt-1 text-sm text-muted">
                The department code must use uppercase letters, numbers, dashes,
                or underscores.
              </p>
            </div>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Department code
              <input
                required
                minLength={2}
                maxLength={20}
                pattern="[A-Z0-9_-]+"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                className="min-h-11 rounded-control border border-border px-3 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Department name
              <input
                required
                minLength={3}
                maxLength={150}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="min-h-11 rounded-control border border-border px-3 font-normal"
              />
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" pending={pending} disabled={!client}>
                Create department
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {hodDepartment && (
        <Card>
          <div className="grid gap-4 sm:grid-cols-[minmax(14rem,1fr)_auto_auto] sm:items-end">
            <div>
              <h2 className="text-lg font-bold text-brand">
                Head of {hodDepartment.code}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Select an active lecturer in this department. Role changes
                revoke the selected user’s current session.
              </p>
            </div>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              HOD
              <select
                value={selectedHodId}
                onChange={(event) => setSelectedHodId(event.target.value)}
                className="min-h-11 rounded-control border border-border bg-white px-3 font-normal"
              >
                <option value="">No HOD assigned</option>
                {staffOptions
                  .filter((user) => user.isActive)
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName} ·{' '}
                      {user.role === 'HOD' ? 'Current HOD' : 'Lecturer'}
                    </option>
                  ))}
              </select>
            </label>
            <div className="flex gap-2">
              <Button
                pending={pending}
                onClick={() => void saveHod()}
                disabled={!client?.patch}
              >
                Save HOD
              </Button>
              <Button variant="ghost" onClick={() => setHodDepartment(null)}>
                Cancel
              </Button>
            </div>
          </div>
          {staffOptions.length === 0 && (
            <p className="mt-3 text-sm text-muted">
              No lecturer or HOD accounts are assigned to this department.
            </p>
          )}
        </Card>
      )}

      <Card className="space-y-4">
        <form
          onSubmit={applySearch}
          className="grid gap-3 sm:grid-cols-[minmax(14rem,1fr)_auto] sm:items-end"
        >
          <label className="grid gap-1 text-sm font-semibold text-brand">
            Search department code or name
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="min-h-11 rounded-control border border-border px-3 font-normal"
            />
          </label>
          <Button type="submit">Search</Button>
        </form>

        {departments.status === 'loading' && (
          <Skeleton label="Loading departments" />
        )}
        {(departments.status === 'error' ||
          departments.status === 'unavailable') && (
          <Alert
            title={
              departments.errorKind === 'forbidden'
                ? 'Department directory access denied'
                : 'Department directory unavailable'
            }
            tone={departments.status === 'error' ? 'danger' : 'info'}
          >
            <p>{departments.message}</p>
            {departments.status === 'error' &&
              departments.errorKind !== 'forbidden' &&
              departments.errorKind !== 'unauthorized' && (
                <Button
                  className="mt-3"
                  variant="ghost"
                  onClick={departments.retry}
                >
                  Retry
                </Button>
              )}
          </Alert>
        )}
        {departments.data && departments.data.data.length === 0 && (
          <EmptyState title="No departments found">
            <p>Try another search or register a department.</p>
          </EmptyState>
        )}
        {departments.data && departments.data.data.length > 0 && (
          <>
            <Table caption="Department directory" variant="officer">
              <thead>
                <tr>
                  <TableHead>Department</TableHead>
                  <TableHead>Head of department</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Requests awaiting HOD review</TableHead>
                  <TableHead>HOD assignment</TableHead>
                </tr>
              </thead>
              <tbody>
                {departments.data.data.map((department) => (
                  <tr key={department.id}>
                    <TableCell>
                      <span className="font-semibold text-brand">
                        {department.code}
                      </span>
                      <span className="block text-xs text-muted">
                        {department.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      {department.hodName ?? 'Not assigned'}
                    </TableCell>
                    <TableCell>{department.staffCount}</TableCell>
                    <TableCell>{department.pendingRequestsCount}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        disabled={pending}
                        onClick={() => void manageHod(department)}
                      >
                        Manage HOD
                      </Button>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
              <p>
                Page {departments.data.meta.page} of{' '}
                {Math.max(departments.data.meta.totalPages, 1)} ·{' '}
                {departments.data.meta.total} departments
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  disabled={page <= 1 || departments.status === 'loading'}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  disabled={
                    page >= departments.data.meta.totalPages ||
                    departments.status === 'loading'
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
