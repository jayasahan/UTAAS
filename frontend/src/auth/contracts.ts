export const userRoles = [
  'LECTURER',
  'HOD',
  'DEAN',
  'EXAMINATION_OFFICER',
  'FINANCIAL_OFFICER',
  'ASSISTANT_BURSAR',
  'ADMIN',
] as const;
export interface StaffProfile {
  id: string;
  email: string;
  fullName: string;
  role: (typeof userRoles)[number];
  departmentCode: string | null;
  departmentId: string | null;
}
export interface CircularRates {
  circularReference: string;
  rates: Record<string, { label: string; unit: string; rate: number }>;
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid contract');
  return value as Record<string, unknown>;
}
export function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error('Invalid contract');
  return value;
}
function nullableText(value: unknown): string | null {
  return value == null ? null : text(value);
}
export function decodeProfile(value: unknown): StaffProfile {
  const data = record(value);
  const role = text(data.role);
  if (!userRoles.some((known) => known === role))
    throw new Error('Invalid contract');
  return {
    id: text(data.id),
    email: text(data.email),
    fullName: text(data.fullName),
    role: role as StaffProfile['role'],
    departmentCode: nullableText(data.departmentCode),
    departmentId: nullableText(data.departmentId),
  };
}
export function decodeCircular(value: unknown): CircularRates {
  const data = record(value);
  const rates = Object.fromEntries(
    Object.entries(record(data.rates)).map(([key, value]) => {
      const item = record(value);
      if (
        typeof item.rate !== 'number' ||
        !Number.isFinite(item.rate) ||
        item.rate < 0 ||
        item.rate > Number.MAX_SAFE_INTEGER / 100
      )
        throw new Error('Invalid contract');
      return [
        key,
        { label: text(item.label), unit: text(item.unit), rate: item.rate },
      ];
    }),
  );
  return { circularReference: text(data.circularReference), rates };
}
