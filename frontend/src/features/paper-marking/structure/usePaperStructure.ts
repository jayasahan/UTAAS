import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, type ApiClient } from '../../../services/apiClient';
import {
  decodePaperStructure,
  selectionKey,
  structureSelection,
  type PaperStructureResponse,
} from './contracts';

export type StructureResource = {
  status: 'idle' | 'loading' | 'error' | 'ready';
  data: PaperStructureResponse | null;
  message: string;
};
const path = '/requests/paper-marking/paper-structure';

/** Identifies every result by both client and academic selection, including before effects run. */
export function usePaperStructure(client: ApiClient | null, academic: unknown) {
  const selected = structureSelection(academic);
  const key = selectionKey(selected);
  const latest = useRef(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    client: ApiClient;
    key: string;
    revision: number;
    resource: StructureResource;
  } | null>(null);
  useEffect(() => {
    if (!client || !key) return;
    const [courseCode, academicYear, semester, examType] = JSON.parse(key) as [
      string,
      string,
      string,
      string,
    ];
    const selected = { courseCode, academicYear, semester, examType };
    const controller = new AbortController();
    const sequence = ++latest.current;
    let live = true;
    void client
      .get(path, decodePaperStructure, controller.signal, { ...selected })
      .then((data) => {
        if (data.exists && selectionKey(data.paperStructure) !== key)
          throw new ApiError('invalid-response');
        if (live && sequence === latest.current)
          setResult({
            client,
            key,
            revision,
            resource: { status: 'ready', data, message: '' },
          });
      })
      .catch((error: unknown) => {
        if (!live || controller.signal.aborted || sequence !== latest.current)
          return;
        const failure =
          error instanceof ApiError ? error : new ApiError('invalid-response');
        setResult({
          client,
          key,
          revision,
          resource: {
            status: 'error',
            data: null,
            message: failure.validationMessages.join(' ') || failure.message,
          },
        });
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [client, key, revision]);
  const resource: StructureResource =
    !client || !selected
      ? {
          status: 'idle',
          data: null,
          message: !client
            ? 'Sign in to load the registered examination structure.'
            : 'Select a course, academic year, semester and examination type to load the registered structure.',
        }
      : result?.client === client &&
          result.key === key &&
          result.revision === revision
        ? result.resource
        : {
            status: 'loading',
            data: null,
            message: 'Loading registered examination structure and quotas…',
          };
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  return { ...resource, refresh };
}
