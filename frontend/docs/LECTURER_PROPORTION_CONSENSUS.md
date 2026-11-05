# Feature 8: Lecturer proportion agreement

Branch: `feature/frontend-lecturer-proportion-consensus`  
Stacked review base: `feature/frontend-consensus-tracking`  
Parent and unchanged HEAD: `59e4478e96a210e2e4f0eee8f5cc59ed499f7396`  
Ultimate integration target: `mvp`  
Review date: 2026-11-05, Asia/Colombo

The requested branch and clean working tree were verified before implementation.
The current branch already contains Feature 11. No branch switch, fetch, reset,
commit, push, merge, staging or PR creation was performed during this implementation.
All Feature 8 work remains available as working-tree changes on the existing branch.

## Implemented behavior

The lecturer request-detail page now provides an agreement interface for persisted
HOD proposals. The dashboard highlights requests at the lecturer-consensus stage
and uses its existing request-detail link. No HOD proposal interface is required
for this screen to consume an existing proposal.

- Displays the server's course, academic year, semester, examination type, essay
  and MCQ percentages, proposal author, timestamp, remarks, status and the signed-in
  lecturer's recorded response when returned.
- Provides Agree and Disagree actions. Disagreement requires at least three Unicode
  letters or numbers after trimming. A labelled, required textarea, inline errors
  and focus on invalid input support keyboard and screen-reader use. The UI limits
  comments to 2,000 characters; this is a frontend input limit, not a backend DTO rule.
- Shows pending, recorded agreement, recorded disagreement, waiting for other
  examiners and completed consensus using verified server data. Waiting for other
  examiners is shown from the POST outcome; a successful individual response does
  not imply completed consensus. No examiner denominator, identities, votes or
  historical events are fabricated.
- Makes an existing response read-only by default. Explicit **Change response** is
  available only while the server-supported proposal state and request stage allow
  revision. Completed consensus is read-only. A reset detected while the screen
  is open clears the applicability of earlier receipts and disagreement form text.
- Reuses Feature 11's `ConsensusTracking`, `RequestWorkflowProgress` and
  `WorkflowHistory`. Successful submission refreshes current proposal, request
  details, workflow tracking and history. No local approval stage or audit event
  is synthesized. Financial values continue to come from refreshed request data.
- Handles loading, missing registrations, absent proposals, missing examination
  identifiers, unavailable response records, invalid/mismatched API data,
  authorization failures, validation failures and uncertain POST outcomes.
- Uses existing React state, authenticated API client, request-resource hook,
  buttons, form controls, alerts, skeletons, responsive layout and design tokens.
  No production mock proposals, new dependencies or backend changes were added.

## Verified contracts and authorization

Source inspected:

- [LecturerProportionConsensusDto](../../backend/src/modules/requests/dto/lecturer-proportion-consensus.dto.ts)
- [Paper-marking controller](../../backend/src/modules/requests/controllers/paper-marking.controller.ts)
- [ExamPaperStructureService](../../backend/src/modules/requests/services/exam-paper-structure.service.ts)
- [Claim detail service](../../backend/src/modules/requests/services/paper-marking-claim.service.ts)
- [Request access control](../../backend/src/modules/requests/utils/access-control.util.ts)
- Existing authenticated profile, request-detail, tracking and history contracts.

| Endpoint                                                   | Feature 8 use                                                                                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/auth/me`                                      | Verified lecturer identity; checked again immediately before submitting.                                                               |
| `GET /api/v1/requests/paper-marking/:id`                   | Authorized request detail, examination identity, lifecycle, current stage, snapshot and server total; checked again before submitting. |
| `GET /api/v1/requests/paper-marking/paper-structure`       | Current examination proposal and recorded responses, queried with `courseCode`, `academicYear`, `semester`, `examType`.                |
| `POST /api/v1/requests/paper-marking/proportion-consensus` | Records the lecturer's response to the current global examination proposal.                                                            |
| `GET /api/v1/requests/:id/tracking` and `/history`         | Existing Feature 11 presentation, refreshed after a confirmed submission.                                                              |

The POST body matches the DTO exactly:

```ts
{
  courseCode: string;
  academicYear: string;
  semester: string;
  examType: string;
  agreed: boolean;
  comments?: string;
}
```

No request ID, actor ID, percentages, proposal version or invented storage fields
are sent. Course codes are trimmed and uppercased as the service does; other
examination identifiers are trimmed. Non-empty comments are trimmed before posting.
The service requires a non-blank comment for disagreement; the frontend's
three-letter/number rule provides the requested meaningful-comment validation.

The POST returns `{ status, message, paperStructure }`; the current proposal is
inside `paperStructure.hodProportionDivision`. Supported outcome strings are
`AWAITING_OTHER_EXAMINERS`, `DISAGREED_RETURNED_TO_HOD` and `CONSENSUS_REACHED`.
The frontend verifies the returned examination, reviewed proposal fingerprint,
dated own response, agreed value, comment and compatible outcome before presenting
submission success. HTTP success alone is insufficient.

The current-proposal GET uses `{ exists, paperStructure, hodProportionDivision }`.
`exists: false` means no registration. A missing proposal remains an empty state;
missing response records or essential proposal fields never become permission to
submit. Malformed data and duplicate lecturer response IDs are rejected.

The POST service accepts proposals in `AWAITING_LECTURER_CONSENSUS` or
`DISAGREED_RETURNED_TO_HOD`. It requires a matching submitted claimant, with an
ADMIN bypass, and replaces an existing response from the same user. It does not
strictly enforce the lecturer role or terminal request lifecycle itself. The UI
offers actions only to a verified LECTURER viewing an accessible active request
(`UNDER_REVIEW` or `RETURNED_FOR_CORRECTION`) at the consensus stage, or at HOD
when the current proposal is `DISAGREED_RETURNED_TO_HOD`. DRAFT, REJECTED, SETTLED,
non-lecturer and unrelated-stage views have no submission controls. The server
remains responsible for enforcing authorization; frontend checks are not a
security boundary.

## Why a current-proposal lookup is necessary

An intermediate agreement saves only the shared examination structure. It does
not update every request's `formData.hodProportionDivision` or emit an individual
agreement audit event. Relying only on the request snapshot would offer another
submission after a valid agreement and could display outdated proportions.

Feature 8 therefore queries the current examination record only after the
request-detail endpoint has authorized access and the viewing profile is a
lecturer with a relevant active claim. It displays only that lecturer's response,
using Feature 11's existing identity filter. Feature 11's officer view retains
its existing authorized snapshot behavior. The sole tracking-component extension
is an optional `current` flag with a default of false, so the footer accurately
labels a current record without changing existing callers' behavior.

## Duplicate submissions, revisions and stale responses

Before each POST the hook rechecks the authenticated actor, protected request
detail and current examination proposal. A response found in another tab cannot
be silently overwritten: the user must review it and explicitly choose Change
response. A revision is compared with the last reviewed own-response signature.
An immediate ref lock blocks double clicks before React state updates. Component
generation checks prevent an inactive or unmounted preflight from issuing a POST.

A local comparison fingerprint uses returned examination identifiers, proposal
`setAt` and percentages. It is a stale-data guard, not a server version or stored
round ID. Receipt/error state is scoped to the API client, request, lecturer and
proposal. An observed reset invalidates previous confirmations; the user reviews
the new proposal before responding. The interface retains confirmed and uncertain
outcomes in memory while its parent request resources reload.

Network failures, 5xx errors and malformed/mismatched POST responses may occur
after a write. They disable another POST and offer **Check recorded response**,
which performs GETs only. A matching dated own response can confirm the recorded
choice without resending. Absence of a matching record does not prove that the
write failed; controls remain blocked for that attempt. A new proposal is handled
separately. No automatic mutation retry or persistent idempotency key is invented.
These client guards are in memory and cannot guarantee duplicate prevention
across reloads, tabs or concurrent server operations.

The shared API client's sanitized HTTP 400 decoding now accepts either a string
or array of strings. This is necessary because the consensus service raises
string-valued Nest validation messages. Existing non-400 privacy behavior remains.

## Feature 8 files relative to Feature 11

Created:

- `src/features/proportion-consensus/contracts.ts`: typed GET/POST decoding,
  examination/proposal comparisons, eligibility and validation.
- `src/features/proportion-consensus/useLecturerConsensus.ts`: authenticated
  current-proposal lookup, preflight, mutation and uncertain-outcome handling.
- `src/features/proportion-consensus/LecturerProportionAgreement.tsx`: lecturer
  actions, explicit revisions, comment form and loading/error/status presentation.
- `src/features/proportion-consensus/contracts.test.ts` and
  `LecturerProportionAgreement.test.tsx`: contract and UI/integration regressions.
- `src/test/consensusFixture.ts`: synthetic fixtures imported only by tests.
- `docs/LECTURER_PROPORTION_CONSENSUS.md`: this implementation/review report.

Modified:

- `src/pages/RequestDetailPage.tsx`: agreement integration and existing-resource refresh.
- `src/pages/DashboardPage.tsx`: pending-proposal hint in existing request links.
- `src/components/tracking/ConsensusTracking.tsx`: optional current-record footer.
- `src/services/apiClient.ts`: string/array HTTP 400 messages.
- `src/features/requests/expandedWorkflowPages.test.tsx`: supplies the new
  proposal lookup in existing mocks and counts detail retries by their exact URL.
- `docs/FRONTEND_PROGRESS.md`: appended Feature 8 handoff entry.

The parent tracking/history decoders, stepper logic, officer screens, claim forms,
payment calculations, payload persistence, backend and dependency manifests are
unchanged. The feature branch and parent still point to the same commit; all
listed differences are uncommitted Feature 8 work. A comparison against `mvp`
will also include the intentional Feature 11 stack until that parent is integrated.

## Automated verification

Final validation passed:

| Check                                                | Result                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| `npm.cmd test -- --maxWorkers=1 --testTimeout=30000` | 395/395 tests, 32/32 files; includes 52 new Feature 8 cases. |
| `npm.cmd run lint`                                   | Passed with zero warnings.                                   |
| `npm.cmd run type-check`                             | Both application and tooling TypeScript projects passed.     |
| `npm.cmd run build`                                  | Passed; Vite transformed 108 modules.                        |
| Targeted `prettier --check`                          | Changed source/tests and this new report passed.             |
| `git diff --check`                                   | Passed.                                                      |

One full run encountered a timing-sensitive failure in the existing officer-queue
loading test: its deferred resolver had not been assigned when the test invoked
it. The unchanged test passed independently (8/8), then the full suite passed
395/395. No unrelated officer code or tests were changed.

The historical `FRONTEND_PROGRESS.md` tracker was appended without globally
reformatting it. The parent Feature 11 report already records baseline global
formatter failures in that tracker and `BACKEND_COMPATIBILITY.md`; a clean global
formatting result is not claimed here. Tests use the real frontend API client
with mocked HTTP responses; they do not call a live backend or write
financial/workflow data.

The 52 new regression cases cover HOD rendering, exact Agree/Disagree payloads,
mandatory comments, Unicode validation, success, string/array errors, denied
actions, completed consensus, explicit revision, rapid duplicate clicks,
another-tab response, preflight identity changes, missing fields, malformed data,
exam mismatch, loading/empty states, proposal resets, stale form text, lost
responses, server errors, manual reconciliation, unmount cancellation, dashboard
discovery and request/tracking/history refresh. Existing Feature 11 integration
tests also exercise the reused components.

## Remaining backend dependencies and review limits

1. **Atomic proposal and response versions:** the POST accepts no expected
   proposal/response version. A HOD reset or another response can race after the
   preflight GET and before the write. Comparing the reply can detect some
   changes, but cannot undo a vote already applied to a different proposal. Add
   server-enforced expected proposal/response versions and atomic concurrency
   control to close this gap.
2. **Idempotency and transactional writes:** the service provides no client
   idempotency contract. Shared structure, request snapshots and audit rows are
   saved separately. An interrupted request may have partially completed. The
   UI avoids automatic retries, but a reload or concurrent client cannot provide
   exactly-once guarantees. Backend idempotency and transactional behavior are
   required for that guarantee.
3. **Read authorization:** the global paper-structure GET is JWT guarded but not
   request/claimant scoped. This UI gates its lookup behind authorized request
   detail and verified lecturer identity and filters displayed responses, but
   cannot secure direct API access. A claimant-authorized, request-scoped proposal
   endpoint with explicit action capabilities is recommended.
4. **Partial agreement publication and progress:** intermediate agreements do not
   update request snapshots/history. There is no returned eligible examiner roster
   or expected response count. The UI uses the current record and server outcome;
   it cannot provide a progress denominator or manufacture missing audit events.
5. **Lifecycle and legacy contracts:** the service's claimant query excludes only
   DRAFT and REJECTED and has an ADMIN bypass; the UI deliberately limits lecturer
   actions to active consensus/HOD disagreement views. The server should enforce
   its intended role/lifecycle restrictions. Its claimant lookup queries canonical
   `formData.metadata`; older `academic`-only records may be displayed by the
   compatible frontend but rejected as ineligible by the backend.
6. **Explicit proposal identity:** no proposal-round ID is returned. The local
   timestamp/percentage fingerprint cannot distinguish rounds if a server reuses
   all those values. An immutable round ID would resolve this ambiguity.

No Feature 7 interface, backend change or unmerged academic dropdown/quota feature
was imported. Persisted HOD proposals are sufficient for this feature. Live
backend integration, browser/Figma visual acceptance, independent QA and CI were
not performed. Existing components and tokens were reused; no Figma MCP was
available. Human review remains pending, with no reviewer assigned.

## Suggested commit and PR

Conventional Commit: `feat(consensus): add lecturer agreement screen`

PR title: `feat(consensus): add lecturer proportion agreement`

For an isolated stacked review, use `feature/frontend-consensus-tracking` as the
PR comparison base. The ultimate target remains `mvp`; a PR directly against
`mvp` before Feature 11 lands includes both features. Retarget/reconcile the stack
manually after parent integration, accounting for a possible squash merge.

Suggested description:

> Lecturers can review persisted HOD essay/MCQ proposals from request details and
> submit agreement or disagreement with a validated explanation. The screen
> verifies the current proposal and recorded response, supports explicit revisions
> while open, handles resets and uncertain submissions, and refreshes Feature 11
> tracking/history using server-confirmed data. Dashboard request links highlight
> pending proposals. This is stacked on Feature 11; review the Feature 8 delta
> against `feature/frontend-consensus-tracking`.
>
> Verification covers contract decoding, actions, validation, role/stage gates,
> duplicates, resets, lost replies and tracking integration. Backend proposal
> versioning, idempotency, transactional writes and request-scoped lookup
> authorization remain follow-up dependencies; no backend or financial rules
> changed. All 395 tests, lint, TypeScript, changed-source/report formatting and
> production build passed. Live integration and visual acceptance remain pending.
