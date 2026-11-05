import { Button } from '../../../components/common/Button';
import { Alert, Skeleton } from '../../../components/common/Feedback';
import { Table, TableCell, TableHead } from '../../../components/common/Table';
import { settingAvailability } from './quotas';
import type { StructureResource } from './usePaperStructure';

export function PaperStructurePanel({
  resource,
  onRefresh,
  examinerId,
}: {
  resource: StructureResource;
  onRefresh: () => void;
  examinerId?: string | undefined;
}) {
  const data = resource.data;
  const availability = settingAvailability(data, examinerId);
  return (
    <section
      aria-label="Examination paper structure and quotas"
      className="space-y-4 rounded-control border border-border p-4 [overflow-wrap:anywhere]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-brand">
          Registered paper structure & quotas
        </h2>
        {resource.status !== 'idle' && (
          <Button
            variant="ghost"
            onClick={onRefresh}
            disabled={resource.status === 'loading'}
          >
            {resource.status === 'error'
              ? 'Retry paper structure'
              : 'Refresh paper structure'}
          </Button>
        )}
      </div>
      {resource.status === 'idle' && (
        <p className="text-sm text-muted">{resource.message}</p>
      )}
      {resource.status === 'loading' && <Skeleton label={resource.message} />}
      {resource.status === 'error' && (
        <Alert title="Paper structure could not be loaded" tone="warning">
          <p>{resource.message}</p>
          <p>
            Quota availability is unconfirmed. The server will validate your
            claim when you submit.
          </p>
        </Alert>
      )}
      {resource.status === 'ready' &&
        data &&
        (!data.exists ? (
          <Alert title="No registered paper structure">
            <p>{data.message}</p>
            <p>
              The first submission establishes the structure from its claim
              details and server defaults. Saving a draft does not register a
              structure or reserve a quota. No remaining quota is confirmed yet.
            </p>
          </Alert>
        ) : (
          <>
            <p className="font-semibold">
              {data.paperStructure.courseCode} ·{' '}
              {data.paperStructure.courseTitle ?? 'Course title not returned'} ·{' '}
              {data.paperStructure.academicYear} ·{' '}
              {data.paperStructure.semester} · {data.paperStructure.examType}
            </p>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries({
                'Paper type': data.paperStructure.paperType,
                'Total questions': data.paperStructure.totalQuestions,
                'Total MCQ questions': data.paperStructure.totalMcqQuestions,
                'Total candidates': data.paperStructure.totalCandidates,
                'Duration (hours)': data.paperStructure.paperDurationHours,
                'Essay weight (%)': data.paperStructure.essayWeightPercent,
                'MCQ weight (%)': data.paperStructure.mcqWeightPercent,
                'Registered by': data.registeredBy.name,
                'Registered at': new Intl.DateTimeFormat('en-LK', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(data.registeredBy.registeredAt)),
              }).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-muted">{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 rounded-control bg-blue-50 p-3">
                <h3 className="font-semibold text-brand">Setting claims</h3>
                <p>
                  Claimed questions:{' '}
                  {data.claimsBreakdown.setting.claimedQuestions}
                </p>
                <p>
                  Reported remaining questions:{' '}
                  {data.claimsBreakdown.setting.remainingQuestions}
                </p>
                {availability && (
                  <>
                    <p>
                      Questions available excluding your existing claims:{' '}
                      {availability.remaining}
                    </p>
                    <p className="font-semibold">
                      {availability.wholePaperAvailable
                        ? 'Whole-paper setting available'
                        : 'Whole-paper setting unavailable'}
                    </p>
                  </>
                )}
                <p className="text-sm text-muted">
                  A positive Papers set quantity claims the whole paper. Use the
                  share control in the claim form to enter your allocation when
                  examiners divide the questions.
                </p>
              </div>
              <div className="space-y-2 rounded-control bg-blue-50 p-3">
                <h3 className="font-semibold text-brand">Marking claims</h3>
                <p>
                  Reported scripts claimed:{' '}
                  {data.claimsBreakdown.scriptMarking.totalScriptsClaimed}
                </p>
                <p>
                  Reported questions marked per script:{' '}
                  {data.claimsBreakdown.scriptMarking.totalQuestionsMarked}
                </p>
                <p>
                  Reported remaining questions per script:{' '}
                  {
                    data.claimsBreakdown.scriptMarking
                      .remainingQuestionsPerScript
                  }
                </p>
                <p className="font-semibold">
                  Marking availability requires server confirmation
                </p>
                <p className="text-sm text-muted">
                  The reported balance includes existing claims and cannot
                  identify your own marking allocation. It is not a confirmed
                  limit for a new or corrected marking claim.
                </p>
              </div>
            </div>
            <Table caption="Existing examiner setting claims">
              <thead>
                <tr>
                  {[
                    'Examiner',
                    'Questions claimed',
                    'Proportion',
                    'Claim reference',
                    'Status',
                  ].map((label) => (
                    <TableHead key={label}>{label}</TableHead>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.claimsBreakdown.setting.claimants.map(
                  (claimant, index) => (
                    <tr key={`${claimant.trackingNumber}-${index}`}>
                      <TableCell>
                        {claimant.examinerName}
                        {claimant.examinerId === examinerId ? ' (you)' : ''}
                      </TableCell>
                      <TableCell>{claimant.questionsClaimed}</TableCell>
                      <TableCell>{claimant.proportion}</TableCell>
                      <TableCell>{claimant.trackingNumber}</TableCell>
                      <TableCell>{claimant.status}</TableCell>
                    </tr>
                  ),
                )}
              </tbody>
            </Table>
            {!data.claimsBreakdown.setting.claimants.length && (
              <p>No setting claims were returned.</p>
            )}
            <Table caption="Existing examiner marking claims">
              <thead>
                <tr>
                  {[
                    'Examiner',
                    'Scripts marked',
                    'Questions marked',
                    'Claim reference',
                  ].map((label) => (
                    <TableHead key={label}>{label}</TableHead>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.claimsBreakdown.scriptMarking.claimants.map(
                  (claimant, index) => (
                    <tr key={`${claimant.trackingNumber}-${index}`}>
                      <TableCell>{claimant.examinerName}</TableCell>
                      <TableCell>{claimant.scriptsMarked}</TableCell>
                      <TableCell>{claimant.questionsMarked}</TableCell>
                      <TableCell>{claimant.trackingNumber}</TableCell>
                    </tr>
                  ),
                )}
              </tbody>
            </Table>
            {!data.claimsBreakdown.scriptMarking.claimants.length && (
              <p>No marking claims were returned.</p>
            )}
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="font-semibold">Moderation</dt>
                <dd>
                  {data.claimsBreakdown.moderation.isClaimed
                    ? `Claimed${data.claimsBreakdown.moderation.claimedBy ? ` by ${data.claimsBreakdown.moderation.claimedBy}` : ''}`
                    : 'No moderation claim reported'}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Typing</dt>
                <dd>
                  {data.claimsBreakdown.typing.isClaimed
                    ? `${data.claimsBreakdown.typing.typedPagesClaimed} pages claimed${data.claimsBreakdown.typing.claimedBy ? ` by ${data.claimsBreakdown.typing.claimedBy}` : ''}`
                    : 'No typing claim reported'}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Reported MCQ setting balance</dt>
                <dd>
                  {data.claimsBreakdown.mcqSetting.claimedMcqQuestions} claimed
                  / {data.claimsBreakdown.mcqSetting.remainingMcqQuestions}{' '}
                  remaining
                </dd>
              </div>
              <div>
                <dt className="font-semibold">
                  Reported continuous assessment quantities
                </dt>
                <dd>
                  {
                    data.claimsBreakdown.continuousAssessment
                      .totalStudentAssessmentsClaimed
                  }{' '}
                  claimed /{' '}
                  {
                    data.claimsBreakdown.continuousAssessment
                      .maxTotalAssessmentsAllowed
                  }{' '}
                  maximum (
                  {
                    data.claimsBreakdown.continuousAssessment
                      .maxAssessmentsPerStudent
                  }{' '}
                  per student)
                </dd>
              </div>
            </dl>
            <p className="text-sm text-muted">
              MCQ and continuous assessment usage are not calculated by the
              current backend breakdown. Their reported balances do not confirm
              availability. Quotas may change before submission; server
              validation remains authoritative.
            </p>
          </>
        ))}
    </section>
  );
}
