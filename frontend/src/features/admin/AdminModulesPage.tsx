import { useState, type FormEvent } from 'react';
import { useSession } from '../../auth/session';
import { Alert, EmptyState, Skeleton } from '../../components/common/Feedback';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Table, TableCell, TableHead } from '../../components/common/Table';
import { ApiError } from '../../services/apiClient';
import { useRequestResource } from '../requests/useRequestResource';
import {
  decodeDepartmentPage,
  decodeAdminModule,
  decodeAdminModulePage,
} from './resourceContracts';

export function AdminModulesPage() {
  const client = useSession().client;
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [semester, setSemester] = useState('1');
  const [credits, setCredits] = useState('3');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const query: Record<string, string> = { page: String(page), limit: '50' };
  if (search) query.search = search;
  if (departmentId) query.departmentId = departmentId;
  if (activeFilter) query.isActive = activeFilter;
  const modules = useRequestResource(
    '/admin/modules',
    decodeAdminModulePage,
    query,
  );
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

  async function createModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    setPendingId('new');
    setError('');
    setNotice('');
    try {
      await client.post(
        '/admin/modules',
        {
          code,
          name,
          departmentId,
          semester: Number(semester),
          credits: Number(credits),
        },
        decodeAdminModule,
      );
      setCode('');
      setName('');
      setNotice('The course module was created.');
      setShowCreate(false);
      modules.retry();
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.validationMessages.length
          ? cause.validationMessages.join(' ')
          : cause instanceof ApiError
            ? cause.message
            : 'The course module could not be created.',
      );
    } finally {
      setPendingId(null);
    }
  }

  async function setActive(id: string, isActive: boolean) {
    if (!client?.patch) return;
    setPendingId(id);
    setError('');
    setNotice('');
    try {
      await client.patch(
        `/admin/modules/${encodeURIComponent(id)}`,
        { isActive: !isActive },
        decodeAdminModule,
      );
      setNotice(`The module was ${isActive ? 'archived' : 'activated'}.`);
      modules.retry();
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.validationMessages.length
          ? cause.validationMessages.join(' ')
          : cause instanceof ApiError
            ? cause.message
            : 'The module status could not be changed.',
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section aria-labelledby="admin-modules-title" className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-action">
            Administration
          </p>
          <h1
            id="admin-modules-title"
            className="mt-1 text-display font-bold text-brand"
          >
            Course modules
          </h1>
          <p className="mt-2 text-muted">
            Maintain the active curriculum used by academic claim forms.
          </p>
        </div>
        <Button
          onClick={() => {
            setShowCreate((value) => !value);
            setError('');
          }}
        >
          {showCreate ? 'Close form' : 'Add module'}
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
          <form
            onSubmit={createModule}
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            <h2 className="text-lg font-bold text-brand sm:col-span-2 xl:col-span-3">
              Add course module
            </h2>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Module code
              <input
                required
                minLength={4}
                maxLength={20}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="min-h-11 rounded-control border border-border px-3 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Module title
              <input
                required
                minLength={3}
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-h-11 rounded-control border border-border px-3 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Department
              <select
                required
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="min-h-11 rounded-control border border-border bg-white px-3 font-normal"
              >
                <option value="">Select department</option>
                {departments.data?.data.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} · {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Semester
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="min-h-11 rounded-control border border-border bg-white px-3 font-normal"
              >
                {Array.from({ length: 8 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Semester {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Credits
              <select
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                className="min-h-11 rounded-control border border-border bg-white px-3 font-normal"
              >
                {Array.from({ length: 6 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1} credits
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2 sm:col-span-2 xl:col-span-3">
              <Button
                type="submit"
                pending={pendingId === 'new'}
                disabled={!client || departments.status !== 'ready'}
              >
                Create module
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}
      <Card className="space-y-4">
        <form
          onSubmit={applySearch}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_minmax(12rem,auto)_auto_auto] xl:items-end"
        >
          <label className="grid gap-1 text-sm font-semibold text-brand">
            Search code or title
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="min-h-11 rounded-control border border-border px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-brand">
            Department
            <select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setPage(1);
              }}
              className="min-h-11 rounded-control border border-border bg-white px-3 font-normal"
            >
              <option value="">All departments</option>
              {departments.data?.data.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-brand">
            Status
            <select
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value);
                setPage(1);
              }}
              className="min-h-11 rounded-control border border-border bg-white px-3 font-normal"
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Archived</option>
            </select>
          </label>
          <Button type="submit">Search</Button>
        </form>
        {modules.status === 'loading' && (
          <Skeleton label="Loading course modules" />
        )}
        {(modules.status === 'error' || modules.status === 'unavailable') && (
          <Alert
            title={
              modules.errorKind === 'forbidden'
                ? 'Module directory access denied'
                : 'Course modules unavailable'
            }
            tone={modules.status === 'error' ? 'danger' : 'info'}
          >
            <p>{modules.message}</p>
            {modules.status === 'error' &&
              modules.errorKind !== 'forbidden' &&
              modules.errorKind !== 'unauthorized' && (
                <Button
                  className="mt-3"
                  variant="ghost"
                  onClick={modules.retry}
                >
                  Retry
                </Button>
              )}
          </Alert>
        )}
        {modules.data && modules.data.data.length === 0 && (
          <EmptyState title="No modules found">
            <p>Try other filters or add a module.</p>
          </EmptyState>
        )}
        {modules.data && modules.data.data.length > 0 && (
          <>
            <Table caption="Course module directory" variant="officer">
              <thead>
                <tr>
                  <TableHead>Module</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </tr>
              </thead>
              <tbody>
                {modules.data.data.map((module) => (
                  <tr key={module.id}>
                    <TableCell>
                      <span className="font-semibold text-brand">
                        {module.code}
                      </span>
                      <span className="block text-xs text-muted">
                        {module.name}
                      </span>
                    </TableCell>
                    <TableCell>{module.departmentCode}</TableCell>
                    <TableCell>{module.semester}</TableCell>
                    <TableCell>{module.credits}</TableCell>
                    <TableCell>
                      {module.isActive ? 'Active' : 'Archived'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        pending={pendingId === module.id}
                        disabled={pendingId !== null}
                        onClick={() =>
                          void setActive(module.id, module.isActive)
                        }
                      >
                        {module.isActive ? 'Archive' : 'Activate'}
                      </Button>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
              <p>
                Page {modules.data.meta.page} of{' '}
                {Math.max(modules.data.meta.totalPages, 1)} ·{' '}
                {modules.data.meta.total} modules
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  disabled={page >= modules.data.meta.totalPages}
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
