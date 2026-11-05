import { decodeProfile } from '../../../auth/contracts';
import type { StaffProfile } from '../../../auth/contracts';
import { useSession } from '../../../auth/session';
import type { RequestStatus } from '../../requests/contracts';
import { useRequestResource } from '../../requests/useRequestResource';
import { PaperStructureWorkflow } from './PaperStructureWorkflow';

/** Mounted after an authorized claim detail loads, including after submit/resubmit navigation. */
export function RequestPaperStructure({
  formData,
  status,
  currentStageKey,
  applicantDepartmentCode,
  viewerProfile,
  onUpdated,
}: {
  formData: Record<string, unknown>;
  status: RequestStatus;
  currentStageKey: string;
  applicantDepartmentCode: string | null;
  viewerProfile?: StaffProfile | null;
  onUpdated: () => void;
}) {
  const session = useSession();
  const profile = useRequestResource(
    viewerProfile ? null : session.client ? '/auth/me' : null,
    decodeProfile,
  );
  return (
    <PaperStructureWorkflow
      formData={formData}
      status={status}
      currentStageKey={currentStageKey}
      applicantDepartmentCode={applicantDepartmentCode}
      viewerProfile={viewerProfile ?? profile.data}
      onUpdated={onUpdated}
    />
  );
}
