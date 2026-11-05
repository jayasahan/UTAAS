import { useEffect, useRef, useState } from 'react';
import { useSession } from '../../auth/session';
import { decodeProfile, type StaffProfile } from '../../auth/contracts';
import { ApiError, type ApiClient } from '../../services/apiClient';
import { decodeRequestDetail, type RequestDetail } from '../requests/contracts';
import { useRequestResource } from '../requests/useRequestResource';
import {
  decodeCurrentProposal,
  decodeConsensusResult,
  eligibleRequest,
  examFrom,
  examKey,
  openProposal,
  ownResponse,
  proposalKey,
  proposalSnapshot,
  responseAllowed,
  responseKey,
  verifyResult,
  disagreementError,
  type ConsensusPayload,
  type CurrentProposal,
  type ConsensusOutcome,
} from './contracts';

const lookupPath = '/requests/paper-marking/paper-structure';
interface Scope {
  client: ApiClient;
  scope: string;
}
interface Receipt extends Scope {
  key: string;
  status: ConsensusOutcome | null;
  message: string;
  agreed: boolean;
}
interface Attempt extends Scope {
  key: string;
  payload: ConsensusPayload;
}
function failureMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.validationMessages.join(' ') || error.message
    : error instanceof Error
      ? error.message
      : 'The response could not be confirmed.';
}
export function useLecturerConsensus(
  detail: RequestDetail | null,
  viewer: StaffProfile | null,
  refreshRequest: () => void,
) {
  const { client } = useSession();
  const exam = examFrom(detail?.formData.metadata ?? detail?.formData.academic);
  const enabled = eligibleRequest(detail, viewer) && !!exam;
  const scope = enabled
    ? JSON.stringify([detail!.id, viewer!.id, examKey(exam)])
    : '';
  const resource = useRequestResource(
    enabled ? lookupPath : null,
    decodeCurrentProposal,
    exam ? { ...exam } : undefined,
  );
  const [overlay, setOverlay] = useState<
    (Scope & { source: CurrentProposal | null; data: CurrentProposal }) | null
  >(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState<
    (Scope & { message: string; key: string }) | null
  >(null);
  const [denied, setDenied] = useState<(Scope & { key: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  const lock = useRef<symbol | null>(null);
  useEffect(() => {
    epoch.current += 1;
    return () => {
      epoch.current += 1;
    };
  }, [client, scope]);
  const belongs = (value: Scope | null) =>
    !!scope && value?.client === client && value.scope === scope;
  const candidate =
    belongs(overlay) && overlay!.source === resource.data
      ? overlay!.data
      : resource.data;
  const matchesExam =
    !candidate?.exists || examKey(candidate.exam) === examKey(exam);
  const proposal =
    enabled && matchesExam && resource.status === 'ready' ? candidate : null;
  const key = proposalKey(proposal);
  const snapshot = proposalSnapshot(proposal);
  const own = viewer ? ownResponse(proposal, viewer.id) : undefined;
  const uncertain = belongs(attempt) && attempt!.key === key ? attempt : null;
  const confirmed = belongs(receipt) && receipt!.key === key ? receipt : null;
  const forbidden = belongs(denied) && denied!.key === key;
  const canRespond =
    !!detail &&
    !!proposal &&
    responseAllowed(detail, proposal) &&
    !uncertain &&
    !forbidden &&
    !(confirmed && !own);
  const refresh = () => {
    resource.retry();
  };

  async function perform(
    agreed: boolean,
    comments: string,
    revision: string | null,
  ) {
    if (
      !client ||
      !detail ||
      !viewer ||
      !exam ||
      !proposal ||
      !canRespond ||
      lock.current
    )
      return;
    const validation = agreed ? '' : disagreementError(comments);
    if (validation) {
      setError({ client, scope, key, message: validation });
      return;
    }
    const token = Symbol();
    lock.current = token;
    const generation = epoch.current;
    const active = () => epoch.current === generation;
    const payload: ConsensusPayload = {
      ...exam,
      agreed,
      ...(comments.trim() ? { comments: comments.trim() } : {}),
    };
    let posted = false;
    setBusy(true);
    setError(null);
    try {
      const actor = await client.get('/auth/me', decodeProfile);
      if (!active()) return;
      if (actor.role !== 'LECTURER' || actor.id !== viewer.id) {
        setDenied({ client, scope, key });
        throw new Error(
          'The signed-in lecturer changed. Refresh your account before responding.',
        );
      }
      const latest = await client.get(
        `/requests/paper-marking/${encodeURIComponent(detail.id)}`,
        decodeRequestDetail,
      );
      if (!active()) return;
      if (
        latest.id !== detail.id ||
        !eligibleRequest(latest, viewer) ||
        examKey(
          examFrom(latest.formData.metadata ?? latest.formData.academic),
        ) !== examKey(exam)
      )
        throw new Error(
          'This request is no longer eligible for a response. Refresh the request before continuing.',
        );
      const current = await client.get(
        lookupPath,
        decodeCurrentProposal,
        undefined,
        { ...exam },
      );
      if (!active()) return;
      if (examKey(current.exam) !== examKey(exam))
        throw new Error('The proposal does not match this examination.');
      setOverlay({ client, scope, source: resource.data, data: current });
      if (proposalKey(current) !== key)
        throw new Error(
          'The proposal has changed or been reset. Review the current proportions before responding.',
        );
      if (!responseAllowed(latest, current))
        throw new Error(
          'This proposal is no longer accepting responses at the current request stage.',
        );
      const currentOwn = ownResponse(current, viewer.id);
      if (currentOwn && (!revision || revision !== responseKey(currentOwn)))
        throw new Error(
          'A response is already recorded. Review it before choosing Change response.',
        );
      if (revision && revision !== responseKey(currentOwn))
        throw new Error(
          'Your recorded response changed. Refresh and review it before responding.',
        );
      if (!active()) return;
      posted = true;
      const result = await client.post(
        '/requests/paper-marking/proportion-consensus',
        payload,
        decodeConsensusResult,
      );
      verifyResult(result, payload, key, viewer.id);
      if (!active()) return;
      setOverlay({
        client,
        scope,
        source: resource.data,
        data: result.proposal,
      });
      setReceipt({
        client,
        scope,
        key,
        status: result.status,
        message: result.message,
        agreed,
      });
      setAttempt(null);
      refreshRequest();
      resource.retry();
    } catch (failure) {
      if (!active()) return;
      const definite =
        failure instanceof ApiError &&
        [400, 401, 403, 404].includes(failure.status ?? 0);
      if (posted && !definite) setAttempt({ client, scope, key, payload });
      if (
        failure instanceof ApiError &&
        (failure.status === 401 || failure.status === 403)
      )
        setDenied({ client, scope, key });
      setError({
        client,
        scope,
        key,
        message:
          posted && !definite
            ? 'The response outcome is unknown. Check the recorded response before attempting another submission.'
            : failureMessage(failure),
      });
    } finally {
      if (lock.current === token) {
        lock.current = null;
        setBusy(false);
      }
    }
  }
  async function checkOutcome() {
    if (!uncertain || !client || !viewer || !exam || lock.current) return;
    const token = Symbol();
    lock.current = token;
    const generation = epoch.current;
    setBusy(true);
    try {
      const latest = await client.get(
        `/requests/paper-marking/${encodeURIComponent(detail!.id)}`,
        decodeRequestDetail,
      );
      if (epoch.current !== generation) return;
      if (
        latest.id !== detail!.id ||
        examKey(
          examFrom(latest.formData.metadata ?? latest.formData.academic),
        ) !== examKey(exam)
      )
        throw new Error('Request identity could not be verified.');
      const current = await client.get(
        lookupPath,
        decodeCurrentProposal,
        undefined,
        { ...exam },
      );
      if (epoch.current !== generation) return;
      if (examKey(current.exam) !== examKey(exam))
        throw new Error('The proposal does not match this examination.');
      setOverlay({ client, scope, source: resource.data, data: current });
      if (proposalKey(current) !== uncertain.key) {
        setAttempt(null);
        setError({
          client,
          scope,
          key: proposalKey(current),
          message:
            'A different proposal is now current. The previous outcome cannot be applied to it; review the new proposal.',
        });
        refreshRequest();
        return;
      }
      const response = ownResponse(current, viewer.id);
      if (
        !response?.respondedAt ||
        response.agreed !== uncertain.payload.agreed ||
        (response.comments ?? '') !== (uncertain.payload.comments ?? '')
      )
        throw new Error(
          'No matching recorded response can be confirmed yet. Check again before submitting another response.',
        );
      const status =
        proposalSnapshot(current)?.status === 'CONSENSUS_REACHED'
          ? 'CONSENSUS_REACHED'
          : null;
      setReceipt({
        client,
        scope,
        key,
        status,
        agreed: response.agreed,
        message: 'Your response is confirmed in the current proposal record.',
      });
      setAttempt(null);
      setError(null);
      refreshRequest();
      resource.retry();
    } catch (failure) {
      if (epoch.current === generation)
        setError({ client, scope, key, message: failureMessage(failure) });
    } finally {
      if (lock.current === token) {
        lock.current = null;
        setBusy(false);
      }
    }
  }
  return {
    enabled,
    proposal,
    snapshot,
    key,
    own,
    canRespond,
    confirmed,
    uncertain,
    busy,
    forbidden,
    perform,
    checkOutcome,
    refresh,
    missingExam: eligibleRequest(detail, viewer) && !exam,
    status: !matchesExam ? 'error' : resource.status,
    message: !matchesExam
      ? 'The proposal does not match this examination.'
      : resource.message,
    error: belongs(error) && error!.key === key ? error!.message : '',
    reset:
      !!key &&
      ((belongs(receipt) && receipt!.key !== key) ||
        (belongs(attempt) && attempt!.key !== key) ||
        (belongs(error) && error!.key !== key)),
    isOpen: openProposal(snapshot),
  };
}
