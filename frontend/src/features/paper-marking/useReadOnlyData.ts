import { useEffect, useState } from 'react';
import { useSession } from '../../auth/session';
import { decodeCircular, decodeProfile } from '../../auth/contracts';
import type { ApiClient } from '../../services/apiClient';
import { ApiError } from '../../services/apiClient';

type Resource<T> = {
  status: 'loading' | 'ready' | 'error' | 'unavailable';
  data: T | null;
  message: string;
};
function useResource<T>(
  client: ApiClient | null,
  path: string,
  decode: (value: unknown) => T,
) {
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{
    client: ApiClient | null;
    retry: number;
    resource: Resource<T>;
  } | null>(null);
  useEffect(() => {
    if (!client) return;
    const controller = new AbortController();
    let live = true;
    void client
      .get(path, decode, controller.signal)
      .then((data) => {
        if (live)
          setResult({
            client,
            retry,
            resource: { status: 'ready', data, message: '' },
          });
      })
      .catch((error: unknown) => {
        if (!live || controller.signal.aborted) return;
        const failure =
          error instanceof ApiError ? error : new ApiError('invalid-response');
        setResult({
          client,
          retry,
          resource: {
            status:
              failure.kind === 'unavailable' || failure.kind === 'not-found'
                ? 'unavailable'
                : 'error',
            data: null,
            message: failure.message,
          },
        });
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [client, path, decode, retry]);
  const resource: Resource<T> = !client
    ? {
        status: 'unavailable',
        data: null,
        message: 'Sign in through an available authentication provider.',
      }
    : result?.client === client && result.retry === retry
      ? result.resource
      : {
          status: 'loading',
          data: null,
          message: 'Loading backend information…',
        };
  return { ...resource, retry: () => setRetry((old) => old + 1) };
}
export function useReadOnlyData() {
  const session = useSession();
  const profile = useResource(session.client, '/auth/me', decodeProfile);
  const circular = useResource(
    session.client,
    '/requests/paper-marking/rates/circular',
    decodeCircular,
  );
  return { session, profile, circular };
}
