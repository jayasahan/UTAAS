import { useMemo, useState } from 'react';
import type { StaffProfile } from '../../../auth/contracts';
import { record, text } from '../../../auth/contracts';
import { useSession } from '../../../auth/session';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { Alert } from '../../../components/common/Feedback';
import { Dialog } from '../../../components/common/Dialog';
import { Input, Textarea } from '../../../components/common/FormControls';
import { ApiError } from '../../../services/apiClient';
import type { RequestStatus } from '../../requests/contracts';
import { usePaperStructure } from './usePaperStructure';
import type { StructureSelection } from './contracts';
import { PaperStructurePanel } from './PaperStructurePanel';

interface WorkflowContext {
  formData: Record<string, unknown>;
  status: RequestStatus;
  currentStageKey: string;
  applicantDepartmentCode: string | null;
  viewerProfile: StaffProfile | null;
  onUpdated: () => void;
}

interface CorrectionDraft {
  totalQuestions: string;
  totalMcqQuestions: string;
  totalCandidates: string;
  paperDurationHours: string;
  essayWeightPercent: string;
  mcqWeightPercent: string;
  reason: string;
}

function safeRecord(value: unknown): Record<string, unknown> {
  return value == null ? {} : record(value);
}

function identity(value: unknown): { courseCode: string } {
  const data = record(value);
  const structure = data.paperStructure ? record(data.paperStructure) : data;
  const code = text(structure.courseCode).trim().toUpperCase();
  return { courseCode: code };
}

function correctionResult(value: unknown): { resetClaimsCount: number } {
  const data = record(value);
  identity(data);
  if (
    typeof data.resetClaimsCount !== 'number' ||
    !Number.isInteger(data.resetClaimsCount) ||
    data.resetClaimsCount < 0
  )
    throw new Error('Invalid correction result');
  return { resetClaimsCount: data.resetClaimsCount };
}

function divisionResult(value: unknown): { courseCode: string } {
  const code = identity(value).courseCode;
  const data = record(value);
  if (
    typeof data.essayWeightPercent !== 'number' ||
    typeof data.mcqWeightPercent !== 'number'
  )
    throw new Error('Invalid proportion division response');
  return { courseCode: code };
}

function consensusResult(value: unknown): { status: string; message: string } {
  const data = record(value);
  identity(data.paperStructure);
  const status = text(data.status);
  if (
    ![
      'AWAITING_OTHER_EXAMINERS',
      'DISAGREED_RETURNED_TO_HOD',
      'CONSENSUS_REACHED',
    ].includes(status)
  )
    throw new Error('Invalid consensus response');
  return { status, message: text(data.message) };
}

function numberField(
  value: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
) {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

export function PaperStructureWorkflow({
  formData,
  status,
  currentStageKey,
  applicantDepartmentCode,
  viewerProfile,
  onUpdated,
}: WorkflowContext) {
  const session = useSession();
  const metadata = formData.metadata ?? formData.academic;
  const resource = usePaperStructure(session.client, metadata);
  const data = resource.data?.exists ? resource.data : null;
  const profile = viewerProfile;
  const courseCode = data?.paperStructure.courseCode ?? '';
  const departmentMatches = Boolean(
    profile?.departmentCode &&
    applicantDepartmentCode &&
    profile.departmentCode.toUpperCase() ===
      applicantDepartmentCode.toUpperCase(),
  );
  const isCurrentHod = Boolean(
    profile?.role === 'HOD' &&
    departmentMatches &&
    status === 'UNDER_REVIEW' &&
    currentStageKey === 'HEAD_OF_DEPARTMENT',
  );
  const isConsensusLecturer = Boolean(
    profile?.role === 'LECTURER' &&
    status === 'UNDER_REVIEW' &&
    currentStageKey === 'LECTURER_PROPORTION_CONSENSUS',
  );
  const division = data?.paperStructure.hodProportionDivision;
  const currentResponse = division?.responses.find(
    (response) => response.lecturerId === profile?.id,
  );
  const [correctionOverride, setCorrectionOverride] =
    useState<CorrectionDraft | null>(null);
  const [weightsOverride, setWeightsOverride] = useState<{
    essay: string;
    mcq: string;
    comments: string;
  } | null>(null);
  const [disagreement, setDisagreement] = useState('');
  const [confirmCorrection, setConfirmCorrection] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const correction = correctionOverride ?? {
    totalQuestions: String(data?.paperStructure.totalQuestions ?? ''),
    totalMcqQuestions: String(data?.paperStructure.totalMcqQuestions ?? ''),
    totalCandidates: String(data?.paperStructure.totalCandidates ?? ''),
    paperDurationHours: String(data?.paperStructure.paperDurationHours ?? ''),
    essayWeightPercent: String(data?.paperStructure.essayWeightPercent ?? ''),
    mcqWeightPercent: String(data?.paperStructure.mcqWeightPercent ?? ''),
    reason: '',
  };
  const weights = weightsOverride ?? {
    essay: String(data?.paperStructure.essayWeightPercent ?? ''),
    mcq: String(data?.paperStructure.mcqWeightPercent ?? ''),
    comments: '',
  };
  const editCorrection = (key: keyof CorrectionDraft, value: string) =>
    setCorrectionOverride({ ...correction, [key]: value });
  const editWeights = (key: 'essay' | 'mcq' | 'comments', value: string) =>
    setWeightsOverride({ ...weights, [key]: value });

  const selection = useMemo(() => {
    const raw = safeRecord(metadata);
    return {
      courseCode: typeof raw.courseCode === 'string' ? raw.courseCode : '',
      academicYear:
        typeof raw.academicYear === 'string' ? raw.academicYear : '',
      semester: typeof raw.semester === 'string' ? raw.semester : '',
      examType: typeof raw.examType === 'string' ? raw.examType : '',
    } satisfies StructureSelection;
  }, [metadata]);

  async function saveCorrection() {
    const client = session.client;
    if (!client?.patch || !data) return;
    const totalQuestions = numberField(correction.totalQuestions, 1);
    const totalMcqQuestions = numberField(correction.totalMcqQuestions, 0);
    const totalCandidates = numberField(correction.totalCandidates, 1);
    const paperDurationHours = numberField(correction.paperDurationHours, 1);
    const essayWeightPercent = numberField(
      correction.essayWeightPercent,
      0,
      100,
    );
    const mcqWeightPercent = numberField(correction.mcqWeightPercent, 0, 100);
    if (
      totalQuestions === null ||
      totalMcqQuestions === null ||
      totalCandidates === null ||
      paperDurationHours === null ||
      essayWeightPercent === null ||
      mcqWeightPercent === null ||
      !correction.reason.trim()
    ) {
      setError('Enter valid structure values and a correction reason.');
      return;
    }
    if (
      data.paperStructure.paperType === 'COMBINED' &&
      essayWeightPercent + mcqWeightPercent !== 100
    ) {
      setError('Combined paper weights must total 100%.');
      return;
    }
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const result = await client.patch(
        '/requests/paper-marking/paper-structure',
        {
          ...selection,
          paperType: data.paperStructure.paperType,
          totalQuestions,
          totalMcqQuestions,
          totalCandidates,
          paperDurationHours,
          essayWeightPercent,
          mcqWeightPercent,
          correctionReason: correction.reason.trim(),
        },
        correctionResult,
      );
      setConfirmCorrection(false);
      setCorrectionOverride(null);
      setNotice(
        `Structure corrected. ${result.resetClaimsCount} active claim(s) were reset to HOD review for re-approval.`,
      );
      resource.refresh();
      onUpdated();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.validationMessages.join(' ') || reason.message
          : 'The paper structure could not be corrected. Try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function setDivision() {
    const client = session.client;
    const essay = numberField(weights.essay, 0, 100);
    const mcq = numberField(weights.mcq, 0, 100);
    if (!client || essay === null || mcq === null || essay + mcq !== 100) {
      setError('Essay and MCQ weights must be whole numbers totaling 100%.');
      return;
    }
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      await client.post(
        '/requests/paper-marking/hod-proportion-division',
        {
          ...selection,
          essayWeightPercent: essay,
          mcqWeightPercent: mcq,
          comments: weights.comments.trim(),
        },
        divisionResult,
      );
      setNotice(
        'The proportion split was sent to the paper’s examiners for consensus.',
      );
      resource.refresh();
      onUpdated();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.validationMessages.join(' ') || reason.message
          : 'The proportion division could not be saved. Try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitConsensus(agreed: boolean) {
    const client = session.client;
    if (!client) return;
    if (!agreed && !disagreement.trim()) {
      setError('Add a comment explaining why you disagree.');
      return;
    }
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const result = await client.post(
        '/requests/paper-marking/proportion-consensus',
        {
          ...selection,
          agreed,
          ...(disagreement.trim() ? { comments: disagreement.trim() } : {}),
        },
        consensusResult,
      );
      setNotice(result.message);
      resource.refresh();
      onUpdated();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.validationMessages.join(' ') || reason.message
          : 'Your consensus response could not be recorded. Try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4" aria-label="Paper structure decisions">
      <PaperStructurePanel resource={resource} onRefresh={resource.refresh} />
      {error && (
        <Alert title="Paper structure action failed" tone="danger">
          <p>{error}</p>
        </Alert>
      )}
      {notice && (
        <Alert title="Paper structure updated" tone="success">
          <p>{notice}</p>
        </Alert>
      )}
      {division && (
        <Card className="space-y-3">
          <h2 className="text-lg font-bold text-brand">
            HOD combined-paper division
          </h2>
          <p className="font-semibold">
            Essay {division.essayWeightPercent}% · MCQ{' '}
            {division.mcqWeightPercent}% ·{' '}
            {division.status.replaceAll('_', ' ')}
          </p>
          <p className="text-sm text-muted">
            Set by {division.setByHodName} ·{' '}
            {new Intl.DateTimeFormat('en-LK', {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(division.setAt))}
            {division.comments ? ` · ${division.comments}` : ''}
          </p>
          <ul className="space-y-2">
            {division.responses.map((response) => (
              <li key={response.lecturerId}>
                {response.lecturerName}:{' '}
                {response.agreed ? 'Agreed' : 'Disagreed'}
                {response.comments ? ` — ${response.comments}` : ''}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {profile?.role === 'HOD' && !departmentMatches && (
        <Alert title="HOD actions unavailable" tone="warning">
          <p>
            The authenticated HOD department could not be matched to this
            applicant’s department. Structure decisions are disabled.
          </p>
        </Alert>
      )}
      {isCurrentHod && data && (
        <Card className="space-y-5">
          <h2 className="text-xl font-bold text-brand">HOD paper decisions</h2>
          <p className="text-sm text-muted">
            Structure corrections reset active claims for this examination to
            HOD review. Review the impact before confirming.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="correct-total-questions"
              label="Essay questions"
              type="number"
              min={1}
              step={1}
              value={correction.totalQuestions}
              onChange={(event) =>
                editCorrection('totalQuestions', event.target.value)
              }
            />
            <Input
              id="correct-total-mcq"
              label="MCQ questions"
              type="number"
              min={0}
              step={1}
              value={correction.totalMcqQuestions}
              onChange={(event) =>
                editCorrection('totalMcqQuestions', event.target.value)
              }
            />
            <Input
              id="correct-candidates"
              label="Candidates"
              type="number"
              min={1}
              step={1}
              value={correction.totalCandidates}
              onChange={(event) =>
                editCorrection('totalCandidates', event.target.value)
              }
            />
            <Input
              id="correct-duration"
              label="Paper duration (hours)"
              type="number"
              min={1}
              step={1}
              value={correction.paperDurationHours}
              onChange={(event) =>
                editCorrection('paperDurationHours', event.target.value)
              }
            />
            <Input
              id="correct-essay-weight"
              label="Essay weight (%)"
              type="number"
              min={0}
              max={100}
              step={1}
              value={correction.essayWeightPercent}
              onChange={(event) =>
                editCorrection('essayWeightPercent', event.target.value)
              }
            />
            <Input
              id="correct-mcq-weight"
              label="MCQ weight (%)"
              type="number"
              min={0}
              max={100}
              step={1}
              value={correction.mcqWeightPercent}
              onChange={(event) =>
                editCorrection('mcqWeightPercent', event.target.value)
              }
            />
          </div>
          <Textarea
            id="correction-reason"
            label="Correction reason"
            required
            value={correction.reason}
            onChange={(event) => editCorrection('reason', event.target.value)}
          />
          <Button
            onClick={() => {
              setError('');
              setConfirmCorrection(true);
            }}
            disabled={submitting || !correction.reason.trim()}
          >
            Review structure correction
          </Button>
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="font-semibold text-brand">
              Combined paper division
            </h3>
            <p className="text-sm text-muted">
              Set weights for the combined essay and MCQ paper. They must total
              100%.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="division-essay"
                label="Essay weight (%)"
                type="number"
                min={0}
                max={100}
                value={weights.essay}
                onChange={(event) => editWeights('essay', event.target.value)}
              />
              <Input
                id="division-mcq"
                label="MCQ weight (%)"
                type="number"
                min={0}
                max={100}
                value={weights.mcq}
                onChange={(event) => editWeights('mcq', event.target.value)}
              />
            </div>
            <Textarea
              id="division-comments"
              label="Rationale (optional)"
              value={weights.comments}
              onChange={(event) => editWeights('comments', event.target.value)}
            />
            <Button
              variant="secondary"
              onClick={() => void setDivision()}
              pending={submitting}
              disabled={data.paperStructure.totalMcqQuestions < 1}
            >
              Send division for lecturer consensus
            </Button>
          </div>
        </Card>
      )}
      {isConsensusLecturer &&
        data &&
        division &&
        division.status !== 'CONSENSUS_REACHED' && (
          <Card className="space-y-4">
            <h2 className="text-xl font-bold text-brand">
              Review HOD paper division
            </h2>
            <p className="font-semibold">
              Essay {division.essayWeightPercent}% · MCQ{' '}
              {division.mcqWeightPercent}%
            </p>
            <p className="text-sm text-muted">
              Proposed by {division.setByHodName}. Consensus is tracked for each
              lecturer with a claim for this examination.
            </p>
            {currentResponse && (
              <Alert
                title="Your current response"
                tone={currentResponse.agreed ? 'success' : 'warning'}
              >
                <p>
                  {currentResponse.agreed ? 'Agreed' : 'Disagreed'}
                  {currentResponse.comments
                    ? `: ${currentResponse.comments}`
                    : ''}
                </p>
              </Alert>
            )}
            <Textarea
              id="consensus-comments"
              label="Comment (required if you disagree)"
              value={disagreement}
              onChange={(event) => setDisagreement(event.target.value)}
            />
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => void submitConsensus(true)}
                pending={submitting}
              >
                Agree with division
              </Button>
              <Button
                variant="danger"
                onClick={() => void submitConsensus(false)}
                pending={submitting}
              >
                Disagree and return to HOD
              </Button>
            </div>
            <p className="text-sm text-muted">
              Your response can be updated while consensus is open. A
              disagreement returns the active claims to HOD review.
            </p>
          </Card>
        )}
      <Dialog
        open={confirmCorrection}
        onClose={() => setConfirmCorrection(false)}
        title="Confirm paper structure correction"
        description={`Correct ${courseCode}. The backend may reset active claims and approvals for this examination.`}
      >
        <div className="space-y-4">
          <p>Reason: {correction.reason}</p>
          <p>
            Submitting this correction updates the registered structure and
            resets active claims to HOD review. The server will report how many
            claims were reset.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void saveCorrection()} pending={submitting}>
              Confirm correction
            </Button>
            <Button
              variant="secondary"
              onClick={() => setConfirmCorrection(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
