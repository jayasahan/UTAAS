import { useState, type FormEvent } from 'react';
import { userRoles } from '../../auth/contracts';
import { useSession } from '../../auth/session';
import { Alert, EmptyState, Skeleton } from '../../components/common/Feedback';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { ApiError } from '../../services/apiClient';
import { useRequestResource } from '../requests/useRequestResource';
import {
  decodeRequestTypes,
  decodeWorkflowTemplates,
  type WorkflowStage,
} from './resourceContracts';

const initialStages: WorkflowStage[] = [
  {
    order: 0,
    stageKey: 'LECTURER_SUBMISSION',
    stageName: 'Lecturer Submission',
    requiredRole: 'LECTURER',
    isDepartmentScoped: false,
  },
  {
    order: 1,
    stageKey: 'HEAD_OF_DEPARTMENT',
    stageName: 'Head of Department Review',
    requiredRole: 'HOD',
    isDepartmentScoped: true,
  },
];

function objectResponse(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid admin response');
  return value as Record<string, unknown>;
}

function apiMessage(error: unknown): string {
  if (error instanceof ApiError && error.validationMessages.length)
    return error.validationMessages.join(' ');
  return error instanceof ApiError
    ? error.message
    : 'The workflow change could not be saved.';
}

function slug(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function AdminWorkflowsPage() {
  const client = useSession().client;
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [typeCode, setTypeCode] = useState('');
  const [typeName, setTypeName] = useState('');
  const [typeDescription, setTypeDescription] = useState('');
  const [requestTypeId, setRequestTypeId] = useState('');
  const [stages, setStages] = useState(initialStages);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const types = useRequestResource(
    '/admin/workflows/request-types',
    decodeRequestTypes,
  );
  const templates = useRequestResource(
    '/admin/workflows/templates',
    decodeWorkflowTemplates,
  );

  async function createRequestType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    setPending('type');
    setError('');
    setNotice('');
    try {
      await client.post(
        '/admin/workflows/request-types',
        {
          code: typeCode,
          name: typeName,
          description: typeDescription,
          isActive: true,
        },
        objectResponse,
      );
      setTypeCode('');
      setTypeName('');
      setTypeDescription('');
      setShowTypeForm(false);
      setNotice('The request type was created.');
      types.retry();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setPending(null);
    }
  }

  async function toggleType(id: string, active: boolean, name: string) {
    if (!client?.patch) return;
    if (
      active &&
      !window.confirm(
        `Deactivate “${name}”? This prevents new requests of this type from being started.`,
      )
    )
      return;
    setPending(id);
    setError('');
    setNotice('');
    try {
      await client.patch(
        `/admin/workflows/request-types/${encodeURIComponent(id)}`,
        { isActive: !active },
        objectResponse,
      );
      setNotice(`Request type ${active ? 'deactivated' : 'activated'}.`);
      types.retry();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setPending(null);
    }
  }

  async function toggleTemplate(id: string, active: boolean, version: number) {
    if (!client?.patch) return;
    if (
      !active &&
      !window.confirm(
        `Activate workflow version ${version}? New requests will use this stage configuration.`,
      )
    )
      return;
    setPending(id);
    setError('');
    setNotice('');
    try {
      await client.patch(
        `/admin/workflows/templates/${encodeURIComponent(id)}`,
        { isActive: !active },
        (value) => decodeWorkflowTemplates([value])[0],
      );
      setNotice(
        `Workflow version ${version} ${active ? 'deactivated' : 'activated'}.`,
      );
      templates.retry();
      types.retry();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setPending(null);
    }
  }

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || stages.length < 2) return;
    setPending('template');
    setError('');
    setNotice('');
    try {
      await client.post(
        '/admin/workflows/templates',
        {
          requestTypeId,
          stages: stages.map((stage, order) => ({ ...stage, order })),
          isActive: false,
        },
        (value) => decodeWorkflowTemplates([value])[0],
      );
      setShowTemplateForm(false);
      setStages(initialStages);
      setRequestTypeId('');
      setNotice(
        'A new inactive workflow version was created. Review it before activating.',
      );
      templates.retry();
      types.retry();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setPending(null);
    }
  }

  function updateStage(index: number, update: Partial<WorkflowStage>) {
    setStages((current) =>
      current.map((stage, currentIndex) =>
        currentIndex === index ? { ...stage, ...update } : stage,
      ),
    );
  }

  return (
    <section aria-labelledby="admin-workflows-title" className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-action">
          Administration
        </p>
        <h1
          id="admin-workflows-title"
          className="mt-1 text-display font-bold text-brand"
        >
          Workflow setup
        </h1>
        <p className="mt-2 max-w-3xl text-muted">
          Manage request types and versioned approval routes. New workflow
          versions are created inactive so they can be reviewed before
          activation.
        </p>
      </header>
      {notice && (
        <Alert title="Saved" tone="success">
          <p>{notice}</p>
        </Alert>
      )}
      {error && (
        <Alert title="Could not save workflow changes" tone="danger" urgent>
          <p>{error}</p>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            setShowTypeForm((value) => !value);
            setShowTemplateForm(false);
          }}
        >
          {showTypeForm ? 'Close request type form' : 'Add request type'}
        </Button>
        <Button
          variant="ghost"
          disabled={!types.data?.some((type) => type.isActive)}
          onClick={() => {
            setShowTemplateForm((value) => !value);
            setShowTypeForm(false);
          }}
        >
          {showTemplateForm ? 'Close version form' : 'Create workflow version'}
        </Button>
      </div>

      {showTypeForm && (
        <Card>
          <form
            onSubmit={createRequestType}
            className="grid gap-4 sm:grid-cols-2"
          >
            <h2 className="text-lg font-bold text-brand sm:col-span-2">
              Create request type
            </h2>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Code
              <input
                required
                minLength={2}
                maxLength={50}
                pattern="[A-Z0-9_-]+"
                value={typeCode}
                onChange={(e) => setTypeCode(e.target.value.toUpperCase())}
                className="min-h-11 rounded-control border border-border px-3 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-brand">
              Display name
              <input
                required
                minLength={3}
                maxLength={150}
                value={typeName}
                onChange={(e) => setTypeName(e.target.value)}
                className="min-h-11 rounded-control border border-border px-3 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-brand sm:col-span-2">
              Description
              <textarea
                rows={3}
                value={typeDescription}
                onChange={(e) => setTypeDescription(e.target.value)}
                className="rounded-control border border-border px-3 py-2 font-normal"
              />
            </label>
            <Button
              type="submit"
              pending={pending === 'type'}
              disabled={!client}
            >
              Create request type
            </Button>
          </form>
        </Card>
      )}

      {showTemplateForm && (
        <Card>
          <form onSubmit={createTemplate} className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-brand">
                Create workflow version
              </h2>
              <p className="mt-1 text-sm text-muted">
                This version starts inactive. Stage order follows the sequence
                shown here.
              </p>
            </div>
            <label className="grid max-w-xl gap-1 text-sm font-semibold text-brand">
              Request type
              <select
                required
                value={requestTypeId}
                onChange={(e) => setRequestTypeId(e.target.value)}
                className="min-h-11 rounded-control border border-border bg-white px-3 font-normal"
              >
                <option value="">Select request type</option>
                {types.data
                  ?.filter((type) => type.isActive)
                  .map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.code} · {type.name}
                    </option>
                  ))}
              </select>
            </label>
            <ol className="space-y-3">
              {stages.map((stage, index) => (
                <li
                  key={index}
                  className="grid gap-3 rounded-control border border-border p-4 sm:grid-cols-2 xl:grid-cols-[4rem_1fr_1fr_1fr_auto_auto] xl:items-end"
                >
                  <p className="font-semibold text-brand">Stage {index + 1}</p>
                  <label className="grid gap-1 text-sm font-semibold text-brand">
                    Key
                    <input
                      required
                      value={stage.stageKey}
                      onChange={(e) =>
                        updateStage(index, { stageKey: slug(e.target.value) })
                      }
                      className="min-h-11 rounded-control border border-border px-3 font-mono text-xs font-normal"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-brand">
                    Stage name
                    <input
                      required
                      value={stage.stageName}
                      onChange={(e) =>
                        updateStage(index, { stageName: e.target.value })
                      }
                      className="min-h-11 rounded-control border border-border px-3 font-normal"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-brand">
                    Authorized role
                    <select
                      value={stage.requiredRole}
                      onChange={(e) =>
                        updateStage(index, {
                          requiredRole: e.target
                            .value as WorkflowStage['requiredRole'],
                        })
                      }
                      className="min-h-11 rounded-control border border-border bg-white px-3 font-normal"
                    >
                      {userRoles.map((role) => (
                        <option key={role} value={role}>
                          {role.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-h-11 items-center gap-2 text-sm text-brand">
                    <input
                      type="checkbox"
                      checked={stage.isDepartmentScoped}
                      onChange={(e) =>
                        updateStage(index, {
                          isDepartmentScoped: e.target.checked,
                        })
                      }
                    />
                    Department scoped
                  </label>
                  <Button
                    variant="ghost"
                    disabled={index < 2}
                    onClick={() =>
                      setStages((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() =>
                  setStages((current) => [
                    ...current,
                    {
                      order: current.length,
                      stageKey: `REVIEW_STAGE_${current.length + 1}`,
                      stageName: `Review Stage ${current.length + 1}`,
                      requiredRole: 'DEAN',
                      isDepartmentScoped: false,
                    },
                  ])
                }
              >
                Add stage
              </Button>
              <Button
                type="submit"
                pending={pending === 'template'}
                disabled={!client || !requestTypeId || stages.length < 2}
              >
                Save inactive version
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowTemplateForm(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <section aria-label="Request types" className="space-y-3">
        <h2 className="text-lg font-bold text-brand">Request types</h2>
        {types.status === 'loading' && (
          <Card>
            <Skeleton label="Loading request types" />
          </Card>
        )}
        {(types.status === 'error' || types.status === 'unavailable') && (
          <Alert
            title="Request types unavailable"
            tone={types.status === 'error' ? 'danger' : 'info'}
          >
            <p>{types.message}</p>
            {types.status === 'error' &&
              types.errorKind !== 'forbidden' &&
              types.errorKind !== 'unauthorized' && (
                <Button className="mt-3" variant="ghost" onClick={types.retry}>
                  Retry
                </Button>
              )}
          </Alert>
        )}
        {types.data && types.data.length === 0 && (
          <EmptyState title="No request types configured" />
        )}
        {types.data && types.data.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {types.data.map((type) => (
              <Card key={type.id} className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-brand">{type.name}</p>
                    <p className="text-xs text-muted">{type.code}</p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${type.isActive ? 'bg-success-subtle text-success-ink' : 'bg-slate-100 text-slate-700'}`}
                  >
                    {type.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-muted">
                  {type.description || 'No description.'}
                </p>
                <p className="text-sm text-muted">
                  Active workflow:{' '}
                  {type.activeTemplateVersion == null
                    ? 'None'
                    : `v${type.activeTemplateVersion}`}{' '}
                  · {type.totalTemplatesCount} version(s)
                </p>
                <Button
                  variant="ghost"
                  pending={pending === type.id}
                  onClick={() =>
                    void toggleType(type.id, type.isActive, type.name)
                  }
                >
                  {type.isActive ? 'Deactivate type' : 'Activate type'}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Workflow versions" className="space-y-3">
        <h2 className="text-lg font-bold text-brand">Workflow versions</h2>
        {templates.status === 'loading' && (
          <Card>
            <Skeleton label="Loading workflow versions" />
          </Card>
        )}
        {(templates.status === 'error' ||
          templates.status === 'unavailable') && (
          <Alert
            title="Workflow versions unavailable"
            tone={templates.status === 'error' ? 'danger' : 'info'}
          >
            <p>{templates.message}</p>
            {templates.status === 'error' &&
              templates.errorKind !== 'forbidden' &&
              templates.errorKind !== 'unauthorized' && (
                <Button
                  className="mt-3"
                  variant="ghost"
                  onClick={templates.retry}
                >
                  Retry
                </Button>
              )}
          </Alert>
        )}
        {templates.data && templates.data.length === 0 && (
          <EmptyState title="No workflow versions configured" />
        )}
        {templates.data && templates.data.length > 0 && (
          <div className="space-y-3">
            {templates.data.map((template) => (
              <Card key={template.id} className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-brand">
                      {template.requestTypeName} · Version {template.version}
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      {template.requestTypeCode} ·{' '}
                      {template.activeRequestsCount} in-flight ·{' '}
                      {template.totalRequestsCount} total claims
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${template.isActive ? 'bg-success-subtle text-success-ink' : 'bg-slate-100 text-slate-700'}`}
                    >
                      {template.isActive
                        ? 'Active for new requests'
                        : 'Inactive'}
                    </span>
                    <Button
                      variant="ghost"
                      pending={pending === template.id}
                      onClick={() =>
                        void toggleTemplate(
                          template.id,
                          template.isActive,
                          template.version,
                        )
                      }
                    >
                      {template.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
                <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {template.stages.map((stage) => (
                    <li
                      key={stage.order}
                      className="rounded-control bg-slate-50 p-3 text-sm"
                    >
                      <p className="font-semibold text-brand">
                        {stage.order + 1}. {stage.stageName}
                      </p>
                      <p className="mt-1 text-muted">
                        {stage.requiredRole.replaceAll('_', ' ')}
                        {stage.isDepartmentScoped ? ' · Department scoped' : ''}
                      </p>
                      <p className="mt-1 font-mono text-xs text-muted">
                        {stage.stageKey}
                      </p>
                    </li>
                  ))}
                </ol>
              </Card>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
