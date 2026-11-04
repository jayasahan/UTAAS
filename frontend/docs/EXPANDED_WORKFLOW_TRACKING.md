# Feature 11: Expanded workflow tracking

Branch: `feature/frontend-consensus-tracking`  
PR base: `mvp`  
Source baseline: `019879bb2ae1261d53d23510ab4108c0ba5585c8`  
Review date: 2026-11-05, Asia/Colombo

The working tree was clean, origin was fetched, and the branch was absent
locally and remotely before creation directly from `origin/mvp`. No commits,
pushes, merges or PRs were made. Backend code, dependencies, rates, claim forms
and payload persistence are unchanged. The branch does not include or depend
on unmerged Features 1, 2, 5 or 6.

## Scope and existing components reused

The implementation extends the existing request-detail and officer-review
screens. It reuses `WorkflowStepper`, `RequestStatusBadge`, `Card`, `Alert`,
`EmptyState`, the authenticated API client, `useRequestResource`, and existing
request/tracking/history decoders. It adds no state-management or UI library.
The lecturer dashboard continues linking to the same request-detail route.
Existing officer action authorization and ordinary correction flows remain intact.

Both views share:

- A current-stage presentation based on confirmed request details, with an
  explicit fallback when detailed stage information is missing or inconsistent.
- The existing stepper populated only with returned stage rows. No synthetic
  consensus history row, order, assignee or approval is created. Undated historical
  approval flags do not become confirmed completion markers. Existing dated
  completion records and ordinary active/returned stages remain supported.
- A typed, optional consensus snapshot showing available percentages, proposer,
  proposal timestamp, remarks, status and recorded individual responses. This is
  labelled separately from request lifecycle status and audit history.
- Chronologically sorted immutable audit events with readable descriptions for
  proposals, disagreements, completed consensus, structure corrections, approval
  resets, returns, HOD edits, resubmissions and later approvals/rejections.
- Existing empty/loading/error/retry behavior. Malformed optional consensus data
  does not hide independently available request status and audit history.

The stepper has an optional vertical layout for the narrow officer sidebar;
the lecturer view retains the normal responsive layout. Long labels, comments,
and changed-field values wrap. Existing focus styling, semantic lists, headings,
regions and timestamp markup are retained.

## Confirmed backend contracts

Inspected source:

- [Tracking controller](../../backend/src/modules/requests/controllers/tracking-history.controller.ts)
- [Tracking/history DTOs](../../backend/src/modules/requests/dto/tracking-response.dto.ts) and [history DTO](../../backend/src/modules/requests/dto/history-response.dto.ts)
- [TrackingHistoryService](../../backend/src/modules/requests/services/tracking-history.service.ts)
- [Claim detail service](../../backend/src/modules/requests/services/paper-marking-claim.service.ts)
- [ExamPaperStructureService](../../backend/src/modules/requests/services/exam-paper-structure.service.ts)
- [WorkflowStateMachineService](../../backend/src/modules/requests/services/workflow-state-machine.service.ts)
- [Request access control](../../backend/src/modules/requests/utils/access-control.util.ts)

| Endpoint                                 | Data used                                                                                                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/requests/paper-marking/:id` | Confirmed `status`, `currentStageKey`, `totalAmount`, request identity and optional `formData.hodProportionDivision`.                                 |
| `GET /api/v1/requests/:id/tracking`      | Returned stage records, timestamps, comments and request reference; current metadata is checked against detail.                                       |
| `GET /api/v1/requests/:id/history`       | Immutable audit IDs, action types, actor names/roles, timestamps, lifecycle transitions, comments and field diffs.                                    |
| `GET /api/v1/auth/me`                    | Existing officer-access identity; additionally used in lecturer detail only when consensus data exists or correction eligibility already requires it. |

The feature does not query the global paper-structure endpoint or another
lecturer's request. No proposal, agreement, correction or query mutation is added.
It relies on the existing JWT and request ownership/department/stage authorization.

### Current-stage inconsistency

`getTrackingInfo()` selects the matching stage row or falls back to `stages[0]`.
It returns the real `request.currentStageKey`, but takes the display name, order
and assignee from that fallback row. HOD proposal routing can set
`LECTURER_PROPORTION_CONSENSUS` without creating such a row, and lecturer correction
can also lack a dedicated stage-history row.

The UI uses the detail response's stage key and lifecycle status. A matching stage
row supplies a name and role; otherwise the key gets a human-readable label and
assignee/position remain unconfirmed. Historical rows are not renamed or promoted
to the new stage. Mixed status/key responses suppress the potentially stale
stepper and show the confirmed detail stage with a warning. Foreign request
detail/history responses are rejected. Officer review keeps its existing
fail-closed multi-response checks and disables review actions when a verified
active officer stage is unavailable.

### Consensus data

The request snapshot can include `essayWeightPercent`, `mcqWeightPercent`,
`comments`, `setByHodName`, `setAt`, `status`, and optional `responses[]` with
`lecturerId`, `lecturerName`, `agreed`, `comments`, and `respondedAt`.
The decoder accepts missing optional information, preserves false disagreement
values, validates provided values, and distinguishes absent from malformed data.

Known snapshot statuses are:

- `AWAITING_LECTURER_CONSENSUS`: pending lecturer agreement.
- `DISAGREED_RETURNED_TO_HOD`: recorded disagreement requiring HOD adjustment.
- `CONSENSUS_REACHED`: recorded consensus completion.

They are not added to the request lifecycle enum. Unknown future snapshot statuses
remain readable without assigning an agreement outcome. A disagreement does not
turn the request into a rejected claim.

Individual responses are displayed only from the authorized detail snapshot.
The lecturer view additionally filters them to the verified `/auth/me` ID.
Authorized officer roles can inspect the responses returned for that request.
An unknown/unverified viewer sees no individual responses. These frontend filters
are an additional presentation restriction; backend field-level redaction remains
the security boundary.

No expected participant total/list is provided. Empty/missing responses therefore
do not become invented pending lecturers, a denominator, a progress percentage,
or a consensus outcome. Response entries remain snapshot information; they are
not inserted into immutable audit history as fabricated events.

### Event details displayed

| Recorded action                                                    | Supported presentation                                                                                                                                     |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HOD_PROPORTION_DIVIDED`                                           | Proposal event, percentages from its field diff, available audit actor/time/comment. Current proposal remarks also appear from the snapshot.               |
| `LECTURER_PROPORTION_DISAGREED`                                    | Disagreement event, recorded comment/time/actor and `returnedTo` destination; clearly distinguished from claim rejection.                                  |
| `PROPORTION_CONSENSUS_REACHED`                                     | Recorded completion event and returned `agreedWeights.essay` / `mcq`.                                                                                      |
| `PAPER_STRUCTURE_CORRECTED_RESET`                                  | Previous/new question totals, correction reason, reset destination and recorded revocation flag; earlier audit events stay visible.                        |
| `RETURN` / `RESUBMIT`                                              | Correction target or recorded resubmission destination. The audit actor distinguishes examination/finance/HOD returns.                                     |
| `HOD_DIRECT_EDIT`, `APPROVE`, `APPROVE_PAYOUT`, `SETTLE`, `REJECT` | Readable event labels with returned audit metadata and relevant stage facts. Unknown legacy events retain readable fallback labels and raw changed fields. |

A later recorded HOD proposal annotates an earlier proposal as superseded for the
request, following the backend replacement behavior. Equal timestamps do not
establish ordering. The UI creates neither a consensus-reset audit event nor
individual reset outcomes. A paper-structure approval reset does not imply that
the backend cleared consensus responses.

## Backend follow-up required in separate PRs

1. **Create/represent consensus and correction stage records correctly.** Remove
   the historical `stages[0]` fallback for missing current stages, or return explicit
   missing metadata. Supply a consistent current-stage role/order rather than a
   historical stage's values.
2. **Publish intermediate agreements through authorized request data/history.**
   When a lecturer agrees but consensus is incomplete, the service saves only
   `ExamPaperStructure.hodProportionDivision`. It does not update the request
   snapshot or write an agreement audit event. The current interface cannot show
   fresh intermediate agreements that are absent from these authorized responses.
3. **Provide explicit participant and proposal-round contracts.** Return an
   authorized expected-participant list/count and stable proposal/round IDs with
   response association and supersession/reset events. Until then there is no
   reliable individual pending roster or precise historical round grouping.
4. **Expand immutable structure-change details.** The current per-request reset
   audit records question counts and a correction reason, but no old/new candidate
   counts or durations and no explicit reset-stage list. The UI does not reconstruct
   those changes from current form values or infer a list from workflow policy.
5. **Preserve historical proposal remarks and versions.** HOD custom remarks live
   in the current snapshot; the proposal audit's comment is a generated description.
   Replaced proposal remarks may be unavailable in historical events. Persist those
   remarks with the immutable proposal version.
6. **Return consistent versions across detail/tracking/history.** Independent GETs
   can observe different workflow revisions. Key/status mismatch is detectable and
   safely handled, but equal keys/statuses do not prove identical workflow rounds.
   A shared workflow revision/ETag would allow stronger snapshot consistency.
7. **Keep role/field-level authorization explicit for new stages.** The frontend
   respects existing 401/403 responses and does not bypass review-stage rules.
   Authorized backend responses should omit any participant fields that a caller
   must not read; client-side hiding does not replace that enforcement.

## Files created and modified

Created:

- [workflowTracking.ts](../src/features/requests/workflowTracking.ts): typed consensus decoder, confirmed-stage presentation, human-readable audit facts, chronology and proposal supersession annotations.
- [RequestWorkflowProgress.tsx](../src/components/tracking/RequestWorkflowProgress.tsx): current-stage fallback and existing stepper integration.
- [ConsensusTracking.tsx](../src/components/tracking/ConsensusTracking.tsx): separate consensus snapshot and role-aware response presentation.
- [WorkflowHistory.tsx](../src/components/audit/WorkflowHistory.tsx): shared chronological audit presentation.
- [workflowTracking.test.tsx](../src/features/requests/workflowTracking.test.tsx), [expandedWorkflowPages.test.tsx](../src/features/requests/expandedWorkflowPages.test.tsx): unit, rendering, identity, authorization, API-error and integration regressions.
- This report.

Modified:

- [RequestDetailPage.tsx](../src/pages/RequestDetailPage.tsx): lecturer integration, identity validation, conditional profile verification and server-confirmed detail total.
- [OfficerClaimReviewView.tsx](../src/features/officer-review/OfficerClaimReviewView.tsx): reuse the same tracking/history presentation in its sidebar.
- [OfficerClaimReviewPage.tsx](../src/features/officer-review/OfficerClaimReviewPage.tsx): reject foreign detail identity and retain a safe confirmed-stage fallback for inconsistent review records.
- [officer-review/contracts.ts](../src/features/officer-review/contracts.ts): decode optional request-scoped consensus data without weakening existing identity/status checks.
- [Steppers.tsx](../src/components/tracking/Steppers.tsx), [globals.css](../src/styles/globals.css): optional compact vertical layout and safe long-text wrapping.
- [requestPages.test.tsx](../src/features/requests/requestPages.test.tsx): expect the new readable submission event label.
- [OfficerReviewHistory.test.tsx](../src/features/officer-history/OfficerReviewHistory.test.tsx): pin the existing fixed-fixture date test and restore real timers, allowing deterministic full-suite verification. Production review-history logic is unchanged.
- [FRONTEND_PROGRESS.md](FRONTEND_PROGRESS.md): review handoff record.

## Verification and review

Node: `v24.18.1`.

- `npm.cmd test -- --maxWorkers=1 --testTimeout=30000`: **343/343 tests passed across 30 files**, including **53 new regressions**. Final full run: 113.79 seconds.
- `npm.cmd run lint`: passed with zero warnings.
- `npm.cmd run type-check`: passed.
- `npm.cmd run build`: passed, including TypeScript and Vite production bundling.
- Changed TypeScript/TSX/CSS and this report: Prettier check passed.
- `git diff --check`: passed.
- `npm.cmd run format:check`: failed on the two pre-existing Markdown trackers described below; no new source-format failure.

Tests cover ordinary workflow rendering, current-stage fallback and conflicting
responses, optional/malformed snapshots, known and unknown consensus states,
lecturer own-ID/officer visibility, redacted/missing response details, proposals
and later-proposal annotations, disagreements, structure/reset facts, preserved
earlier approvals, correction targets, resubmission destinations, chronological
ordering, empty history, independent history retry, 401/403 denial, foreign
detail/history identity, old records and the compact officer stepper.

Tests use synthetic fixtures and mocked API responses. Live backend/database
integration, browser/Figma visual acceptance, CI and independent QA were not
performed. Existing design components/tokens are reused; no Figma MCP server was
available. Human review is pending; reviewer unassigned.

The global `npm.cmd run format:check` reports the existing formatting drift in
`docs/BACKEND_COMPATIBILITY.md` and `docs/FRONTEND_PROGRESS.md`. Formatting checks
against their `origin/mvp` contents also fail. Historical tracker formatting is
left intact; changed source and this report are checked separately.

## Suggested commit and Pull Request

Conventional Commit: `feat(tracking): display consensus workflow history`

PR title: `feat(tracking): expand consensus and correction tracking`

PR base: `mvp`

Suggested description:

> Consensus routing can change a claim's current stage without adding a stage
> history row, causing tracking to display an older stage name and assignee.
> Show the request-confirmed current stage, flag missing/inconsistent tracking
> metadata, and retain only genuine returned stage records in the existing stepper.
>
> Share readable chronological audit history across lecturer and officer views,
> including HOD proposals, disagreements, consensus completion, structure changes,
> approval resets and correction/resubmission routing. Display authorized consensus
> snapshots separately from lifecycle status and audit events, with lecturer own-ID
> response filtering and no invented participant totals or agreement records.
>
> This feature is independent of unmerged Features 1, 2, 5 and 6. Backend follow-up
> is required for intermediate agreement publication, proper consensus stage rows,
> proposal-round IDs and richer structure/reset audit data. No backend workflow,
> authorization, claim persistence, financial rules or mutation UI is changed.
>
> Validation: see the verification record above. Global formatting has documented
> baseline Markdown drift; live integration, CI and human review remain pending.
