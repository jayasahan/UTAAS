import { useEffect, useState } from 'react';
import type { StaffProfile } from '../../auth/contracts';
import type { ApiClient } from '../../services/apiClient';
import { ApiError } from '../../services/apiClient';
import {
  decodeRequestDetail,
  decodeRequestHistory,
  decodeRequestTracking,
} from '../requests/contracts';
import type {
  RequestDetail,
  RequestHistory,
  RequestTracking,
} from '../requests/contracts';
import { summarizeCorrection } from './correctionSummary';
import {
  expectedCorrectionStage,
  restoreCorrectionForm,
} from './correctionPersistence';
import type { RestoredCorrectionForm } from './correctionPersistence';

export type CorrectionResource =
  | {
      status: 'idle' | 'loading' | 'unavailable' | 'blocked' | 'error';
      message: string;
    }
  | {
      status: 'ineligible';
      message: string;
      request: RequestDetail;
    }
  | {
      status: 'ready';
      message: string;
      request: RequestDetail;
      tracking: RequestTracking;
      history: RequestHistory;
      expectedStage: string;
      correctionComment: string;
      restored: RestoredCorrectionForm;
    };

interface ProfileResource {
  status: 'loading' | 'ready' | 'error' | 'unavailable';
  data: StaffProfile | null;
  message: string;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'The returned application could not be restored.';
}

export function useCorrectionRequest(
  requestId: string | null,
  client: ApiClient | null,
  profile: ProfileResource,
  restore: (form: RestoredCorrectionForm['form']) => void,
): { resource: CorrectionResource; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    requestId: string;
    client: ApiClient | null;
    attempt: number;
    resource: CorrectionResource;
  } | null>(null);

  useEffect(() => {
    if (
      !requestId ||
      !uuidPattern.test(requestId) ||
      !client ||
      profile.status !== 'ready' ||
      !profile.data ||
      profile.data.role !== 'LECTURER'
    )
      return;

    const controller = new AbortController();
    let active = true;
    const publish = (resource: CorrectionResource) => {
      if (active) setResult({ requestId, client, attempt, resource });
    };
    void (async () => {
      try {
        const encodedId = encodeURIComponent(requestId);
        const request = await client.get(
          `/requests/paper-marking/${encodedId}`,
          decodeRequestDetail,
          controller.signal,
        );
        if (request.id !== requestId)
          throw new Error('The backend returned a different request.');
        if (
          request.status !== 'RETURNED_FOR_CORRECTION' ||
          request.currentStageKey !== 'LECTURER_CORRECTION'
        ) {
          publish({
            status: 'ineligible',
            message:
              'This request is no longer awaiting lecturer corrections. Its details remain available in My Applications.',
            request,
          });
          return;
        }
        const [tracking, history] = await Promise.all([
          client.get(
            `/requests/${encodedId}/tracking`,
            decodeRequestTracking,
            controller.signal,
          ),
          client.get(
            `/requests/${encodedId}/history`,
            decodeRequestHistory,
            controller.signal,
          ),
        ]);
        const summary = summarizeCorrection(request, tracking, history);
        if (!summary.comment)
          throw new Error(
            'The officer correction comment is unavailable. Editing is disabled until the instructions can be verified.',
          );
        const expectedStage = expectedCorrectionStage(history);
        const restored = restoreCorrectionForm(request.formData);
        restore(restored.form);
        publish({
          status: 'ready',
          message: '',
          request,
          tracking,
          history,
          expectedStage,
          correctionComment: summary.comment,
          restored,
        });
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        publish({ status: 'error', message: errorMessage(error) });
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    requestId,
    client,
    profile.status,
    profile.data,
    profile.message,
    restore,
    attempt,
  ]);

  const resource: CorrectionResource = !requestId
    ? { status: 'idle', message: '' }
    : !uuidPattern.test(requestId)
      ? {
          status: 'blocked',
          message: 'This correction request identifier is invalid.',
        }
      : !client
        ? {
            status: 'unavailable',
            message:
              'Sign in with an authenticated lecturer session to edit this application.',
          }
        : profile.status === 'loading'
          ? {
              status: 'loading',
              message: 'Verifying the lecturer account…',
            }
          : profile.status !== 'ready' || !profile.data
            ? {
                status:
                  profile.status === 'unavailable' ? 'unavailable' : 'error',
                message:
                  profile.message ||
                  'The authenticated lecturer profile could not be verified.',
              }
            : profile.data.role !== 'LECTURER'
              ? {
                  status: 'blocked',
                  message:
                    'Only the authenticated lecturer can edit this returned application.',
                }
              : result?.requestId === requestId &&
                  result.client === client &&
                  result.attempt === attempt
                ? result.resource
                : {
                    status: 'loading',
                    message: 'Loading the returned application…',
                  };
  return { resource, retry: () => setAttempt((current) => current + 1) };
}
