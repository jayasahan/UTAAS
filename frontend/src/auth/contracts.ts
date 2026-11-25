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
  designation?: string | null;
  staffId?: string | null;
  departmentName?: string | null;
}
export interface AuthResponse {
  accessToken: string;
  user: StaffProfile;
}
export interface LogoutResponse {
  success: true;
  message: string;
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
  const profile: StaffProfile = {
    id: text(data.id),
    email: text(data.email),
    fullName: text(data.fullName),
    role: role as StaffProfile['role'],
    departmentCode: nullableText(data.departmentCode),
    departmentId: nullableText(data.departmentId),
  };
  if (data.designation !== undefined) {
    profile.designation = nullableText(data.designation);
  }
  if (data.staffId !== undefined) {
    profile.staffId = nullableText(data.staffId);
  }
  if (data.departmentName !== undefined) {
    profile.departmentName = nullableText(data.departmentName);
  }
  return profile;
}
export function decodeAuthResponse(value: unknown): AuthResponse {
  const data = record(value);
  return {
    accessToken: text(data.accessToken),
    user: decodeProfile(data.user),
  };
}
export function decodeLogoutResponse(value: unknown): LogoutResponse {
  const data = record(value);
  if (data.success !== true) throw new Error('Invalid contract');
  return { success: true, message: text(data.message) };
}
/** Reads only exp for local timeout scheduling; identity and role always come from /auth/me. */
export function jwtExpiresAt(accessToken: string): number {
  const payloadSegment = accessToken.split('.')[1];
  if (!payloadSegment) throw new Error('Invalid token');
  try {
    const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload: unknown = JSON.parse(atob(padded));
    const exp = record(payload).exp;
    if (typeof exp !== 'number' || !Number.isFinite(exp) || exp <= 0)
      throw new Error('Invalid expiry');
    const expiresAt = exp * 1000;
    if (!Number.isSafeInteger(expiresAt)) throw new Error('Invalid expiry');
    return expiresAt;
  } catch {
    throw new Error('Invalid token expiry');
  }
}
export function profilesMatch(
  left: StaffProfile,
  right: StaffProfile,
): boolean {
  return (
    left.id === right.id &&
    left.email === right.email &&
    left.fullName === right.fullName &&
    left.role === right.role &&
    left.departmentCode === right.departmentCode &&
    left.departmentId === right.departmentId
  );
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
