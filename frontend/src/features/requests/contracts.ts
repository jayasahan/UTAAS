import { record, text } from '../../auth/contracts';

export const requestStatuses = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'RETURNED_FOR_CORRECTION',
  'APPROVED',
  'REJECTED',
  'SETTLED',
] as const;
export type RequestStatus = (typeof requestStatuses)[number];

function status(value: unknown): RequestStatus {
  const candidate = text(value);
  if (!requestStatuses.some((known) => known === candidate))
    throw new Error('Invalid request status');
  return candidate as RequestStatus;
}
function finiteAmount(value: unknown): number {
  const number =
    typeof value === 'string' && value.trim() ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number) || number < 0)
    throw new Error('Invalid request amount');
  return number;
}
function timestamp(value: unknown): string {
  const candidate = text(value);
  if (!Number.isFinite(Date.parse(candidate))) throw new Error('Invalid date');
  return candidate;
}
function optionalText(value: unknown): string | null {
  return value == null ? null : text(value);
}
function optionalComment(value: unknown): string {
  if (value == null) return '';
  if (typeof value !== 'string') throw new Error('Invalid comment');
  return value;
}

export interface RequestListItem {
  id: string;
  trackingNumber: string;
  requestType: string;
  status: RequestStatus;
  currentStageKey: string;
  totalAmount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}
export interface RequestPage {
  data: RequestListItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}
export function decodeRequestPage(value: unknown): RequestPage {
  const response = record(value);
  const metadata = record(response.meta);
  const integer = (input: unknown) => {
    if (typeof input !== 'number' || !Number.isInteger(input) || input < 0)
      throw new Error('Invalid page metadata');
    return input;
  };
  if (!Array.isArray(response.data)) throw new Error('Invalid request list');
  return {
    data: response.data.map((value) => {
      const item = record(value);
      return {
        id: text(item.id),
        trackingNumber: text(item.trackingNumber),
        requestType: text(item.requestType),
        status: status(item.status),
        currentStageKey: text(item.currentStageKey),
        totalAmount: finiteAmount(item.totalAmount),
        metadata: item.metadata == null ? {} : record(item.metadata),
        createdAt: timestamp(item.createdAt),
      };
    }),
    meta: {
      total: integer(metadata.total),
      page: integer(metadata.page),
      limit: integer(metadata.limit),
      totalPages: integer(metadata.totalPages),
    },
  };
}

export interface RequestDetail {
  id: string;
  trackingNumber: string;
  status: RequestStatus;
  currentStageKey: string;
  totalAmount: number;
  formData: Record<string, unknown>;
  createdAt: string;
}
export function decodeRequestDetail(value: unknown): RequestDetail {
  const data = record(value);
  return {
    id: text(data.id),
    trackingNumber: text(data.trackingNumber),
    status: status(data.status),
    currentStageKey: text(data.currentStageKey),
    totalAmount: finiteAmount(data.totalAmount),
    formData: record(data.formData),
    createdAt: timestamp(data.createdAt),
  };
}

export type WorkflowStageStatus =
  'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'RETURNED';
export interface TrackingStage {
  key: string;
  name: string;
  order: number;
  requiredRole: string;
  status: WorkflowStageStatus;
  actorName: string | null;
  enteredAt: string | null;
  completedAt: string | null;
  comments: string | null;
}
export interface RequestTracking {
  trackingNumber: string;
  requestType: string;
  status: RequestStatus;
  totalAmount: number;
  returningOfficerId: string | null;
  currentStage: {
    key: string;
    name: string;
    order: number;
    assignedRole: string;
  };
  stages: TrackingStage[];
}
const stageStatuses: WorkflowStageStatus[] = [
  'PENDING',
  'IN_PROGRESS',
  'APPROVED',
  'RETURNED',
];
export function decodeRequestTracking(value: unknown): RequestTracking {
  const data = record(value);
  const current = record(data.currentStage);
  if (!Array.isArray(data.stages)) throw new Error('Invalid tracking stages');
  const integer = (input: unknown) => {
    if (typeof input !== 'number' || !Number.isInteger(input) || input < 0)
      throw new Error('Invalid stage order');
    return input;
  };
  return {
    trackingNumber: text(data.trackingNumber),
    requestType: text(data.requestType),
    status: status(data.status),
    totalAmount: finiteAmount(data.totalAmount),
    returningOfficerId: optionalText(data.returningOfficerId),
    currentStage: {
      key: text(current.key),
      name: text(current.name),
      order: integer(current.order),
      assignedRole: text(current.assignedRole),
    },
    stages: data.stages.map((value) => {
      const stage = record(value);
      const stageStatus = text(stage.status);
      if (!stageStatuses.includes(stageStatus as WorkflowStageStatus))
        throw new Error('Invalid stage status');
      return {
        key: text(stage.key),
        name: text(stage.name),
        order: integer(stage.order),
        requiredRole: text(stage.requiredRole),
        status: stageStatus as WorkflowStageStatus,
        actorName: optionalText(stage.actorName),
        enteredAt: stage.enteredAt == null ? null : timestamp(stage.enteredAt),
        completedAt:
          stage.completedAt == null ? null : timestamp(stage.completedAt),
        comments:
          stage.comments == null ? null : optionalComment(stage.comments),
      };
    }),
  };
}

export interface AuditEvent {
  id: string;
  actionType: string;
  actorName: string;
  actorRole: string;
  previousStatus: string | null;
  newStatus: string;
  comment: string;
  fieldDiff: Record<string, unknown> | null;
  createdAt: string;
}
export interface RequestHistory {
  requestId: string;
  trackingNumber: string;
  events: AuditEvent[];
}
export function decodeRequestHistory(value: unknown): RequestHistory {
  const data = record(value);
  if (!Array.isArray(data.events)) throw new Error('Invalid history events');
  return {
    requestId: text(data.requestId),
    trackingNumber: text(data.trackingNumber),
    events: data.events.map((value) => {
      const event = record(value);
      return {
        id: text(event.id),
        actionType: text(event.actionType),
        actorName: text(event.actorName),
        actorRole: text(event.actorRole),
        previousStatus: optionalText(event.previousStatus),
        newStatus: text(event.newStatus),
        comment: optionalComment(event.comment),
        fieldDiff: event.fieldDiff == null ? null : record(event.fieldDiff),
        createdAt: timestamp(event.createdAt),
      };
    }),
  };
}

export function displayMetadata(formData: Record<string, unknown>) {
  if (!formData.metadata || typeof formData.metadata !== 'object') return [];
  const metadata = record(formData.metadata);
  const fields = [
    ['courseCode', 'Course code'],
    ['courseTitle', 'Course title'],
    ['academicYear', 'Academic year'],
    ['semester', 'Semester'],
    ['degreeProgramme', 'Degree programme'],
    ['examType', 'Examination type'],
    ['examinerRole', 'Examiner role'],
  ] as const;
  return fields.flatMap(([key, label]) =>
    typeof metadata[key] === 'string' && metadata[key]
      ? [{ label, value: metadata[key] as string }]
      : [],
  );
}
