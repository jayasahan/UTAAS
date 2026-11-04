# Task 6: Claim field preservation

Branch: `feature/frontend-claim-field-preservation`  
PR base: `mvp`  
Source contract revision: `019879bb2ae1261d53d23510ab4108c0ba5585c8`  
Implementation review date: 2026-11-05, Asia/Colombo

The working tree was clean and the task branch was absent locally and remotely.
Origin was fetched before creating this branch directly from `origin/mvp`.
No commits, pushes, merges, or PRs were made. Backend files are unchanged.

## Root cause and result

The frontend rebuilt the original paper-row DTO in both restoration and
serialization. `settingShare`, `markingShare`, `typedPageCount`, and
`combinedPaperConfig` disappeared. Aggregate `items` and applicant `comments`
were also omitted. Correction restoration then rebuilt another older snapshot,
and officer review decoded only the original fields. Document decoding rejected
newer categories and historical HTTPS storage references.

Typed allowlists now preserve supported values through draft loading, form-hook
edits, draft saves, JSON restoration, submission, lecturer correction saves and
resubmission. Additional stored details are visible during payment editing,
lecturer review, returned-claim review, and officer review. Optional fields are
not invented for older records. False flags, zero quantities, empty comments,
and partial nested objects survive. Malformed new supported fields fail loading
or serialization rather than silently disappearing.

## Verified field mapping

The authority is the checked-in backend DTO/service code, rather than branch
names or the older compatibility tracker:

- [CreatePaperMarkingClaimDto and nested DTOs](../../backend/src/modules/requests/dto/create-paper-marking-claim.dto.ts)
- [SaveDraftClaimDto](../../backend/src/modules/requests/dto/save-draft-claim.dto.ts)
- [CorrectedPaperMarkingClaimDto](../../backend/src/modules/requests/dto/corrected-paper-marking-claim.dto.ts)
- [PaperMarkingClaimService](../../backend/src/modules/requests/services/paper-marking-claim.service.ts)
- [WorkflowStateMachineService](../../backend/src/modules/requests/services/workflow-state-machine.service.ts)
- [FeeCalculationService](../../backend/src/modules/requests/services/fee-calculation.service.ts)

| Supported fields                                                                                                                                                                                   | Local representation and write behavior                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `personal.fullName`, `designation`, `department`, `staffId`, `referenceTitle`                                                                                                                      | Existing editable strings; serialized with an explicit allowlist.                                                                                                                                                  |
| `metadata.academicYear`, `semester`, `degreeProgramme`, `courseCode`, `courseTitle`, `examType`, `examinerRole`                                                                                    | Existing editable strings. Historical `academic` is accepted as an input alias; writes use canonical `metadata`.                                                                                                   |
| `papers[].id`, `title`, `durationHours`, `settingCount`, `moderationCount`, `translationCount`, `scriptCount`, `secondMarkingCount`, `assessmentUnit`, `assessmentQuantity`                        | Existing row fields and numeric payload mapping retained.                                                                                                                                                          |
| `papers[].settingShare` and `markingShare`                                                                                                                                                         | Independent objects containing only `isShared`, `totalQuestions`, `questionsClaimed`, `proportion`. Booleans and finite numbers retain their values.                                                               |
| `papers[].typedPageCount`                                                                                                                                                                          | Optional finite nonnegative number, including zero.                                                                                                                                                                |
| `papers[].combinedPaperConfig`                                                                                                                                                                     | Only `isCombinedPaper`, `essayWeightPercent`, `mcqWeightPercent`, `mcqQuestionCount`; preserved without deriving HOD decisions.                                                                                    |
| `items.paperSettingCount`, `paperModerationCount`, `paperTranslationCount`, `scriptMarkingCount`, `practicalAssessmentHours`, `secondMarkingCount`, `candidateAssessmentCount`, `paperTypingPages` | Preserve stored quantities; reconcile recognized derived quantities after intentional row edits as described below.                                                                                                |
| `items.continuousAssessmentCount`, `dissertationUndergradCount`, `dissertationPostgradCount`, `thesisMPhilCount`, `thesisPhDCount`                                                                 | Independent aggregate quantities preserved exactly; not reconstructable from the current paper rows.                                                                                                               |
| `supportingDocuments[].name`, `url`, `documentType`, `size`                                                                                                                                        | Preserve existing and newly uploaded references. Optional size remains optional. Categories are nonempty strings, matching the DTO. Known category labels include HOD approval and continuous-assessment schedule. |
| `comments`, `declaration`                                                                                                                                                                          | Applicant comments survive all writes, including an empty string. Intentional edits still reset the declaration under the existing form behavior.                                                                  |
| `selectedDocumentCategory`                                                                                                                                                                         | Draft only. Retained on restoration, including existing category values outside the current menu. Excluded from submission/action snapshots because those DTOs do not support it.                                  |

All optional nested numeric fields use the actual DTO minimums, without adding
new quota or percentage rules. The backend remains responsible for quota
enforcement. Stored `proportion` is retained; it is not overwritten using a
frontend guess.

Local files, `attachedToClaim`, upload `mimetype`/`requestId`, and the internal
`originalPapers` comparison snapshot are excluded from write DTOs. Server-only
`feeCalculation`, amounts, reviewer decisions, and workflow state are never
echoed as editable storage fields. Unknown nested properties are not forwarded.
`departmentId` is DTO-declared but is neither persisted nor applied by the
current claim service; the frontend does not fabricate a form storage field for
it or derive department authority from a form value.

## Aggregate and payment contract decision

The backend calculates each effective quantity as the higher of paper-derived
and explicitly supplied aggregate quantities. Blindly preserving old derived
aggregates would therefore prevent a lecturer from reducing a paper quantity.
Omitting the entire `items` object would erase unrelated CA/dissertation/thesis
claims.

The mapper keeps an independent local snapshot of the original rows and compares
nonfinancial quantities using the verified backend aggregation rules, including
four-decimal setting shares and two-decimal marking quantities. If an aggregate
matches the original row-derived quantity (or is zero), an intentional row edit
updates that aggregate. Other item fields remain untouched. No payment rates or
financial totals are calculated by this reconciliation.

If an affected saved aggregate is nonzero and differs from the original rows,
the mapper stops that save/submission with an explanation. It cannot establish
whether this is a deliberate aggregate claim or stale derived data. Unrelated
edits still preserve that value. The backend needs an explicit source/override
contract to safely resolve such ambiguous edits.

The existing estimate adapter cannot price all these extensions. Estimates are
withheld for shared/combined/typing rows and totals containing positive aggregate
items. Server-confirmed request totals and fee breakdowns remain authoritative
and unchanged. The broader rate-contract repair from Task 2 is not included in
this branch.

## Workflow coverage and limits

| Operation                               | Result                                                                                                                                                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New claim serialization                 | All supported optional data present in form state is included. This task adds preservation and read-only summaries, not new sharing/payment entry controls.                                                                                                                           |
| Draft save, load, edit, restore, submit | Covered through mapping tests and a real page interaction with mocked API responses. Existing documents are retained unless explicitly removed.                                                                                                                                       |
| Lecturer correction and resubmission    | Covered through snapshot tests and a page test that edits, saves to the same request, reviews, and sends `RESUBMIT`. Existing authorization and preflight guards remain.                                                                                                              |
| HOD correction                          | The backend accepts corrected snapshots for HOD edits/approval and HOD resubmission. The shared mapper retains supported fields, but this baseline has no HOD correction editor and draft saving only supports lecturer correction. No new HOD mutation UI or permissions were added. |
| Officer review                          | Decoder retains supported extensions/items/comments and the view shows them alongside the existing server fee lines and total.                                                                                                                                                        |
| Old aggregate-only drafts               | Aggregate items can be loaded and saved without manufacturing paper rows. The existing correction editor still refuses submitted aggregate-only records because the original rows cannot be reconstructed safely.                                                                     |

Historical HTTPS document URLs are preserved as opaque metadata without links or
fetches. Newly uploaded documents still require the existing authenticated
relative upload-reference format. Unsupported/unsafe reference formats fail
closed. The upload controller currently accepts category strings at runtime;
its Swagger enum still lists only three categories while examination options
list five. This documentation mismatch needs a backend update.

HOD decision/consensus response properties are not writable claim DTO fields.
Workflow updates preserve them server-side through the existing shallow merge.
Draft submission replaces `formData` server-side, so preserving server-only
extensions on that path would require a backend change if such data is attached
to drafts. No unsupported properties are sent to work around this limitation.

## Changed files

- [model.ts](../src/features/paper-marking/model.ts), [supportedFields.ts](../src/features/paper-marking/supportedFields.ts): typed extensions, aggregate fields, allowlist decoding and safe aggregate reconciliation.
- [persistence.ts](../src/features/paper-marking/persistence.ts), [correctionPersistence.ts](../src/features/corrections/correctionPersistence.ts): draft/submission/correction field and document round trips.
- [useClaimForm.ts](../src/features/paper-marking/useClaimForm.ts), [validation.ts](../src/features/paper-marking/validation.ts): isolated restoration, typed string-field updates, recognition of supported additional claim quantities.
- [ClaimFieldSummary.tsx](../src/features/paper-marking/components/ClaimFieldSummary.tsx), [PaymentTable.tsx](../src/features/paper-marking/components/PaymentTable.tsx), [ReviewStep.tsx](../src/features/paper-marking/components/ReviewStep.tsx), [DocumentsStep.tsx](../src/features/paper-marking/components/DocumentsStep.tsx), [PaperMarkingClaimPage.tsx](../src/features/paper-marking/PaperMarkingClaimPage.tsx): stored-detail presentation and category retention.
- [estimates.ts](../src/features/paper-marking/estimates.ts): withhold incomplete estimates for supported data it cannot price.
- [contracts.ts](../src/features/officer-review/contracts.ts), [OfficerClaimReviewView.tsx](../src/features/officer-review/OfficerClaimReviewView.tsx), [CorrectionReview.tsx](../src/features/corrections/CorrectionReview.tsx): retain/display supported details during review.
- [fieldPreservation.test.tsx](../src/features/paper-marking/fieldPreservation.test.tsx), [claimFieldFixture.ts](../src/test/claimFieldFixture.ts), [PaperMarkingPersistence.test.tsx](../src/features/paper-marking/PaperMarkingPersistence.test.tsx), [CorrectionResubmission.test.tsx](../src/features/corrections/CorrectionResubmission.test.tsx): exhaustive supported-field fixture, round trips, API-action payloads, edit isolation, malformed data, aggregate conflicts, legacy compatibility and rendering regressions.
- [OfficerReviewHistory.test.tsx](../src/features/officer-history/OfficerReviewHistory.test.tsx): pin the clock for the existing fixed-fixture date filter test; restore real timers after each test. Production history behavior is unchanged.
- This report and [FRONTEND_PROGRESS.md](FRONTEND_PROGRESS.md): contract decisions and review handoff.

## Validation and review

Node: `v24.18.1`. Verification results:

- `npm.cmd test -- --maxWorkers=1 --testTimeout=30000`: **321/321 tests passed across 29 files**, including 31 new tests. Final run: 137.50 seconds.
- `npm.cmd run lint`: passed, zero warnings.
- `npm.cmd run type-check`: passed.
- `npm.cmd run build`: passed (strict TypeScript and Vite production bundle).
- Changed TypeScript/TSX and this report: Prettier check passed.
- `git diff --check`: passed.

The first full run found the pre-existing history-preview clock dependency;
the final full run includes its deterministic test-only fix. The historical
formatting of the long-lived progress tracker was left intact.

Tests use synthetic data and mocked API responses; no live backend/database
claim writes, browser visual verification, or independent QA were performed.
Existing design tokens/components were reused; live Figma verification was not
available. Teammate review and CI remain pending. No approval is implied.

## Suggested commit and PR

Conventional Commit: `fix(claims): preserve supported claim fields`

PR title: `fix(claims): preserve fields across claim workflows`

PR base: `mvp`

Suggested description:

> Editing a saved claim rebuilt the old paper DTO and silently removed shared
> examiner details, typing, combined-paper configuration, aggregate items, and
> comments. Preserve the backend-supported fields and document references across
> draft saves, submission, lecturer corrections, resubmission, and officer review.
>
> Use typed allowlists, retain older records, reconcile recognized derived
> quantities, and block ambiguous aggregate conflicts. Show retained details
> during review and withhold estimates the current adapter cannot calculate.
> Server-confirmed monetary values remain authoritative.
>
> Validation: see the final verification record below. Backend integration and
> teammate review remain pending. HOD correction entry controls and aggregate
> override semantics require separate work; this PR does not introduce them.
