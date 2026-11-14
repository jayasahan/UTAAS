# Task 5: Paper structure and quota display

Historical report for the PR #63 implementation, prepared 2026-11-05. PR #63
has since merged to `mvp`; the current source snapshot is recorded in
[FRONTEND_PROGRESS.md](FRONTEND_PROGRESS.md) and
[BACKEND_COMPATIBILITY.md](BACKEND_COMPATIBILITY.md). PRs #64 and #65 later added
shared examiner claims and HOD proportion consensus. The verification below
records the original quota feature and does not verify those later additions or
live backend behavior.

Branch: `feature/frontend-paper-structure-quotas`  
PR base: `mvp`  
Backend/source baseline: `019879bb2ae1261d53d23510ab4108c0ba5585c8`  
Review date: 2026-11-05, Asia/Colombo

This branch has been rebased onto the current `origin/mvp`, including merged
academic dropdown PR #62. The quota work remains a separate frontend feature
commit and targets `mvp`. No backend files were changed.

## Implemented behavior

- Query the registered structure after course code, academic year, semester and
  examination type are populated. Normalize course-code case and surrounding
  whitespace and use the existing authenticated API client/query encoding.
- Show the registered paper type, question/MCQ/candidate totals, duration,
  essay/MCQ weights, registrar and registration timestamp. Display setting and
  marking claimants, references, quantities, setting status, and reported quota
  balances, plus moderation, typing, MCQ and continuous-assessment information.
- Show structure information before the payment table and again during final
  review. Load fresh information on request details after submit/resubmit.
- Derive setting availability from examiner IDs and the server-provided question
  quantities, excluding the authenticated applicant's claims as the backend does.
  A non-shared positive setting count consumes the whole paper: even a partial
  claim by another examiner makes a new whole-paper setting option unavailable.
- Disable a zero-valued unavailable setting input. Keep a previously entered
  positive value editable so it can be cleared; block progression/submission
  while it conflicts with the confirmed quota. The quota helper also accepts
  preserved shared rows and compares their question counts to the remaining
  setting allocation, without adding shared-entry/storage fields in this PR.
- Refresh after draft/correction saves and submission/resubmission attempts,
  including failed attempts that might leave server-side registration changes.
  Provide manual refresh/retry. Successful navigation mounts a new request-detail
  query, so displayed post-submission data is fetched again.
- Handle incomplete selections, loading, missing registrations, malformed data,
  query identity mismatches, authentication/network failures and retry. Abort old
  requests and reject late results even if a transport ignores cancellation.
  Previous data is hidden immediately when selection/client/revision changes.
- Read sanitized Nest validation messages from both string and array `message`
  formats for recoverable HTTP 400 responses. Existing bounded-message and
  non-400 diagnostic handling remains intact.

No client-side check reserves a quota. Initial submission remains subject to
server validation; the correction validation gap below requires a backend fix.
Financial rules, rates, payload persistence and workflow permissions are unchanged.

## Verified API contract

Sources inspected directly:

- [Controller](../../backend/src/modules/requests/controllers/paper-marking.controller.ts)
- [Structure service](../../backend/src/modules/requests/services/exam-paper-structure.service.ts)
- [Structure service regression tests](../../backend/src/modules/requests/services/exam-paper-structure.service.spec.ts)
- [Structure entity](../../backend/src/database/entities/exam-paper-structure.entity.ts)
- [Structure correction DTO](../../backend/src/modules/requests/dto/update-exam-paper-structure.dto.ts)
- [Claim DTO](../../backend/src/modules/requests/dto/create-paper-marking-claim.dto.ts)
- [Claim submission service](../../backend/src/modules/requests/services/paper-marking-claim.service.ts)
- [Workflow service](../../backend/src/modules/requests/services/workflow-state-machine.service.ts)

`GET /api/v1/requests/paper-marking/paper-structure` uses the controller's JWT
guard. Its four query parameters are `courseCode`, `academicYear`, `semester`
and `examType`. There is no department, applicant-exclusion or request-exclusion
query parameter. The GET operation does not register a structure.

Unregistered papers return HTTP 200 with `{ exists: false, message }`. A 404,
network error or invalid response is an error, not evidence that first
registration is available. No default quota is fabricated for missing structures.

Registered papers return `{ exists: true, paperStructure, registeredBy,
claimsBreakdown, hodProportionDivision, structureChangeHistory }`. This feature
decodes the structure, registrar and breakdown fields it displays. HOD consensus
and correction-history features remain separate. PostgreSQL decimal weight
columns can arrive as strings such as `"75.00"`; the decoder accepts those exact
numeric representations without treating arbitrary text as a number.

`claimsBreakdown` includes:

| Group                  | Relevant response fields                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `setting`              | `totalQuestions`, `claimedQuestions`, `remainingQuestions`, `isFullPaperClaimed`, claimant ID/name/question count/proportion/reference/status |
| `scriptMarking`        | `totalCandidates`, `totalScriptsClaimed`, `totalQuestionsMarked`, `remainingQuestionsPerScript`, claimant name/scripts/questions/reference    |
| `moderation`           | `isClaimed`, optional `claimedBy` name                                                                                                        |
| `typing`               | `isClaimed`, `typedPagesClaimed`, optional `claimedBy` name                                                                                   |
| `mcqSetting`           | MCQ totals, reported claimed and remaining counts; current service always supplies no claimants                                               |
| `continuousAssessment` | `maxAssessmentsPerStudent`, `totalStudentAssessmentsClaimed`, `maxTotalAssessmentsAllowed`                                                    |

The frontend checks setting totals against claimant quantities and registered
identity before using them to disable controls. Examiner/registrar emails are
not displayed. Claim references are plain text; the panel does not enable access
to another examiner's request or documents.

Initial registration occurs inside the first submission's quota-validation path.
It takes question totals from sharing data, MCQ/weight configuration from the row,
candidates from script count, and duration from the row. Missing values fall back
server-side to five questions, zero MCQs/candidates, three hours, and 100/0 essay/MCQ
weights. The panel explains this registration timing without presenting those
defaults as an existing registration or writing a separate registration payload.
Draft saving does not establish a registration or reserve capacity.

## Backend limitations and dependencies

1. **Marking availability cannot safely disable marking controls.** Display uses
   the maximum questions marked by any claimant; shared-marking submission
   validation sums shared claims. Marking claimants have neither examiner IDs nor
   an `isShared` flag. Non-shared marking has no corresponding quota enforcement
   in `enforceCrossExaminerQuota`. The UI shows returned figures as reported and
   labels final marking availability unconfirmed. It does not invent a universal
   script cap, subtract candidates from claimed scripts, or block a valid existing
   examiner's allocation from an ambiguous balance. Backend reconciliation and
   applicant-specific available quantities are required for reliable disabling.
2. **Corrections do not call the quota validator.** Only initial submission calls
   `validateAndEnforcePaperQuotas`; the workflow correction/resubmission helper
   recalculates fees but does not re-enforce these cross-examiner limits. The
   frontend's setting checks and refreshes cannot fix that server enforcement gap.
3. **MCQ and CA usage are placeholders.** The current breakdown always reports
   zero MCQ/continuous-assessment usage. Typing pages are capped at five in the
   display aggregation. These reported values are not reliable availability or
   remaining-capacity guarantees. The panel states the MCQ/CA limitation.
4. **Row matching can undercount claims.** The breakdown locates course codes in
   row fields or titles, then falls back to aggregate `items`; aggregate item names
   differ from the per-row names it reads. Per-row `courseCode` is not accepted by
   the claim DTO. This PR does not fabricate that field or rewrite paper titles.
   The backend should use canonical metadata/row associations consistently.
5. **Authoritative ownership and concurrency need backend support.** Setting
   validation excludes every claim by the same applicant, whereas the GET
   includes all claims. The UI mirrors the setting exclusion using IDs. Marking,
   moderation and typing lack reliable claimant IDs for equivalent ownership
   handling. The lookup endpoint uses JWT but has no department-scoping check in
   this service. Department access rules and atomic quota enforcement belong in
   the backend; the frontend adds no unsupported department filter or permissions.
6. **Later frontend work is outside this report's original verification.**
   Academic dropdowns (PR #62), shared examiner claim entry and field preservation
   (PR #64), and HOD proportion consensus (PR #65) are now merged. The tests
   recorded below predate those changes; recheck draft restoration, corrections,
   and quota behavior with shared claims before treating the combined flow as
   verified. This report does not establish live behavior or first-registration
   administration coverage.

The panel reuses existing design tokens, tables, inputs, buttons and feedback
components. No live Figma/browser visual review or backend/database mutation
testing was performed. Tests use synthetic fixtures and mocked API responses.

## Changed files

- [structure/contracts.ts](../src/features/paper-marking/structure/contracts.ts): typed response decoding, decimal weights, selection normalization and consistency checks.
- [structure/usePaperStructure.ts](../src/features/paper-marking/structure/usePaperStructure.ts): authenticated query, abort/race protection, error/retry and refresh lifecycle.
- [structure/quotas.ts](../src/features/paper-marking/structure/quotas.ts): applicant-aware setting availability and invalid-setting validation.
- [structure/PaperStructurePanel.tsx](../src/features/paper-marking/structure/PaperStructurePanel.tsx): reusable registered structure, claims and quota display.
- [structure/RequestPaperStructure.tsx](../src/features/paper-marking/structure/RequestPaperStructure.tsx), [RequestDetailPage.tsx](../src/pages/RequestDetailPage.tsx): fresh post-submit/post-resubmit display for authorized request details.
- [PaperMarkingClaimPage.tsx](../src/features/paper-marking/PaperMarkingClaimPage.tsx), [PaymentTable.tsx](../src/features/paper-marking/components/PaymentTable.tsx): form/review integration, unavailable setting control, validation and mutation refreshes.
- [apiClient.ts](../src/services/apiClient.ts): support sanitized string HTTP 400 validation messages alongside existing arrays.
- [structure/paperStructure.test.tsx](../src/features/paper-marking/structure/paperStructure.test.tsx), [structure/PaperStructureWorkflow.test.tsx](../src/features/paper-marking/structure/PaperStructureWorkflow.test.tsx), [paperStructureFixture.ts](../src/test/paperStructureFixture.ts), [CorrectionResubmission.test.tsx](../src/features/corrections/CorrectionResubmission.test.tsx): decoder, lifecycle, quota, rendering, save/submit/correction and error regressions.
- [OfficerReviewHistory.test.tsx](../src/features/officer-history/OfficerReviewHistory.test.tsx): pin the existing fixed-fixture date-filter test's clock and restore real timers; production history behavior is unchanged.
- This report and [FRONTEND_PROGRESS.md](FRONTEND_PROGRESS.md): contract findings and review handoff.

## Verification

Node: `v24.18.1`.

- `npm.cmd test -- --maxWorkers=1 --testTimeout=30000`: **330/330 passed across 30 files**, including **40 new tests**. Full run: 160.86 seconds.
- `npm.cmd run lint`: passed, zero warnings.
- `npm.cmd run type-check`: passed.
- `npm.cmd run build`: passed, including strict TypeScript and Vite production bundling.
- Changed TypeScript/TSX and this report: Prettier check passed.
- `git diff --check`: passed.

Coverage includes selection normalization and all four selection changes,
incomplete selections, anonymous sessions, loading and missing registration,
malformed/inconsistent contracts, decimal-string weights, current-applicant
exclusion, partial/full setting limits, invalid restored setting values, shared
setting boundaries, stale completion and abort handling, manual retry, string and
array API errors, real form save/submit interactions, fresh request-detail data,
and correction save/rejected-resubmission refreshes.

The existing development history-preview date test uses fixed October fixtures;
its clock is now pinned and real timers are restored after each test. No
production history logic was changed. No live integration, independent QA or CI
result is implied. The pending CI and teammate review note above described the
state when this report was prepared; PR #63 has since merged. Current live QA
remains unverified.
Historical formatting in the long-lived progress tracker is retained.

## Historical PR #63 description

Conventional Commit: `feat(frontend): display paper structure quotas`

PR title: `feat(frontend): display registered paper structure and quotas`

PR base: `mvp`

Suggested description:

> Load the registered examination structure when course, year, semester and exam
> type are selected. Show the registrar, structure, existing examiner claims and
> reported quota balances before claim submission and on request details.
>
> Disable unavailable whole-paper setting quantities, validate setting allocations,
> refresh after relevant mutations, and prevent stale responses from displaying a
> previous course. Handle loading, missing registrations, retry and backend string
> or array validation messages using typed contracts and existing design components.
>
> Marking availability remains informational because the backend display and
> enforcement contracts disagree. MCQ/CA usage placeholders and missing quota
> enforcement on corrections are documented for backend follow-up. No financial
> rules, claim-storage fields or workflow permissions are changed.
>
> Validation: see the final verification record above. Live integration, CI and
> independent teammate review were pending when PR #63 was prepared. PR #63 has
> since merged; live integration remains unverified.
