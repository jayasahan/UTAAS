import { useEffect, useState } from 'react';
import { useSession } from '../../auth/session';
import { ApiError } from '../../services/apiClient';

export type RequestResource<T> = {
  status: 'loading' | 'ready' | 'error' | 'unavailable';
  data: T | null;
  message: string;
  retry: () => void;
};

export function useRequestResource<T>(
  path: string | null,
  decode: (value: unknown) => T,
  query?: Readonly<Record<string, string>>,
): RequestResource<T> {
  const { client } = useSession();
  const [retryCount, setRetryCount] = useState(0);
  const queryKey = JSON.stringify(query ?? {});
  const [result, setResult] = useState<{
    client: typeof client;
    path: string;
    queryKey: string;
    retryCount: number;
    data: T | null;
    status: 'ready' | 'error' | 'unavailable';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!client || !path) return;
    const controller = new AbortController();
    let active = true;
    void client
      .get(
        path,
        decode,
        controller.signal,
        JSON.parse(queryKey) as Readonly<Record<string, string>>,
      )
      .then((data) => {
        if (active)
          setResult({
            client,
            path,
            queryKey,
            retryCount,
            data,
            status: 'ready',
            message: '',
          });
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return;
        const failure =
          error instanceof ApiError ? error : new ApiError('invalid-response');
        setResult({
          client,
          path,
          queryKey,
          retryCount,
          data: null,
          status:
            failure.kind === 'not-found' || failure.kind === 'unavailable'
              ? 'unavailable'
              : 'error',
          message: failure.message,
        });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [client, path, queryKey, decode, retryCount]);

  const current =
    path &&
    client &&
    result?.client === client &&
    result.path === path &&
    result.queryKey === queryKey &&
    result.retryCount === retryCount
      ? result
      : null;
  const retry = () => setRetryCount((count) => count + 1);
  if (!client || !path)
    return {
      status: 'unavailable',
      data: null,
      message: !client
        ? 'Sign in through an available authenticated account to view these requests.'
        : 'This request identifier is invalid.',
      retry,
    };
  return current
    ? {
        status: current.status,
        data: current.data,
        message: current.message,
        retry,
      }
    : {
        status: 'loading',
        data: null,
        message: 'Loading request information…',
        retry,
      };
}
