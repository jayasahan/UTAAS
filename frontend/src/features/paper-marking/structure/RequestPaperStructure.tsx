import { useSession } from '../../../auth/session';
import { PaperStructurePanel } from './PaperStructurePanel';
import { usePaperStructure } from './usePaperStructure';

/** Mounted after an authorized claim detail loads, including after submit/resubmit navigation. */
export function RequestPaperStructure({
  formData,
}: {
  formData: Record<string, unknown>;
}) {
  const session = useSession();
  const resource = usePaperStructure(
    session.client,
    formData.metadata ?? formData.academic,
  );
  return (
    <PaperStructurePanel resource={resource} onRefresh={resource.refresh} />
  );
}
