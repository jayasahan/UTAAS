import { record, text, userRoles } from '../../auth/contracts';

export type AdminRole = (typeof userRoles)[number];

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  designation: string | null;
  departmentId: string | null;
  departmentName: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AdminDepartment {
  id: string;
  code: string;
  name: string;
  staffCount: number;
  pendingRequestsCount: number;
  hodName: string | null;
  hodUserId: string | null;
}

export interface AdminModule {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  departmentCode: string;
  semester: number;
  credits: number;
  prefix: string;
  isActive: boolean;
}

export interface RequestTypeConfig {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  activeTemplateVersion: number | null;
  totalTemplatesCount: number;
}

export interface WorkflowStage {
  order: number;
  stageKey: string;
  stageName: string;
  requiredRole: AdminRole;
  isDepartmentScoped: boolean;
}

export interface WorkflowTemplateConfig {
  id: string;
  requestTypeId: string;
  requestTypeCode: string;
  requestTypeName: string;
  version: number;
  isActive: boolean;
  activeRequestsCount: number;
  totalRequestsCount: number;
  stages: WorkflowStage[];
}

export interface AdminAuditEvent {
  id: string;
  requestId: string;
  trackingNumber: string;
  actorName: string;
  actorRole: string;
  actionType: string;
  previousStatus: string | null;
  newStatus: string;
  comment: string | null;
  fieldDiff: Record<string, unknown> | null;
  createdAt: string;
}

export interface Page<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new Error('Invalid admin response');
  return value;
}

function optionalText(value: unknown): string | null {
  return value == null ? null : text(value);
}

function pageMeta(value: unknown): Page<never>['meta'] {
  const meta = record(value);
  return {
    total: count(meta.total),
    page: count(meta.page),
    limit: count(meta.limit),
    totalPages: count(meta.totalPages),
  };
}

export function decodeAdminUser(value: unknown): AdminUser {
  const user = record(value);
  const role = text(user.role);
  const department = user.department == null ? null : record(user.department);
  if (
    !userRoles.some((known) => known === role) ||
    typeof user.isActive !== 'boolean'
  )
    throw new Error('Invalid admin user response');
  return {
    id: text(user.id),
    email: text(user.email),
    fullName: text(user.fullName),
    role: role as AdminRole,
    designation: optionalText(user.designation),
    departmentId: optionalText(user.departmentId),
    departmentName: department ? text(department.name) : null,
    isActive: user.isActive,
    createdAt: text(user.createdAt),
  };
}

export function decodeAdminUserPage(value: unknown): Page<AdminUser> {
  const response = record(value);
  if (!Array.isArray(response.data)) throw new Error('Invalid admin user page');
  return {
    data: response.data.map(decodeAdminUser),
    meta: pageMeta(response.meta),
  };
}

export function decodeAdminUserList(value: unknown): AdminUser[] {
  if (!Array.isArray(value)) throw new Error('Invalid staff list');
  return value.map(decodeAdminUser);
}

export function decodeDepartment(value: unknown): AdminDepartment {
  const department = record(value);
  const hod = department.hod == null ? null : record(department.hod);
  return {
    id: text(department.id),
    code: text(department.code),
    name: text(department.name),
    staffCount: count(department.staffCount),
    pendingRequestsCount: count(department.pendingRequestsCount),
    hodName: hod ? text(hod.fullName) : null,
    hodUserId: hod ? text(hod.id) : null,
  };
}

export function decodeDepartmentPage(value: unknown): Page<AdminDepartment> {
  const response = record(value);
  if (!Array.isArray(response.data)) throw new Error('Invalid department page');
  return {
    data: response.data.map(decodeDepartment),
    meta: pageMeta(response.meta),
  };
}

export function decodeAdminModule(value: unknown): AdminModule {
  const module = record(value);
  const department =
    module.department == null ? null : record(module.department);
  if (typeof module.isActive !== 'boolean')
    throw new Error('Invalid course module response');
  return {
    id: text(module.id),
    code: text(module.code),
    name: text(module.name),
    departmentId: text(module.departmentId),
    departmentCode: department ? text(department.code) : '—',
    semester: count(module.semester),
    credits: count(module.credits),
    prefix: typeof module.prefix === 'string' ? module.prefix : '',
    isActive: module.isActive,
  };
}

export function decodeAdminModulePage(value: unknown): Page<AdminModule> {
  const response = record(value);
  if (!Array.isArray(response.data))
    throw new Error('Invalid course module page');
  return {
    data: response.data.map(decodeAdminModule),
    meta: pageMeta(response.meta),
  };
}

export function decodeRequestTypes(value: unknown): RequestTypeConfig[] {
  if (!Array.isArray(value)) throw new Error('Invalid request type list');
  return value.map((entry) => {
    const type = record(entry);
    if (typeof type.isActive !== 'boolean')
      throw new Error('Invalid request type');
    return {
      id: text(type.id),
      code: text(type.code),
      name: text(type.name),
      description: typeof type.description === 'string' ? type.description : '',
      isActive: type.isActive,
      activeTemplateVersion:
        type.activeTemplateVersion == null
          ? null
          : count(type.activeTemplateVersion),
      totalTemplatesCount:
        type.totalTemplatesCount == null ? 0 : count(type.totalTemplatesCount),
    };
  });
}

export function decodeWorkflowTemplates(
  value: unknown,
): WorkflowTemplateConfig[] {
  if (!Array.isArray(value)) throw new Error('Invalid workflow templates');
  return value.map((entry) => {
    const template = record(entry);
    if (
      typeof template.isActive !== 'boolean' ||
      !Array.isArray(template.stages)
    )
      throw new Error('Invalid workflow template');
    return {
      id: text(template.id),
      requestTypeId: text(template.requestTypeId),
      requestTypeCode: text(template.requestTypeCode),
      requestTypeName: text(template.requestTypeName),
      version: count(template.version),
      isActive: template.isActive,
      activeRequestsCount: count(template.activeRequestsCount),
      totalRequestsCount: count(template.totalRequestsCount),
      stages: template.stages.map((entry) => {
        const stage = record(entry);
        const requiredRole = text(stage.requiredRole);
        if (!userRoles.some((role) => role === requiredRole))
          throw new Error('Invalid workflow stage role');
        return {
          order: count(stage.order),
          stageKey: text(stage.stageKey),
          stageName: text(stage.stageName),
          requiredRole: requiredRole as AdminRole,
          isDepartmentScoped: stage.isDepartmentScoped === true,
        };
      }),
    };
  });
}

export function decodeAuditPage(value: unknown): Page<AdminAuditEvent> {
  const response = record(value);
  if (!Array.isArray(response.data)) throw new Error('Invalid audit page');
  return {
    data: response.data.map((entry) => {
      const event = record(entry);
      const request = event.request == null ? null : record(event.request);
      const fieldDiff =
        event.fieldDiff == null ? null : record(event.fieldDiff);
      return {
        id: text(event.id),
        requestId: text(event.requestId),
        trackingNumber:
          request && typeof request.trackingNumber === 'string'
            ? request.trackingNumber
            : '',
        actorName: text(event.actorName),
        actorRole: text(event.actorRole),
        actionType: text(event.actionType),
        previousStatus: optionalText(event.previousStatus),
        newStatus: text(event.newStatus),
        comment: optionalText(event.comment),
        fieldDiff,
        createdAt: text(event.createdAt),
      };
    }),
    meta: pageMeta(response.meta),
  };
}
