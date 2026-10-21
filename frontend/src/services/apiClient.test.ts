import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient, requestJson } from './apiClient';
import { decodeCircular, decodeProfile } from '../auth/contracts';

afterEach(() => vi.unstubAllGlobals());
describe('read-only API client', () => {
  it('sends authenticated JSON POST payloads and query parameters', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'draft-id', status: 'DRAFT' }), {
        status: 201,
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    const client = createApiClient(
      'https://api.example.test/api/v1',
      () => 'opaque-token',
      vi.fn(),
    );
    const response = await client.post(
      '/requests/paper-marking/draft',
      { personal: { fullName: 'Lecturer' } },
      (value) => value,
      { draftId: 'draft-id' },
    );
    expect(response).toEqual({ id: 'draft-id', status: 'DRAFT' });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/requests/paper-marking/draft?draftId=draft-id',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer opaque-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ personal: { fullName: 'Lecturer' } }),
        credentials: 'omit',
      }),
    );
  });
  it('uses bearer headers without cookies, caching or redirects', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal('fetch', fetcher);
    const client = createApiClient(
      'https://api.example.test/api/v1/',
      () => 'test-fixture-only',
      vi.fn(),
    );
    await client.get('/auth/me', (value) => value);
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/auth/me',
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        headers: { Authorization: 'Bearer test-fixture-only' },
      }),
    );
  });
  it('does not send a request without an in-memory token', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(
      createApiClient(
        'https://api.example.test/api/v1',
        () => null,
        vi.fn(),
      ).get('/auth/me', (value) => value),
    ).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([401, 403, 404, 500])(
    'handles HTTP %s without exposing response bodies',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response('private backend diagnostics', { status }),
          ),
      );
      const unauthorized = vi.fn();
      const error = await createApiClient(
        'https://api.example.test/api/v1',
        () => 'fixture',
        unauthorized,
      )
        .get('/auth/me', (value) => value)
        .catch((error: unknown) => error);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(status);
      expect((error as ApiError).message).not.toContain(
        'private backend diagnostics',
      );
      expect(unauthorized).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
    },
  );
  it('normalizes network failures and preserves cancellation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('private details')),
    );
    await expect(
      requestJson('https://api.example.test', '/auth/me', (value) => value),
    ).rejects.toMatchObject({ kind: 'network' });
    const controller = new AbortController();
    controller.abort();
    await expect(
      requestJson('https://api.example.test', '/auth/me', (value) => value, {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
  it.each([
    undefined,
    'https://user:password@example.test/api',
    'https://example.test/api?token=not-allowed',
    'http://example.test/api',
  ])('rejects unsafe/missing base configuration %s', async (base) => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(
      requestJson(base, '/auth/me', (value) => value),
    ).rejects.toMatchObject({ kind: 'unavailable' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects cross-origin request paths', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(
      requestJson(
        'https://api.example.test/api/v1',
        '//other.example.test',
        (value) => value,
      ),
    ).rejects.toMatchObject({ kind: 'unavailable' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects invalid JSON and mismatched contracts', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('not JSON'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ fullName: 'Incomplete' })),
      );
    vi.stubGlobal('fetch', fetcher);
    await expect(
      requestJson('https://api.example.test', '/auth/me', decodeProfile),
    ).rejects.toMatchObject({ kind: 'invalid-response' });
    await expect(
      requestJson('https://api.example.test', '/auth/me', decodeProfile),
    ).rejects.toMatchObject({ kind: 'invalid-response' });
  });
  it('preserves actual labels/units without inventing profile fields or rate mappings', () => {
    expect(
      decodeProfile({
        id: 'fixture-id',
        email: 'fixture@example.test',
        fullName: 'Fixture name',
        role: 'LECTURER',
      }),
    ).toEqual({
      id: 'fixture-id',
      email: 'fixture@example.test',
      fullName: 'Fixture name',
      role: 'LECTURER',
      departmentCode: null,
      departmentId: null,
    });
    expect(
      decodeCircular({
        circularReference: 'TEST',
        rates: {
          UNKNOWN: {
            label: 'Unmapped category',
            unit: 'per candidate',
            rate: 8,
          },
        },
      }).rates.UNKNOWN,
    ).toEqual({ label: 'Unmapped category', unit: 'per candidate', rate: 8 });
    expect(() =>
      decodeCircular({
        circularReference: 'TEST',
        rates: { X: { label: 'Bad', unit: 'per paper', rate: -1 } },
      }),
    ).toThrow();
    expect(() =>
      decodeCircular({
        circularReference: 'TEST',
        rates: { X: { label: 'Bad', unit: 'per paper', rate: '8' } },
      }),
    ).toThrow();
  });
});
