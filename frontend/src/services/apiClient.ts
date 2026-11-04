export type ApiFailure =
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'network'
  | 'server'
  | 'invalid-response'
  | 'unavailable';
const messages: Record<ApiFailure, string> = {
  unauthorized: 'Authentication is required or the session is no longer valid.',
  forbidden: 'This account is not permitted to access this resource.',
  'not-found': 'The requested information is unavailable.',
  network:
    'The backend could not be reached. Check the connection and try again.',
  server: 'The backend could not complete this request.',
  'invalid-response':
    'The backend response does not match the verified contract.',
  unavailable: 'The API is not configured for this environment.',
};
export class ApiError extends Error {
  constructor(
    public readonly kind: ApiFailure,
    public readonly status?: number,
    public readonly validationMessages: readonly string[] = [],
  ) {
    super(messages[kind]);
    this.name = 'ApiError';
  }
}
async function readValidationMessages(response: Response): Promise<string[]> {
  if (response.status !== 400) return [];
  try {
    const payload: unknown = await response.clone().json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      return [];
    const raw = (payload as Record<string, unknown>).message;
    const entries =
      typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw : [];
    return entries
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim().slice(0, 240))
      .filter(
        (entry) =>
          Boolean(entry) &&
          !entry.includes('<') &&
          !entry.includes('>') &&
          ![...entry].some((character) => {
            const code = character.charCodeAt(0);
            return code < 32 || code === 127;
          }),
      )
      .slice(0, 12);
  } catch {
    return [];
  }
}
export function apiBaseUrl(): string | undefined {
  return (
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? 'http://localhost:4000/api/v1' : undefined)
  );
}
function endpoint(base: string | undefined, path: string): string {
  try {
    if (
      !base ||
      !path.startsWith('/') ||
      path.startsWith('//') ||
      path.includes('\\') ||
      path.includes('..') ||
      path.includes('?') ||
      path.includes('#')
    )
      throw new Error();
    const url = new URL(base);
    const local =
      import.meta.env.DEV &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
    )
      throw new Error();
    return url.href.replace(/\/$/, '') + path;
  } catch {
    throw new ApiError('unavailable');
  }
}
/** Do not attach/log server error bodies: they may contain personal or credential data. */
export async function requestJson<T>(
  base: string | undefined,
  path: string,
  decode: (value: unknown) => T,
  options: {
    method?: 'GET' | 'POST';
    body?: unknown;
    signal?: AbortSignal;
    token?: string;
    query?: Readonly<Record<string, string>>;
  } = {},
): Promise<T> {
  const url = new URL(endpoint(base, path));
  if (options.query) {
    for (const [key, value] of Object.entries(options.query))
      url.searchParams.set(key, value);
  }
  let response: Response;
  try {
    response = await fetch(url.href, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch {
    if (options.signal?.aborted)
      throw new DOMException('Request cancelled', 'AbortError');
    throw new ApiError('network');
  }
  if (!response.ok) {
    const kind =
      response.status === 401
        ? 'unauthorized'
        : response.status === 403
          ? 'forbidden'
          : response.status === 404
            ? 'not-found'
            : 'server';
    throw new ApiError(
      kind,
      response.status,
      await readValidationMessages(response),
    );
  }
  try {
    return decode(await response.json());
  } catch {
    if (options.signal?.aborted)
      throw new DOMException('Request cancelled', 'AbortError');
    throw new ApiError('invalid-response');
  }
}
export async function requestMultipart<T>(
  base: string | undefined,
  path: string,
  file: File,
  category: string,
  decode: (value: unknown) => T,
  options: { token?: string; requestId?: string } = {},
): Promise<T> {
  const url = new URL(endpoint(base, path));
  const body = new FormData();
  body.set('file', file, file.name);
  body.set('category', category);
  if (options.requestId) body.set('requestId', options.requestId);
  let response: Response;
  try {
    response = await fetch(url.href, {
      method: 'POST',
      headers: options.token
        ? { Authorization: `Bearer ${options.token}` }
        : {},
      body,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new ApiError('network');
  }
  if (!response.ok) {
    const kind =
      response.status === 401
        ? 'unauthorized'
        : response.status === 403
          ? 'forbidden'
          : response.status === 404
            ? 'not-found'
            : 'server';
    throw new ApiError(
      kind,
      response.status,
      await readValidationMessages(response),
    );
  }
  try {
    return decode(await response.json());
  } catch {
    throw new ApiError('invalid-response');
  }
}
export interface ApiClient {
  get<T>(
    path: string,
    decode: (value: unknown) => T,
    signal?: AbortSignal,
    query?: Readonly<Record<string, string>>,
  ): Promise<T>;
  post<T>(
    path: string,
    body: unknown,
    decode: (value: unknown) => T,
    query?: Readonly<Record<string, string>>,
  ): Promise<T>;
  upload<T>(
    path: string,
    file: File,
    category: string,
    decode: (value: unknown) => T,
    requestId?: string,
  ): Promise<T>;
  downloadDocument?(filename: string): Promise<Blob>;
}
export function createApiClient(
  base: string | undefined,
  getToken: () => string | null,
  onUnauthorized: () => void,
): ApiClient {
  return {
    async get(path, decode, signal, query) {
      const token = getToken();
      if (!token) throw new ApiError('unauthorized');
      try {
        return await requestJson(base, path, decode, {
          token,
          ...(signal ? { signal } : {}),
          ...(query ? { query } : {}),
        });
      } catch (error) {
        if (error instanceof ApiError && error.kind === 'unauthorized')
          onUnauthorized();
        throw error;
      }
    },
    async post(path, body, decode, query) {
      const token = getToken();
      if (!token) throw new ApiError('unauthorized');
      try {
        return await requestJson(base, path, decode, {
          method: 'POST',
          body,
          token,
          ...(query ? { query } : {}),
        });
      } catch (error) {
        if (error instanceof ApiError && error.kind === 'unauthorized')
          onUnauthorized();
        throw error;
      }
    },
    async upload(path, file, category, decode, requestId) {
      const token = getToken();
      if (!token) throw new ApiError('unauthorized');
      try {
        return await requestMultipart(base, path, file, category, decode, {
          token,
          ...(requestId ? { requestId } : {}),
        });
      } catch (error) {
        if (error instanceof ApiError && error.kind === 'unauthorized')
          onUnauthorized();
        throw error;
      }
    },
    async downloadDocument(filename) {
      if (
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(filename) ||
        filename.includes('..') ||
        filename === '.' ||
        filename === '..'
      )
        throw new ApiError('invalid-response');
      const token = getToken();
      if (!token) throw new ApiError('unauthorized');
      const url = new URL(
        endpoint(base, `/requests/documents/${encodeURIComponent(filename)}`),
      );
      let response: Response;
      try {
        response = await fetch(url.href, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'omit',
          cache: 'no-store',
          redirect: 'error',
          referrerPolicy: 'no-referrer',
        });
      } catch {
        throw new ApiError('network');
      }
      if (!response.ok) {
        const kind =
          response.status === 401
            ? 'unauthorized'
            : response.status === 403
              ? 'forbidden'
              : response.status === 404
                ? 'not-found'
                : 'server';
        const error = new ApiError(kind, response.status);
        if (error.kind === 'unauthorized') onUnauthorized();
        throw error;
      }
      try {
        return await response.blob();
      } catch {
        throw new ApiError('network');
      }
    },
  };
}
