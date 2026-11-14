# Backend compatibility register

Initial inspection: 2026-10-21 (Asia/Colombo), on the then-current
`feature/frontend-officer-claim-review` branch. That branch/revision note is
historical; see the current source recheck below.
Backend ownership: another team member. This register records findings only.
Never modify backend sources, configuration, schemas, dependencies or seeds as
part of a frontend task. Report incompatibilities to the backend owner.

## Current source recheck — 2026-11-14

Rechecked `origin/mvp` at `0ea8731` against the current frontend callers and the
backend controllers, guards, DTOs, services, and relevant tests. This is source
compatibility evidence only. The local backend was not listening at
`127.0.0.1:4000`; no live API call, backend test suite, or database mutation was
performed for this recheck.

| Feature area | Current backend source contract | Current frontend connection | Runtime boundary |
| --- | --- | --- | --- |
| Production identity | `POST /api/v1/auth/login`, bearer-protected `GET /api/v1/auth/me`, and bearer-protected `POST /api/v1/auth/logout`; PR #45 source includes password validation and token-version revocation. | The production session provider calls login, confirms the returned identity through `/auth/me`, and sends logout. | No live login, session expiry, logout, CORS, or legacy-token rollout test was run. |
| Paper-marking options and rates | Bearer-protected `GET /api/v1/requests/paper-marking/rates/circular` and `GET /api/v1/requests/paper-marking/options/form-dropdowns`; PRs #52/#57 provide rates/options and filtered course modules. The options controller can fall back to its Engineering catalog when the filtered result is empty. | Academic-option hooks use the returned catalog and typed decoding; they do not derive rates or department scope from editable form fields. | Live department/semester filtering and the fallback behavior still need safe runtime verification. |
| Registered structure and consensus | The bearer-protected paper-marking controller exposes `GET` and `PATCH /paper-structure`, `POST /hod-proportion-division`, and `POST /proportion-consensus`; PRs #58–#59 add structure/quota and consensus behavior. | The claim flow and request detail use typed structure decoders; HOD and lecturer controls call the corresponding endpoints and display pending/error states. | Contract is source-present. Quota/consensus behavior has not been exercised against a live service. |
| Claim and workflow mutations | `POST /requests/paper-marking/draft`, `POST /requests/paper-marking/submit`, and `POST /requests/:id/actions` are bearer-protected. Submission calculates fees and validates quotas in the backend; workflow service checks action/stage/role. | The frontend sends typed payloads and waits for decoded server responses before confirming mutations. | Mocked frontend tests do not prove live authorization, canonical totals, or workflow progression. The quota validator is called on initial claim submission; source search did not find it in the correction/resubmission path. |
| Officer review history | `GET /api/v1/requests/review-history` accepts personal/role scope and uses the QA-03/QA-04 source fixes from backend PR #49. | Frontend PR #50 consumes the decoded response, including explicit scope, search, decision filter, and pagination. | Source contract and mocked tests are present; live reviewer-scoped results remain unverified. |
| Admin portal | PRs #53–#57 add dashboard metrics, users, departments, modules, workflows, and audit endpoints. Admin controllers use `JwtAuthGuard` and `RolesGuard` with `ADMIN`. | The merged admin pages call `/admin/dashboard/metrics`, `/admin/users`, `/admin/departments`, `/admin/modules`, `/admin/workflows`, and `/admin/audit-logs` through the authenticated client. | No live role denial, filtering, or administrative mutation was performed. Admin UI checks must use a disposable test database. |
| General and Examination Duty reimbursement | No dedicated form-submission controller/DTO/service for either request type was found under current `backend/src`; the available claim controller is Paper Marking. | PRs #72–#73 are development-only UI previews and make no backend requests; draft, upload, and submit remain disabled. | Integration requires backend contracts plus faculty-approved fields, document rules, workflow, and payment rules. |

The earlier dated entries below preserve the evidence available at their own
revisions. When a historical statement conflicts with this recheck, use this
2026-11-14 source snapshot for current status. See
[PAPER_STRUCTURE_QUOTAS.md](PAPER_STRUCTURE_QUOTAS.md) for known quota
limitations and [MVP_E2E_TEST_MATRIX.md](MVP_E2E_TEST_MATRIX.md) for live QA
cases that remain unrun.

## Revision and integration boundary

The following opening inspection records the earlier design-system assessment;
later claim planning/implementation sections preserve their own scope and evidence.

- Ran `git fetch origin --prune`; worktree was clean, HEAD and origin/mvp both
  `f9f17d8e941b3df87bb8f3057e53af96bd7a9a9a`. No merge/rebase was needed.
- Latest backend source change: `bd4836eb249e966c6f0a2955e819e1b931d40249`.
- All listed backend branch tips are ancestors of inspected origin/mvp; none
  contains unmerged commits relative to that base at inspection time.
- Current frontend scope is presentation only. **No frontend/backend integration
  test was performed or claimed.** No backend server/database was started or
  mutated. Backend test files were inspected, not executed in this task.

| Remote backend branch suffix | Tip     | Ahead of origin/mvp |
| ---------------------------- | ------- | ------------------: |
| auth-rbac                    | 281e6b9 |                   0 |
| database-entities            | c0544ac |                   0 |
| e2e-verification             | bd4836e |                   0 |
| paper-marking-claim          | 3b9a7ce |                   0 |
| scaffold                     | e5f2e94 |                   0 |
| tracking-history             | f5e1810 |                   0 |
| workflow-engine              | 0938f89 |                   0 |

## Observed contracts (source-present, runtime unverified)

### Phase 2 development authentication and read-only integration — 2026-10-21

Base origin/mvp b0f713d (Phase 1 PR #10 merged); backend remains bd4836e.
Only auth controller/service/provider/DTO/JWT guard/strategy, circular controller/
fee service and relevant frontend files were reassessed. No backend changes.

| Operation                                         | Verified source contract                                                                                                                               | Frontend handling                                                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST /api/v1/auth/mock-login/LECTURER             | No body/credentials; role maps to backend lecturer persona; response `{ accessToken, user }`. Swagger says 200; Nest default may be 201.               | DEV-only button; accept successful 2xx then validate token/lecturer profile and JWT expiry. No invented email, credentials or token.                                                   |
| GET /api/v1/auth/me                               | Bearer JWT; `{ id, email, fullName, role, departmentCode?, departmentId? }`; department fields nullable. Active database user checked by JWT strategy. | Decode/whitelist response. Populate untouched fullName and department with its returned code. Missing department becomes unavailable/blank; designation/staff ID are never fabricated. |
| GET /api/v1/requests/paper-marking/rates/circular | Bearer JWT; `{ circularReference, rates: Record<string,{ label,unit,rate:number }> }`; no extra role guard.                                            | Show actual finite, non-negative rates, labels and units. Empty rates are explicitly unavailable. No invented currency/effective dates.                                                |

Observed known rate keys/units: PAPER_SETTING and PAPER_MODERATION per paper,
SCRIPT_MARKING and SECOND_MARKING per script, PRACTICAL_ASSESSMENT per hour.
The endpoint omits currency/effective-date/version-policy fields. The existing
service multiplies supported aggregate quantities and rounds each line to two
decimals; it does not establish a multi-paper mapping. Phase 2 displays reference
rates only. It does not inject them into claim totals, flatten paper rows, apply
hourly rates to candidates or add translation rules. Amounts remain unavailable.

Session ownership: React provider private memory only; no localStorage,
sessionStorage, cookie persistence, token UI, token logging, environment token or
automatic restoration. Logout, expiry, unauthorized protected responses and reload
clear the session. JWT expiry parsing is only a client lifecycle hint; the server
remains the authority. Each request omits cookies/cache, rejects redirects and
uses the configured API base. HTTP localhost is accepted only in development;
other bases require HTTPS. Unsafe/missing configuration fails closed.

Error states cover loading, signed out, expired session, 401 unauthorized,
403 forbidden, 404 unavailable, malformed JSON/contracts, network and server errors.
Backend error bodies are not reflected/logged. Requests cancel on dependency
changes/unmount; stale responses are ignored. Missing authentication hides fetched
data immediately; untouched autofills clear while user edits remain local.
Production has no mock-login module/UI and no authenticated provider; the form
continues in explicit unavailable/local-preparation mode without API requests.

Live testing limitation: a safe unauthenticated probe of 127.0.0.1:4000/auth/me
(with /api/v1 prefix) could not connect. The development browser sign-in likewise
reported network unavailable. No backend/database was started or modified, no
real JWT was obtained and neither authenticated GET succeeded live. Mocked tests
are contract/UI regression evidence only, not successful real-backend integration.
BC-01 through BC-11 remain open; production authentication, complete staff profile,
rate governance and multi-paper calculation mapping still require backend agreement.

### Paper-marking claim planning reassessment — 2026-10-21

- Fetched origin with prune. Design-system PR #9 is OPEN, not merged; its head
  is ab47148. Prepared dependent branch `feature/frontend-paper-marking-claim`
  from that commit. Inspected origin/mvp remains f9f17d8; latest backend change
  remains bd4836e. All seven backend feature tips have zero commits ahead of mvp.
- Rechecked auth/profile, claim controller/DTO/service, fee rules, request entity,
  workflow actions/resubmission, tracking/history routes and global validation.
  No upload/download controller or custom exception filter was found in src.
- Current PRIMARY Figma references: Step 1 39:48; table-based Step 2 42:110;
  documents 42:154; shared review/declaration 67:2; shared corrections 67:50.
  Earlier form-specific Step 4 42:183 is REFERENCE and must not drive this task.
- BC-01/02/03/04 block the complete designed submission experience: multiple
  paper rows, translation/duration/candidate units, persistent attachments,
  partial drafts, designation/staff ID, private title and declaration persistence
  have no matching complete contract. Do not flatten rows, substitute hours for
  candidates, fabricate document URLs or send unpersisted fields silently.
- BC-06/07 block reliable connected corrections: resubmit shallow-merges form
  data without observed fee recalculation and routes by office role, not an
  explicit returning individual assignment. Structured editable-field correction
  instructions are also absent (BC-04). Refer these to the backend owner.
- Initial draft/submit endpoints calculate the five supported fee categories
  server-side; Figma amounts are illustrative. Counts currently use numeric
  Min(0), not integer validation. The decimal entity total needs its actual JSON
  representation verified before finalizing the response parser.
- Source presence is not runtime verification. No backend/database was started,
  no API call or integration test ran, and no implementation was added in this
  planning task. All BC findings below remain open.

Prefix `/api/v1`; Swagger setup `/api/docs`. Nest validation uses whitelist and
implicit transformation with unknown fields stripped rather than rejected.
Do not send invented fields and assume they are persisted. No global custom
error envelope was observed in main.ts; verify actual HTTP status/body live.
POST auth annotations describe 200, but there is no explicit HttpCode override;
Nest may return its default 201. Check actual status rather than assumptions.

| Endpoint                                     | Observed input/output and access                                                                                                                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST /auth/login                             | LoginDto `{ email, password? }`; returns `{ accessToken, user }`; current provider is mock identity, not production SSO                                                     |
| POST /auth/mock-login/:role                  | Maps seven seeded personas; no production-environment restriction observed in controller                                                                                    |
| GET /auth/me                                 | Bearer JWT; returns id, email, fullName, role, nullable departmentCode/departmentId                                                                                         |
| GET /auth/test-actors                        | Public controller endpoint for mock test personas                                                                                                                           |
| GET /requests/paper-marking/rates/circular   | JWT; `{ circularReference, rates: { [key]: { label, unit, rate } } }`; values in source are backend rules, not verified university policy                                   |
| POST /requests/paper-marking/draft?draftId=  | JWT; CreatePaperMarkingClaimDto; service saves/updates own DRAFT, returns Request entity; calculates fees from dto.items                                                    |
| POST /requests/paper-marking/submit?draftId= | JWT; same DTO, optional promotion of own draft; rejects zero total; creates stages/audit and starts UNDER_REVIEW at HEAD_OF_DEPARTMENT; returns Request                     |
| GET /requests/paper-marking/:id              | UUID parameter and JWT; detail entity with formData/relations; lecturer ownership and HOD scope enforced in service                                                         |
| GET /requests/my-requests?page=&limit=       | JWT; `{ data, meta: { total, page, limit, totalPages } }`; items include id, trackingNumber, requestType, status, currentStageKey, numeric totalAmount, metadata, createdAt |
| GET /requests/pending-queue?page=&limit=     | JWT; UNDER_REVIEW items filtered by role/current stage; HOD department scope; data includes applicantName/email, departmentCode and submittedAt; lecturer gets empty queue  |
| GET /requests/:id/tracking                   | JWT/UUID; trackingNumber, requestType, status, totalAmount, nullable returningOfficerId, currentStage `{ key,name,order,assignedRole }`, stages                             |
| GET /requests/:id/history                    | JWT/UUID; requestId, trackingNumber, chronological events with actionType, actorName/role, previous/newStatus, fieldDiff, comment, createdAt                                |
| POST /requests/:id/actions                   | JWT; `{ action, comments?, updatedFormData?, targetReturnRole? }`; action enum APPROVE, REJECT_RETURN, APPROVE_PAYOUT, DIRECT_QUERY, RESUBMIT, SETTLE; returns Request      |

Tracking stage fields: key, name, order, requiredRole, status, optional/nullable
actorId/name, enteredAt, completedAt and comments. Status is PENDING,
IN_PROGRESS, APPROVED or RETURNED. The presentation WorkflowStepper deliberately
accepts separate display props; a future typed adapter must map these exact fields
without embedding transition logic in UI primitives.

Claim payload: `metadata` (academicYear, semester, degreeProgramme, courseCode,
courseTitle, examType, examinerRole); `items` (paperSettingCount,
paperModerationCount, scriptMarkingCount, practicalAssessmentHours,
secondMarkingCount); optional supportingDocuments `{ name,url,documentType }[],
departmentId and comments. Counts use IsNumber/Min(0), not integer validators.
The frontend must not silently assume stronger server validation.

Roles: LECTURER, HOD, DEAN, EXAMINATION_OFFICER, FINANCIAL_OFFICER,
ASSISTANT_BURSAR, ADMIN. JWT validation checks active database users. RolesGuard
has ADMIN bypass; resource services additionally check ownership/department.
UI navigation never substitutes for server permissions.

## Outstanding findings for the backend owner

All are OPEN source observations, not demonstrated exploits or live failures.
They do not block this presentation-only branch; reassess before connected work.

| ID    | Finding                                                                                                                                                        | Required integration follow-up                                                                                                          |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| BC-01 | One metadata/items object vs Figma multiple paper rows; no translation, duration-per-paper or candidate-based assessment fields                                | Agree payload/schema/rate mapping; do not invent fields                                                                                 |
| BC-02 | supportingDocuments is URL metadata; no upload controller found in inspected request modules                                                                   | Agree authenticated upload/download, limits, storage and preview; file selection is not upload                                          |
| BC-03 | Draft uses full claim DTO and immediately reads dto.items; partial Step 1 persistence is not established                                                       | Verify incomplete-draft contract live with backend owner                                                                                |
| BC-04 | Profile lacks designation/staff ID; claim DTO lacks private reference title, declaration and structured correction items                                       | Agree authoritative profile and persistence fields before form integration                                                              |
| BC-05 | Return handler checks active role but does not limit return to the documented officer subset or require a nonempty reason; supplies a default comment          | Resolve Dean/other role return permissions and reason validation with QA/backend                                                        |
| BC-06 | Resubmit shallow-merges updatedFormData without an observed fee recalculation/schema check in that handler                                                     | Backend owner to validate corrected quantities, canonical totals and editable fields; frontend must not claim tamper-proof resubmission |
| BC-07 | Resubmit routes from returning officer's role, not an explicit individual assignment; non-Exam/Finance cases fall back to HOD                                  | Confirm same individual reviewer vs same office semantics and preserved history                                                         |
| BC-08 | DIRECT_QUERY records audit entry; no dedicated recipient/thread/reply DTO or observed owner/department check inside that handler                               | Backend owner to verify resource authorization and communication requirements                                                           |
| BC-09 | SETTLE checks stage and role; no explicit request-status guard observed; APPROVED/REJECTED display enum values exist but no final-reject action in action enum | Verify terminal transitions and settlement evidence fields; never invent reject API                                                     |
| BC-10 | Mock persona routes available without observed environment gate; fallback JWT secret and permissive CORS exist in source                                       | Backend owner to define secure deployment policy; frontend will not change backend config                                               |
| BC-11 | Queue supports page/limit only, not UI specimen search/status/type/date filters; no explicit bounds observed                                                   | Agree supported filtering/pagination before exposing connected controls                                                                 |

## Inspection sources

- [Auth controller](../../backend/src/modules/auth/auth.controller.ts),
  [service](../../backend/src/modules/auth/auth.service.ts), DTOs, provider,
  JWT strategy and role/department guards.
- [Request controllers](../../backend/src/modules/requests/controllers/),
  [DTOs](../../backend/src/modules/requests/dto/), claim, fee, workflow and
  tracking/history services; user/request/stage entities and main.ts.

## Mandatory update process for each API-connected task

Resumed Phase 2 verification (2026-10-21): the local backend at
`http://127.0.0.1:4000/api/v1/auth/me` was still unreachable. No backend was
started or modified and no authenticated live success is claimed. Existing
contracts and blockers remain unchanged. All 91 mocked/component tests passed
with one Vitest worker after the default parallel run timed out starting workers.

### Claim Phase 1 implementation boundary — 2026-10-21

The subsequent Phase 1 review fixes change frontend wrapping, unit-entry validation,
document-category UI state and Figma presentation only. They add no API calls or
calculation policy. Save Draft/Submit remain unavailable; all integration findings
below stay open. Historical inspection evidence is retained.

Implemented on dependent `feature/frontend-paper-marking-claim`, base ab47148.
Preserved the planning assessment above. PR #9 remains open at inspection;
origin/mvp f9f17d8 and backend bd4836e remain the inspected revisions.

- No auth/session infrastructure is verified in the frontend, so no auth/profile
  or rates API calls are made. Identity starts empty and is explicitly user-entered,
  not server-verified. No bearer token is fabricated or stored.
- The JWT-protected circular controller/service was reread. Supported server
  calculation is fixed-rate quantity multiplication, each line rounded to two
  decimals before summing. UI models preserve each paper and distinct units;
  no adapter flattens them into CreatePaperMarkingClaimDto.
- Runtime estimates are unavailable because verified authenticated rates are
  absent. Translation and candidate-based assessment rules remain unsupported.
  Source/Figma sample rates are not shipped as current remuneration policy.
- Save Draft/Submit remain disabled. The native form handler validates local
  preparation only; no write endpoint, fake success, backend ID or uploaded URL
  exists. Declaration resets on edits and never unlocks unsupported submission.
- File objects remain in memory. PDF/PNG/JPEG selection, extension/MIME matching,
  10 MiB/file and 10 files are explicit frontend preparation limits, not a backend
  upload contract or security/content scan. No files survive route exit/reload.
- Local component/browser tests do not close BC-01 through BC-11. Real backend
  authentication, HTTP errors, payload persistence, uploads, resubmission totals,
  individual reviewer routing and ownership tests remain unverified.

1. Fetch and inspect the actual base/backend revisions. Ask before any conflicting
   merge/rebase; preserve existing work. Record branch tips and unmerged work.
2. Verify controller, DTO, service, auth, permission and error behavior; map
   frontend TypeScript payload/response types exactly. Never invent endpoints.
3. With an agreed safe local environment, test actual authentication, validation,
   errors, ownership, transitions and response structures. No production data.
4. Record commands, revision, environment, scenarios and actual results below;
   source inspection and mocked tests are not integration success.
5. Refer incompatibilities to the backend owner; never repair backend code,
   dependencies, configuration or database as part of a frontend task.

| Date       | Frontend task / backend revision       | Integration status                | Evidence                                                   |
| ---------- | -------------------------------------- | --------------------------------- | ---------------------------------------------------------- |
| 2026-10-21 | Design system / bd4836e (base f9f17d8) | NOT INTEGRATED; presentation only | Source inspection above; no backend execution or API calls |

### Authenticated lecturer request reads — 2026-10-21

Frontend pages now call these source-verified routes through the in-memory
bearer API client: `GET /api/v1/requests/my-requests?page=&limit=`,
`GET /api/v1/requests/paper-marking/:id`,
`GET /api/v1/requests/:id/tracking` and
`GET /api/v1/requests/:id/history`. Contracts were rechecked against `mvp` at
`e1c3f7e`. The list uses only page/limit. Request IDs are UUID-validated before
detail/tracking/history calls. The backend independently checks lecturer
ownership and HOD department scope on detail/tracking/history.

The implementation decodes documented response fields and displays backend
statuses, LKR totals, workflow stages and audit comments. Each resource has its
own loading/error/retry state. It does not expose formData wholesale or send
workflow actions. E15 added five mocked page tests covering the list, three
detail resources, invalid UUID, sanitized unauthorized response and empty list.
The detail view now uses the request type returned by tracking and renders the
documented optional `fieldDiff` in an accessible disclosure. The tests found and
fixed the client decoder rejecting an empty audit comment. All 96 frontend tests,
TypeScript, lint, formatting and build pass. Browser
checks cover only the signed-out `/requests` shell at CSS viewport widths 390,
768 and 1440px; authenticated response rendering is not browser-verified. A
local check found no service at `127.0.0.1:4000`, so there is no live API
integration result. Draft, submit, uploads and correction actions remain
unconnected; Phase 3 blockers above remain open.
The backend audit entity permits `previousStatus` to be null, despite the
history response DTO's non-null example. The request-history UI now accepts
that value and labels it “Initial state”; its test uses a mocked response.
Empty stage comments are accepted as display data. The live backend remained
unavailable at 127.0.0.1:4000 during this worktree's validation, so these
source-derived cases still need real response verification.

### Paper-marking uploads and final submission — 2026-10-21

Inspected the current backend contract merged to `origin/mvp` at
`dd9a48afd1350fc40c15df2b3f94db9521f4eded` (including backend PR #16, commit
`9de962a`). This section records frontend integration against those source
contracts; it does not claim a live server integration test.

- `POST /api/v1/requests/upload` requires a bearer JWT and multipart fields
  `file` and `category`; `requestId` is optional. The response contract is
  `{ name, url, documentType, size, mimetype, requestId }`. The service enforces
  a 10 MiB stream limit and accepts PDF, PNG, JPEG/JPG MIME types. The frontend
  sends the file and category, deliberately omits `requestId` because the
  inspected service only echoes it, and accepts the response only when its
  filename, category, size and MIME type match the selected file. It never
  fabricates an uploaded URL or document ID.
- `GET /api/v1/requests/documents/:filename` requires a bearer JWT. For lecturers,
  the inspected service checks uploader ownership or an applicant-owned claim
  reference. Other roles currently receive access without a department/claim
  scope check. That reviewer-role scope requires backend-owner/security review;
  this feature does not add a document-download UI.
- The upload service writes into a process-local `uploads` directory. No delete
  endpoint was found. Removing a selected/uploaded document from the form only
  removes the local selection or claim reference; it cannot delete the stored
  file. Durable storage and orphan cleanup remain backend/deployment questions.
- `POST /api/v1/requests/paper-marking/submit[?draftId=<uuid>]` is JWT-protected.
  It accepts the preserved `papers[]` model, `supportingDocuments[]` references
  (`name`, `url`, `documentType`), personal/metadata fields, and declaration.
  The response is a Request entity; the service creates workflow/audit records,
  returns status `UNDER_REVIEW` and a tracking number, and calculates the
  canonical amount from backend rates. The frontend submits individual paper
  rows and uploaded document references, decodes only a valid `UNDER_REVIEW`
  response with identifier/tracking/amount, and displays success only after that
  response. It never locally calculates or substitutes the final server amount.
- The backend calculation recognizes paper setting, moderation, script marking,
  second marking, practical assessment hours and candidate assessment. It
  aggregates each supported quantity and rounds line amounts before summing.
  The frontend adapts only exact verified rate keys/units for display estimates;
  translation is retained in each paper row but is not priced by the current
  backend calculation. Any unresolved line makes the estimate unavailable. The
  submitted amount remains backend-authoritative.
- Draft create/update remains the existing `POST /draft` behavior. On a
  confirmed draft response, the frontend preserves document references and
  resumes using the returned draft ID. No upload is considered associated with
  a claim until its returned reference is included in the draft/submit payload.
- API contract and UI tests use mocked responses. During this task,
  `http://127.0.0.1:4000/api/v1/health` refused the connection. No authenticated
  upload, download, draft or submission was exercised against a running backend;
  live integration remains unverified. The local build and tests are not backend
  evidence.

Backend follow-up: confirm reviewer-role document access is appropriately scoped;
confirm durable upload storage and cleanup/deletion policy; verify upload MIME
and size enforcement with real HTTP behavior; and clarify whether translation
should be priced or remain excluded from the official total. No GitHub issue was
created during this frontend task.

### PR #14 persistence contract verification — 2026-10-21

Inspected the merged backend at `origin/mvp` `ba37ecce7fb2b9f0302434379621a7b374c7f878` (PR #14, backend multi-paper/draft contract). Historical pre-PR #14 blockers above are retained as history; this section records the current source state.

- `POST /api/v1/requests/paper-marking/draft[?draftId=<uuid>]` is protected by `JwtAuthGuard`. `SaveDraftClaimDto` accepts partial `personal`, `metadata`/`academic`, `papers[]`, `supportingDocuments[]`, `declaration`, and selected category. Service persists those objects, returns the TypeORM `Request` entity, updates only an owned DRAFT and replaces the stored `formData` on update. The frontend sends a full current snapshot to avoid replacing existing values with omissions.
- Draft paper rows are individually preserved. Each submitted row is still validated by `PaperRowDto`; `title` is required, so a started untitled row cannot safely be serialized. Frontend excludes only the untouched empty starter row and blocks a partially entered row with no title.
- `GET /api/v1/requests/paper-marking/:id` is authenticated; service returns request formData and checks lecturer ownership. `GET /api/v1/requests/my-requests?page=&limit=` filters only by applicant ID (no DRAFT exclusion) and returns status/id/trackingNumber/metadata; source supports draft discovery. No live response has been checked.
- `POST /api/v1/requests/paper-marking/submit[?draftId=<uuid>]` accepts individual rows, calculates canonical LKR total server-side, preserves rows in formData, and returns a Request entity. Backend validation requires metadata and total > 0; frontend performs the stricter full form validation. Calculation aggregates setting/moderation/marking/second marking and assessment **hours**. Translation and candidate assessment quantities are preserved in papers but are not priced by this service. Do not imply these are included in the amount.
- `POST /api/v1/requests/upload` is JWT-protected, accepts multipart `file`, `category`, optional `requestId`; service returns `{name,url,documentType,size,mimetype,requestId}`. It writes to a local uploads directory and applies MIME/10 MiB checks after multer buffers the file. `GET /api/v1/requests/documents/:filename` is JWT-protected but source has no ownership/request association authorization. Upload is therefore not enabled in this frontend until backend ownership and durable storage behavior are confirmed. Local files are never represented as server documents.

Current frontend integration: authenticated JSON draft create/update and resume by ID; My Requests is the verified draft discovery surface. Submission remains disabled because supporting document upload/association is not safe to integrate. There is no live backend environment/result; all current integration tests are mocked. Backend owner follow-up: secure document ownership/download; confirm storage deployment and upload limits before UI upload is enabled; clarify whether translation/candidate quantities intentionally receive no fee; supply sanitized validation/error examples and runtime response samples.

### Officer approval queue source inspection — 2026-10-21

Inspected the NestJS source present in `origin/mvp` at `1ab2c26a31ff4c32f3d4b4aaad1aab4783431529` (includes the merged Paper Marking upload/submission work). This is source inspection only; the local backend was unavailable for live authenticated requests.

- `GET /api/v1/requests/pending-queue?page=<number>&limit=<number>` is protected by `JwtAuthGuard`. The controller defaults to page 1 and limit 10 and returns `data` plus `meta` (`total`, `page`, `limit`, `totalPages`). Each row contains `id`, `trackingNumber`, `requestType`, `applicantName`, `applicantEmail`, nullable `departmentCode`, `status`, `currentStageKey`, numeric `totalAmount`, `metadata`, and ISO `submittedAt`. There is no named response DTO class.
- The service returns only `UNDER_REVIEW` requests ordered oldest first. HOD sees the HEAD_OF_DEPARTMENT stage and is department-filtered only when the JWT profile has a `departmentId`. DEAN, EXAMINATION_OFFICER, FINANCIAL_OFFICER and ASSISTANT_BURSAR see their corresponding stage; ADMIN sees all under-review requests. Other roles, including lecturer, receive an empty queue. The endpoint does not implement search, status/type/date filters, assignment filters, or other pagination parameters.
- Queue detail navigation reuses `GET /api/v1/requests/paper-marking/:id`, which is JWT-protected and returns request data. Its service enforces lecturer ownership and checks HOD department mismatch only when both department IDs are present; the inspected service does not otherwise restrict officer roles or enforce that the request is currently assigned to the caller's approval stage. Tracking/history services have similarly broad officer access. These are backend authorization limitations, not guarantees made by this UI. The UI requires an allowed officer role and a verified HOD department before fetching the queue, but this cannot secure direct API requests.
- Frontend response decoding rejects malformed identifiers, non-`UNDER_REVIEW` statuses, invalid amounts, malformed timestamps, and inconsistent pagination metadata. UI tests use mocked responses; no endpoint success or real authorization result has been verified against a running backend.

Backend follow-up: enforce HOD department scope when department identity is absent; enforce stage/resource authorization for officer request details and tracking/history; provide runtime sanitized responses and clarify whether ADMIN's all-stage queue is intended. No GitHub issue was found in the repository issue search for these specific queue/detail scope concerns, and no issue was created.

### Historical officer claim review authorization check before PR #21 — 2026-10-21

Rechecked relevant request-detail, tracking, audit-history and document-access
source at `origin/mvp` commit `a583ec892de1d3fcafb15028f37021ab85acfb93`
(includes merged Officer Approval Queue PR #20). The reviewer-scope concerns
remain unresolved. Existing follow-ups are open:
[issue #18](https://github.com/jayasahan/UTAAS/issues/18) covers HOD department
scope when a profile has no department ID; [issue #19](https://github.com/jayasahan/UTAAS/issues/19)
covers reviewer scope for request detail, tracking and history. This updates the
earlier queue note that no issue was found at that inspection time; no issue was
created for this frontend task.

- `GET /api/v1/requests/paper-marking/:id` is protected by `JwtAuthGuard` and
  returns a Request entity with `formData`, applicant, stage history and audit
  events. The service checks lecturer ownership and only conditionally checks
  HOD department mismatch; it does not establish stage/resource scope for every
  reviewer role. A known request ID is not sufficient authorization.
- `formData.papers` preserves separate Paper Marking rows and their quantities
  and units. `formData.feeCalculation.items` contains server `key`, `label`,
  `unit`, `rate`, `count`, `subtotal`; request `totalAmount` is server supplied.
  The review decoder preserves paper rows and the UI does not calculate totals.
- `GET /api/v1/requests/:id/tracking` returns current stage and ordered stages
  with required role, status, actor, timestamps and comments. `GET
/api/v1/requests/:id/history` returns audit events. Their shared service
  authorization repeats the conditional HOD check and does not consistently
  enforce reviewer department/stage scope.
- `GET /api/v1/requests/documents/:filename` is JWT-protected, but source allows
  any non-lecturer role to retrieve a known filename without request-level
  ownership/reviewer scope. Document viewing/downloading is disabled. The
  frontend fixture decoder intentionally strips document URLs and displays
  metadata only.
- Officer layout reads `/api/v1/auth/me` for the authenticated role and HOD
  department identity. The claim review route makes no request-specific detail,
  tracking, history or document call while issue #19 is unresolved. Frontend
  role checks are not a security boundary.

These are source-inspected contracts only. No live authenticated officer
detail, tracking, history or document request was attempted. The development
visual preview is clearly synthetic, makes no backend requests and is excluded
from production routing. Backend, CI, and agent files were not changed.

### PR #21 authorization re-check — 2026-10-21

Inspected the actual source at `origin/mvp` commit
`3cadf234683af423d2741713461a76f06791430c`, including merged Officer Approval
Queue PR #20 and backend authorization PR #21. GitHub marks
[issue #18](https://github.com/jayasahan/UTAAS/issues/18) and
[issue #19](https://github.com/jayasahan/UTAAS/issues/19) closed. Source review
verifies the #18 pending-queue fix, but finds residual reviewer stage/resource
gaps in the detail/tracking/history behavior described by #19. Issue state alone
does not establish that those conditions are enforced. No backend source was
modified for this frontend task.

- `GET /api/v1/requests/pending-queue?page=&limit=` is protected by
  `JwtAuthGuard`. An HOD without a department ID receives an empty result; an
  HOD with a department ID is filtered to `HEAD_OF_DEPARTMENT` and the
  applicant's matching department. Dean, Examination Officer, Financial
  Officer and Assistant Bursar are filtered to their current stages; Admin sees
  all pending stages. This verifies the source behavior addressed by #18. No
  live request was made.
- `GET /api/v1/requests/paper-marking/:id` is JWT-protected and returns a Request
  entity containing `formData`, applicant, stage history and audit events; it
  is not a narrowly sanitized reviewer DTO. `getClaimById` permits Admin,
  restricts Lecturers to their own request, keeps drafts private to applicants,
  and requires HOD department IDs to exist and match. It does not verify that
  the HOD is assigned to the current stage. Dean, Examination Officer,
  Financial Officer and Assistant Bursar have no request-level role/stage check
  in this method.
- `GET /api/v1/requests/:id/tracking` and `GET
/api/v1/requests/:id/history` use the same access conditions and therefore
  have the same reviewer-to-stage gaps. PR #21 tests cover draft privacy and
  missing/mismatched HOD department IDs, but do not test wrong-stage HOD access
  or the other reviewer roles.
- `GET /api/v1/requests/documents/:filename` is JWT-protected, but every
  authenticated non-Lecturer role can retrieve a known filename without
  request ownership, reviewer, department or workflow-stage checks. Document
  viewing/downloading remains disabled. The UI shows metadata only, with no
  document URLs.
- The production review route reads `/api/v1/auth/me` through the existing
  officer layout but makes no request-specific detail, tracking, history or
  document calls. Frontend role checks cannot compensate for missing backend
  resource authorization. The development preview is synthetic, makes no API
  calls and is excluded from production routing.

Conclusion: #18 is source-verified for pending-queue department scope. #19 is
closed in GitHub but additional backend stage/resource enforcement is still
needed before production detail, tracking or history can be enabled. Document
downloads separately need request-level authorization. These findings are
source-inspected only, not live integration evidence.

## Officer Review History — contract inspection (2026-10-21)

Inspected the backend present in latest fetched `origin/mvp` at
`570db438f0dc60386678b28e8322830f4776364f` (includes merged Officer Claim
Review PR #22). This is source inspection, not live integration.

- The request controller exposes `GET /api/v1/requests/pending-queue?page=&limit=`
  for currently pending work, not previously handled applications. It does not
  expose completed officer decisions as a history listing.
- `GET /api/v1/requests/my-requests?page=&limit=` is the authenticated
  applicant's own request list; it is not an officer history endpoint.
- `GET /api/v1/requests/:id/history` is a per-known-request audit history. It
  returns request ID, tracking number and events (action, actor/role, previous
  and new status, optional change/comment, timestamp). It cannot enumerate an
  officer's decisions because it requires a request ID. The tracking and
  request-detail routes likewise address a known request rather than provide a
  history list.
- These endpoints use JWT authentication and shared request access checks.
  HOD department matching and draft privacy are checked, but the source does
  not provide an officer-specific decision-history scope contract or a safe
  list that establishes which completed records a reviewer may see. A known
  request ID is not treated as sufficient authorization by the frontend.
- No officer-history pagination, search, decision/department/date filters,
  decision actor attribution list, or response DTO for a completed-review list
  was found. The filters in the development preview operate only on fictional
  local fixtures and do not imply backend support.
- GitHub [issue #19](https://github.com/jayasahan/UTAAS/issues/19) is closed
  as completed (last updated 2026-10-21 17:02 UTC), but closure does not supply
  the missing officer-history listing contract or prove reviewer-stage
  authorization for this use case. Request-specific
  details, history navigation, and document access remain unavailable from the
  production history page. Document downloads remain disabled pending
  request-level authorization evidence.

Backend questions for a follow-up contract: provide a reviewer-scoped list
endpoint and DTO; define role/department/current-stage or historical decision
scope; specify stable pagination and supported filters; define whether each
record represents an officer decision or a broader audit entry; and provide a
request-detail authorization contract for any navigation action. No backend
code or issue was changed or created for this frontend feature.

## Officer Claim Review integration — Issue #23 / PR #25 (2026-10-22)

Inspected the latest fetched `origin/mvp` at
`e5270bed5c9447ed93750552d9c974bf77b3e9aa`. It contains merged backend PR #25
(`34b5104a...`), which hardens existing request-level authorization without
changing endpoint paths or response DTOs. This is source and test inspection,
not live authenticated integration evidence.

Verified authenticated read contracts:

- `GET /api/v1/requests/paper-marking/:id` is protected by the JWT guard and
  UUID parsing. The service returns persisted claim details, applicant,
  `formData`, official fee calculation, and total, then applies shared request
  access control.
- `GET /api/v1/requests/:id/tracking` and
  `GET /api/v1/requests/:id/history` are JWT-protected UUID routes and use the
  same request access control. Existing tracking/history response decoders
  define stage status, actor/timestamps/comments, and chronological audit
  events.
- Shared authorization allows an administrator, the owning lecturer, or an
  authorized reviewer whose role matches the current workflow stage or a stage
  the role has already completed. HOD reads fail closed if either department
  is missing or the IDs differ. Drafts remain private to their owner/admin.
  This establishes role, department (for HOD), workflow-stage, and request
  resource checks; it does not bind access to a specific named officer within
  an authorized role.
- `GET /api/v1/requests/documents/:filename` is JWT-protected and returns a
  binary file response. An administrator or original uploader may access the
  file; otherwise the controller finds a claim whose persisted form data
  references the stored filename and applies the same request access guard.
  The frontend only offers downloads for a safe opaque filename extracted
  from the authorized claim-detail response; it does not render backend URLs.
  The backend currently locates the referencing claim with a filename
  substring query, so exact structured association would be a useful backend
  hardening follow-up. The UI does not use filenames supplied independently by
  the user or queue row.

Frontend integration status: the production Officer Claim Review route now
loads detail, tracking, and history concurrently after the existing verified
officer profile/department gate and strict UUID validation. It displays the
existing Figma-aligned review view only after the three decoded responses
agree on request ID, tracking number, and status. HTTP 401, 403, 404, network,
invalid-response, and mismatched-response cases remain unavailable with safe
retry/back navigation. Authenticated binary downloads use the in-memory bearer
token, omit cookies, disable cache and redirects, and never expose the private
URL. No approval, rejection, correction, or HOD editing operation is added.

Issue [#23](https://github.com/jayasahan/UTAAS/issues/23) requested this live
read integration. PR [#25](https://github.com/jayasahan/UTAAS/pull/25) is
merged and its implementation/tests were inspected in `origin/mvp`; backend
behavior has not been exercised against a running authenticated server.
Automated frontend tests use mocked responses. Document association's
substring lookup remains the noted backend hardening limitation.


## Officer workflow decisions and updated issues — 2026-10-22

Source inspection was performed against origin/mvp at 6a5f287c4af340b9b1a171371a27125a7caf3a20. The latest history includes the merged request-scope changes associated with backend PR #28, including HOD department-scope failure closed when the profile or request department is missing. GitHub issues #26 and #27 were checked with their comments and linked pull requests: both remain open and have no comments or linked closing PR at this inspection.

The authenticated action route is POST /api/v1/requests/:id/actions. Its controller uses JwtAuthGuard and UUID parsing and returns the updated Request entity. TransitionActionDto accepts action plus optional comments, targetReturnRole, and updatedFormData. The backend service loads the request and active workflow stage, checks role and HOD department scope for stage actions, and tests exercise allowed transitions and forbidden role/department cases. The UI treats backend authorization as authoritative; client-side role/stage checks only control presentation.

| Action | Verified backend behavior in merged source/tests | Frontend behavior |
| --- | --- | --- |
| APPROVE | Requires UNDER_REVIEW; active stage role and HOD department scope; advances to the next ordered stage; returns Request with updated currentStageKey. Tests cover HOD advancement, wrong role, and cross-department HOD. | Enabled for HOD, Dean, and Examination Officer only when profile role, request/tracking stage, and stage status agree and the next ordered stage is pending. |
| APPROVE_PAYOUT | Requires UNDER_REVIEW, FINANCIAL_OFFICE stage, and Financial Officer role; opens Assistant Bursar stage. Service tests cover the transition. | Enabled only for the Financial Officer at FINANCIAL_OFFICE with the Assistant Bursar stage pending. |
| SETTLE | Requires Assistant Bursar stage and role; returns status SETTLED and stage SETTLED; service tests cover the result. The service does not explicitly guard that request.status is UNDER_REVIEW before settlement. | Shown only when the decoded request is UNDER_REVIEW and Assistant Bursar is the matching active stage. The missing server status precondition is a backend hardening item; the frontend gate is not a security boundary. |
| REJECT_RETURN | DTO comments and targetReturnRole are optional. Service uses a fixed Lecturer target for HOD; later stages route to Lecturer only when explicitly requested and otherwise route to HOD. The DTO does not enforce mandatory explanation or target-role policy, and tests do not cover missing comments or invalid target combinations. | Return dialog is presentation-only. Confirm Return is disabled; no action request is sent while Issue #27 is unresolved. |
| HOD editing | No verified direct-edit endpoint or DTO contract was found. | Edit permitted fields remains disabled. |

The frontend sends only the verified action and optional decision comments. It accepts a success only when the updated request response matches the request UUID, tracking number, expected status, and expected next stage. The existing API client handles bearer authentication and sanitized unauthorized/server failures. This integration is source-verified and mocked in frontend tests; no live authenticated mutation was exercised.

GitHub issue #26 requests GET /api/v1/requests/review-history?page=&limit= scoped to the authenticated reviewer. That officer-specific listing endpoint is not present in origin/mvp. Keep production Officer Review History listing unavailable and handle its integration in a separate PR once a merged, source-verified contract exists. General per-request history is not a substitute.

GitHub issue #27 requests mandatory return comments, validated correction targets, resubmission validation/recalculation, and a defined HOD editing contract. These requirements are not complete in merged source. Do not enable live returns, correction resubmission, or HOD editing until the backend contract and tests enforce those policies. Request-level authorization remains backend-owned; the frontend must never rely on presentation checks for protection.
## Officer workflow contract update — issues #26 and #27 (2026-10-22)

Verified the merged implementation in latest fetched origin/mvp
(f5953a596aae529f833cdc889f6fb906e2f34024), including backend PR
[#30](https://github.com/jayasahan/UTAAS/pull/30) for
[issue #26](https://github.com/jayasahan/UTAAS/issues/26) and PR
[#31](https://github.com/jayasahan/UTAAS/pull/31) for
[issue #27](https://github.com/jayasahan/UTAAS/issues/27). The issue comments
confirm closure; the statements below are based on source/test inspection,
not issue status alone. Backend tests were inspected but not run in this
frontend task.

### Workflow actions: POST /api/v1/requests/:id/actions

The controller uses JwtAuthGuard, ParseUUIDPipe, and the authenticated
CurrentUser. It returns the updated Request entity. TransitionActionDto defines
action, optional comments, optional targetReturnRole, and optional generic
updatedFormData.

| UI role | Verified action and conditions | Frontend behavior |
| --- | --- | --- |
| HOD | APPROVE at active HEAD_OF_DEPARTMENT stage; service checks stage role and fails closed unless the HOD and applicant department IDs match. | Enabled only for matching authenticated role/stage and UNDER_REVIEW response state. |
| Dean | APPROVE at the active DEAN stage. | Enabled only when current role/stage data agree and the next stage is pending. |
| Examination Officer | APPROVE at the active EXAMINATION_OFFICE stage. | Enabled only when current role/stage data agree and the next stage is pending. |
| Financial Officer | APPROVE_PAYOUT at FINANCIAL_OFFICE; advances to ASSISTANT_BURSAR. | Enabled only when the Assistant Bursar stage is pending. |
| Assistant Bursar | SETTLE at ASSISTANT_BURSAR; sets status and stage to SETTLED. | Exposed as Final Approve only at the active Assistant Bursar stage. The service checks role/stage but has no explicit UNDER_REVIEW status guard in handleSettle; UI checks status but is not a security boundary. |
| HOD, Dean, Examination Officer, Financial Officer | REJECT_RETURN requires nonblank comments. HOD target is fixed to LECTURER_CORRECTION; later office targets are HEAD_OF_DEPARTMENT by default or LECTURER_CORRECTION when targetReturnRole is LECTURER. Only HOD and LECTURER targets are accepted for later offices. HOD role and department scope are checked. | Enabled for the first four roles. The UI requires a section plus explanation, composes the comments field, fixes HOD target to LECTURER, and makes later reviewers explicitly choose HOD or LECTURER. The API response must confirm status and resulting currentStageKey. |
| Assistant Bursar | The service supports REJECT_RETURN at the active stage with the same later-office target rules. | Not displayed because the PRIMARY Assistant Bursar design provides Final Approve only. |

The merged workflow tests include blank/missing return comments, invalid HOD
and later-office targets, allowed HOD/lecturer routes, HOD direct-edit fee
recalculation, non-HOD edit rejection, resubmission fee recalculation,
zero/negative total rejection, and correction resubmission role/department
checks.

HOD direct editing is only partially specified for frontend use. The service
accepts updatedFormData during HOD approval and recalculates official fees, but
TransitionActionDto uses Record<string, any> and the service does not define a
field allowlist or field-level DTO validation. The frontend therefore keeps
Edit permitted fields disabled and does not send updatedFormData pending a
backend-owned field schema.

Frontend sends requests only through the existing in-memory bearer-authenticated
API client. Successful responses are decoded against request ID, tracking
number, status, and expected stage; HTTP 401/403/404, server validation, and
network errors remain errors. Mocked tests verify the behavior; live
authenticated mutations were not tested.

### Officer completed review history: GET /api/v1/requests/review-history

PR #30 adds JWT-protected pagination (page, limit), optional decision (all,
APPROVED, RETURNED_FOR_CORRECTION, REJECTED) and search query parameters. The
response is data plus meta (total, page, limit, totalPages, summaryCounts);
each entry includes request/applicant/department summary, decision, date,
amount, and chronological audit events. Source returns an empty result for
lecturers and fails closed for HODs without departmentId; HOD results are
filtered to the applicant department. Reviewer-role stages are filtered to
completed stage history.

A scope clarification remains before integrating this listing: the merged
query matches a completed stage by reviewer role/stage key, not by the
authenticated reviewer's actorId. It is role-stage scoped rather than
demonstrably limited to records personally handled by a named officer. Keep
history integration in a separate PR after confirming whether role-wide
history is intended or actor-level scoping is required. The endpoint and DTO
are available; live integration is unverified.

### Lecturer Dashboard and My Requests — 2026-10-22

Inspected the current fetched origin/mvp source at
a82b0f4fab526aa2cdbc2e0c3b09057be2dffeb8. The existing route is
GET /api/v1/requests/my-requests?page=<number>&limit=<number>, protected by
JwtAuthGuard and supplied with the authenticated CurrentUser. The service
queries only applicantId: user.id, orders by createdAt DESC, and uses
findAndCount pagination. Each returned row contains id, trackingNumber,
requestType, status, currentStageKey, numeric totalAmount, metadata (from
formData.metadata or {}), and ISO createdAt. meta contains total, page, limit,
and totalPages; the list has no status filter, search/sort parameters, or
per-status aggregates. The query has no status condition, so the all-pages
server total also includes drafts. Source inspection and backend tests are not
live endpoint verification.

The dashboard requests page 1 with a limit of five, so its recent status metrics
are explicitly scoped to that response. It uses meta.total only for the
server-reported all-pages total and derives pending (SUBMITTED plus
UNDER_REVIEW), returned (RETURNED_FOR_CORRECTION), and completed (APPROVED plus
SETTLED) counts from those five rows. Drafts and REJECTED are not counted as
pending or completed. No estimate of global per-status totals is made. The
client first decodes GET /api/v1/auth/me; it does not request lecturer list data
unless the verified profile role is LECTURER.

The production app currently has no production authentication/session provider,
so dashboard API requests are not available there. The existing mock-login
session is development-only and uses in-memory bearer authentication.
Issue #26's officer-specific review-history authorization/scope decision remains
pending; this dashboard does not query or change that endpoint.

## Lecturer correction and resubmission contract — PR #31 (2026-10-22)

Inspected the merged backend source and tests in latest `origin/mvp` at
`05a2153fd24e1e9c883e642417c13c681349a6b4`. Backend PR #31 commit
`b28bc5523efdf252d59f31683f742a57e436f171` adds return-action handling and routing. GitHub Issue #27 is closed; source inspection still finds optional comment and target fields, with a generic service comment used when no comment is supplied. This is not a live integration test.

| Endpoint | Verified contract and authorization | Frontend use / limitation |
| --- | --- | --- |
| `GET /api/v1/requests/paper-marking/:id` | JWT and UUID route; service allows a lecturer only when `applicantId` matches. Returns Request with `applicant`, `applicant.department`, `formData`, stage history, and audit events. | Existing request detail GET is reused. The correction view decodes only applicant name/department, academic metadata, aggregate items, fee data, document name/category, and total. |
| `GET /api/v1/requests/:id/tracking` | JWT; service checks lecturer ownership. Includes current stage and returned stage status/comment/actor/time where present. | Existing tracking GET reused only after the detail GET succeeds. |
| `GET /api/v1/requests/:id/history` | JWT; service checks lecturer ownership. Returns chronological audit events with action, actor role/name, status transition, comment, and timestamp. | Existing history GET reused only after detail access succeeds; latest return event supplies the displayed comment/role/date when present. |
| `POST /api/v1/requests/:id/actions` with `action: RESUBMIT` | `TransitionActionDto` accepts optional `comments` and optional generic `updatedFormData: Record<string, any>`. Service checks original applicant ownership (or ADMIN) and status `RETURNED_FOR_CORRECTION`, shallow-merges updates, and resumes at a stage inferred from `returningOfficerId`; unrecognized roles fall back to HOD. It returns the updated Request. | Not called by this frontend feature. No correction editor or live resubmission is enabled. |
| `POST /api/v1/requests/paper-marking/draft?draftId=...` | Existing draft operation accepts a Paper Marking DTO and only updates records whose status remains `DRAFT`; submitted claims are rejected. | Not a correction-save operation; it cannot safely save a returned claim. |

### Remaining correction blockers

- `updatedFormData` is optional generic data without `@IsObject`, nested DTO
  validation, or an allowlist of editable fields. The service shallow-merges
  arbitrary provided keys.
- The return DTO accepts optional comments and an optional workflow target; omitted comments receive a generic service fallback. It does not provide a structured section/field correction target for the lecturer UI.
- No correction-specific save endpoint exists. The DRAFT update endpoint
  explicitly rejects non-DRAFT requests.
- This resubmission path does not call the Paper Marking fee calculator. It
  does not establish updated fee totals/rate recalculation for corrected data.
- Current persisted form data uses aggregate item quantities and does not retain
  the frontend's multiple-paper row model or separate candidate/hour assessment
  quantities. New uploads and correction-time document association are not
  established by this workflow contract.
- The service checks ownership and returned status but does not explicitly
  require `currentStageKey === LECTURER_CORRECTION` before RESUBMIT. It also has
  no demonstrated idempotency/locking guarantee for concurrent duplicate
  requests. Frontend controls remain disabled; request authorization is owned
  by the backend.

The frontend uses the safe read-only detail/tracking/history responses to show
available return comments and submitted data. It omits absent section targets,
per-paper rows, private document URLs, and unverified editable fields. No write
request, fake response, or live authenticated integration was performed.

Related: [Issue #27](https://github.com/jayasahan/UTAAS/issues/27) and
[merged backend PR #31](https://github.com/jayasahan/UTAAS/pull/31). Issue closure
confirms PR merge, not that the remaining field-level correction contract has
been resolved.

## Officer Dashboard queue contract — 2026-10-22

Source-inspected `origin/mvp` at
`1e8f4d5419b02553b2b26931ebb089d8672db61f`. The dashboard reuses
`GET /api/v1/auth/me` and JWT-guarded
`GET /api/v1/requests/pending-queue?page=1&limit=5`; no new backend
endpoint or authentication transport is introduced. The queue service filters
`UNDER_REVIEW` by active workflow stage: HOD to
`HEAD_OF_DEPARTMENT` and applicant department ID (missing HOD department ID
fails closed), DEAN to `DEAN`, EXAMINATION_OFFICER to
`EXAMINATION_OFFICE`, FINANCIAL_OFFICER to `FINANCIAL_OFFICE`, and
ASSISTANT_BURSAR to `ASSISTANT_BURSAR`. Dean results are stage-scoped in
source, without a demonstrated faculty boundary. ADMIN can use the existing
all-stage queue but is not shown the new reviewer dashboard.

The paginated response supplies `data` and `meta.total`, `page`, `limit`,
and `totalPages`. Each queue row has ID, tracking number, request type,
applicant name/email, department code, status, current stage, total amount,
metadata, and `submittedAt`. The service maps `submittedAt` from
`request.createdAt` and orders by creation time ascending. The dashboard
therefore labels this field `Request date` and describes its five-row
preview as the next requests in queue order.

Only Pending Reviews has an accurate role/stage-scoped total via
`meta.total`. The queue does not provide completed-review,
returned-for-correction, or recent-activity aggregates. Issue
[#26](https://github.com/jayasahan/UTAAS/issues/26)'s completed-history
individual-versus-role scope remains unresolved for frontend use; this
dashboard does not call `/requests/review-history` or infer personal review
counts from it. Those three metrics are explicitly unavailable. Backend
authorization remains authoritative; frontend role checks only prevent
inappropriate navigation and requests. Production session availability and
live authenticated dashboard integration remain unverified.

## Lecturer correction and resubmission V2 — 2026-10-22

Source-inspected the fetched `origin/mvp` at
`e3e6e07ca26abba71c71626240737a25a0f30c55`, which includes
[backend PR #37](https://github.com/jayasahan/UTAAS/pull/37) (commit `d70d4eb`).
This section supersedes the earlier PR #31 correction blockers for the current
backend source; those earlier observations remain above as historical evidence.
Source inspection and backend test inspection are not live API verification.

| Operation | Verified current contract | Frontend use |
| --- | --- | --- |
| Read returned claim | JWT-protected `GET /api/v1/requests/paper-marking/:id` requires a UUID and applies applicant/reviewer resource authorization. The backend has no general `GET /api/v1/requests/:id` detail route. Tracking and history remain `GET /api/v1/requests/:id/tracking` and `/history`, subject to resource access. | Load the same returned request, officer return comment, audit history, stage, full `formData.papers`, and document references after verifying the lecturer profile. Block editing if original rows or document references cannot be restored. |
| Save corrections | `POST /api/v1/requests/paper-marking/draft?draftId=<existing request UUID>` uses `SaveDraftClaimDto`. For an existing claim, the service requires the original applicant and either `DRAFT` or `RETURNED_FOR_CORRECTION` at `LECTURER_CORRECTION`. The service computes fees and defaults omitted fields before merging. | Send the complete current personal, metadata, paper-row, document-reference, declaration, selected-category, and preserved note snapshot. Require the same request ID, returned status, and lecturer correction stage in the response before showing a save confirmation. |
| Resubmit | JWT-protected `POST /api/v1/requests/:id/actions` with `action: RESUBMIT` and nested `updatedFormData` uses `CorrectedPaperMarkingClaimDto`. The DTO permits validated `personal`, `metadata`/`academic`, `papers`, `items`, `supportingDocuments`, `declaration`, and `comments`; global validation transforms and whitelists fields, and the workflow service allowlists these keys. For `LECTURER_CORRECTION`, only the original applicant or ADMIN may act. The service rejects a non-returned status or non-correction stage. | Send the complete corrected row-level snapshot to the existing request ID. Omit aggregate `items` so the backend derives them from `papers`; do not use the new-claim submit route. Confirm the response is the same request, `UNDER_REVIEW`, and at the expected returning-officer stage. |
| Fees and stage | The correction draft service calculates fees on save. The workflow action service recalculates `feeCalculation` and `totalAmount` on resubmit, rejects a non-positive amount, and routes to the returning officer's role stage (or HOD fallback when that officer cannot be resolved). | Display local rate-based figures only as estimates. Display a final amount only after a decoded server response. Verify the expected stage from the return audit event and fail closed if it cannot be established. |
| Documents | Authenticated `POST /api/v1/requests/upload` accepts PDF/PNG/JPEG up to 10 MiB and returns a document reference; the optional `requestId` is echoed, not an association operation. Saving or resubmitting with `supportingDocuments` associates the supplied references. Omission preserves existing references on resubmit; an explicit array replaces claim associations. | Keep existing references in every complete snapshot and attach newly uploaded references only after upload confirmation. Removing a reference detaches it on the next successful save/resubmission; the backend has no file-delete endpoint. No raw private storage URL is displayed. |

The frontend enables lecturer editing only at `LECTURER_CORRECTION`. The backend
also supports a separate HOD-stage resubmission path with department checks;
that path is outside this lecturer feature. Older aggregate-only claims, missing
row units, malformed document references, or unverifiable return history remain
read-only. The return contract still does not identify a structured form
section to correct. The workflow action has status preconditions, but no
idempotency key or demonstrated concurrent duplicate guarantee. The frontend
blocks repeat clicks and checks request status before any retry after an
uncertain response. The local backend was not listening on port 4000, so live
authenticated save/resubmit and document association remain unverified.

Related: [Issue #27](https://github.com/jayasahan/UTAAS/issues/27) and
[backend PR #37](https://github.com/jayasahan/UTAAS/pull/37).


## MVP stabilization source recheck — 2026-10-22

Inspected read-only against origin/mvp d59d31f28e3838a705f332de67325e1f4e743c10.
Backend PR #43 is present in this revision. No backend files or tests were
modified or executed. No backend server/database was available for live
integration.

### Officer completed review history (Issue #26, PR #30)

- Route: GET /api/v1/requests/review-history. The controller is protected by
  JwtAuthGuard and obtains the principal through CurrentUser. Query parameters
  are page, limit, decision, and search. No date or department filters exist.
- Response: data[] entries contain id, trackingNumber, applicant, claimType,
  department, departmentCode, decision, decisionDate, totalAmount, and events.
  meta contains total, page, limit, totalPages, and summaryCounts.
- Scope: service selects completed RequestStageHistory rows by role-specific
  stage key. HOD additionally filters applicant.departmentId and returns empty
  when the profile has no department. Other reviewer roles are stage-scoped.
  The entity provides actorId, but the history query does not compare it to the
  authenticated user. This does not meet Issue #26's individual-reviewer
  acceptance criterion (QA-03). Issue #26 is closed and its comment says PR #30
  delivered the endpoint, but closure is not evidence that this condition is
  satisfied.
- Decision mapping: the service marks a result returned when either the
  selected stage action is REJECT_RETURN or the request's current status is
  RETURNED_FOR_CORRECTION. A request returned by a later stage may therefore
  rewrite an earlier completed stage's decision (QA-04). Counts are derived
  from these mapped values. Existing tests cover basic role response,
  department fail-closed, search, and decision filtering, but do not establish
  actor ownership or earlier approval stability.
- Pagination is applied in memory after the service loads all matching
  requests. The decision filter and search are supported; date/department
  filters are not. The DTO's summary counts are computed before decision
  filtering and should not be presented as verified personal/global totals.
- Frontend production history remains unavailable. Only the existing profile
  check is made; the page does not request the history list, per-request
  history, tracking, or documents. The development preview uses clearly
  fictional Paper Setting & Marking examples only.

### Production authentication recheck (Issues #38 and #44, PRs #40 and #43)

PR #43 is included in the inspected base, but Issue #44 is open for additional
security fixes. Source inspection confirms: SeedService invokes seedAll during
application bootstrap without an environment gate and assigns a shared default
password hash; production password login can return an account with no password
hash after receiving a non-empty password without verifying it; Google token
audience is optional when GOOGLE_CLIENT_ID is absent; verified university
accounts may be auto-provisioned into a fixed COM department; logout returns a
success response but does not revoke issued JWTs, and JwtStrategy checks user
existence/active state rather than a revocation version. The JWT secret has a
separate production validation check, but that does not close the findings
tracked in Issue #44.

No frontend production login/session provider is available in the merged MVP.
Existing development sign-in remains development-only and in-memory. No
authentication shortcuts or backend changes were introduced in this task.
Live authentication, logout revocation, and role access behavior remain
unverified.

Related evidence: [Issue #26](https://github.com/jayasahan/UTAAS/issues/26),
[Issue #44](https://github.com/jayasahan/UTAAS/issues/44),
[backend PR #30](https://github.com/jayasahan/UTAAS/pull/30), and
[backend PR #43](https://github.com/jayasahan/UTAAS/pull/43).


### Authentication hardening recheck after backend PR #45 — 2026-10-22

The earlier PR #43 findings above are historical; this recheck is against
origin/mvp 0af255c7bb2f877c31d091fe3dd557b41803e702, which includes merged PR
#45. Source and tests now show: production skips default persona user seeding;
password login rejects accounts without a password hash and verifies configured
hashes; Google login requires GOOGLE_CLIENT_ID as its token audience and only
authenticates active pre-registered users; logout increments tokenVersion and
new JWTs carry that version, which JwtStrategy compares with the current user
version. Backend regression tests were added for these behaviors.

One rollout detail remains: JwtStrategy performs the version comparison only
when the JWT contains a numeric tokenVersion. Existing tokens issued before
PR #45 without that claim are not rejected by this check. Token lifetime,
rollout invalidation, and live deployment behavior were not verified here.
The frontend production authentication provider is also still absent, and no
live authenticated flow was tested. No backend source was modified in this
frontend task.
### Production hybrid authentication integration — 2026-10-22 (PR #45)

Inspected against `origin/mvp` at `def0977d1be84801c40d13c1a4797719a16fe948`, which includes backend PR #45 and frontend stabilization PR #46. Backend controller, DTO, service, JWT strategy, role enum, configuration and regression tests were reviewed. Issue #44 is reported closed; the merged source and tests, rather than issue status, are the evidence below.

| Contract | Verified request/response | Frontend use |
| --- | --- | --- |
| `POST /api/v1/auth/login` | `LoginDto` accepts `{ email, password? }`; successful `AuthResponse` is `{ accessToken, user: { id, email, fullName, role, departmentCode, departmentId } }`. The UI requires both email and password. Active pre-provisioned accounts with a password hash are authenticated by bcrypt. | Bearer token is retained in a React ref only. The returned profile is not trusted until a subsequent `/auth/me` response matches it. |
| `GET /api/v1/auth/me` | Bearer-protected; returns the authenticated user's `id`, `email`, `fullName`, `role`, `departmentCode`, and `departmentId`. | Used to confirm identity and exact role before exposing protected routes. |
| `POST /api/v1/auth/logout` | Bearer-protected, bodyless; returns `{ success: true, message }`. The service increments `tokenVersion`; new JWTs include the version and the strategy compares it to the current user version. | Clears local in-memory state immediately and sends the revocation request. The UI reports server logout only after a successful response. |

Backend PR #45 source/tests verify that production skips default persona seeding, password login rejects users without a configured password hash, Google OAuth requires `GOOGLE_CLIENT_ID` as its token audience and only accepts active pre-registered accounts, and logout revokes tokens carrying the current version. Exact roles are `LECTURER`, `HOD`, `DEAN`, `EXAMINATION_OFFICER`, `FINANCIAL_OFFICER`, `ASSISTANT_BURSAR`, and `ADMIN`.

There is no refresh-token endpoint. A full browser reload therefore returns to signed-out state and requires a new login. The frontend reads JWT `exp` only to schedule local session expiry; identity and roles come only from `/auth/me`. The backend strategy only checks token version when a JWT contains a numeric `tokenVersion`, so legacy tokens without that claim may remain valid until expiry. Deployment must account for that rollout window.

The backend's Nest `@Post` routes do not specify `@HttpCode`, so Nest's default successful POST status is 201 even though Swagger documents 200. The frontend accepts any 2xx response. This status was verified from source, not from a live server.

Production CORS must be configured with the deployed frontend origin through `CORS_ALLOWED_ORIGINS`. In production, absent configuration results in a false CORS origin setting. Although the backend enables credentialed CORS, this frontend uses bearer authorization with `credentials: 'omit'`; it does not use cookies. The frontend does not persist tokens and does not implement refresh. Google sign-in remains unavailable in the UI because the frontend has no verified client configuration. No live backend was listening at `127.0.0.1:4000` during verification, so runtime login, `/auth/me`, logout and deployment CORS remain unverified.

Related evidence: [Issue #44](https://github.com/jayasahan/UTAAS/issues/44), [backend PR #45](https://github.com/jayasahan/UTAAS/pull/45), and [frontend PR #46](https://github.com/jayasahan/UTAAS/pull/46).

### Officer Review History contract re-verification after backend PR #49 — 2026-10-22

The historical Issue #26 / PR #30 findings above describe the earlier merged
contract. They are superseded for the review-history list by source inspection
of `origin/mvp` at `1c6e8e0039fafea51ed76e97be80d4fd9fe608e8`, which includes
backend PR #49 and its QA-03 / QA-04 changes. The controller, service, response
DTO, controller tests, and service regression tests were inspected. No backend
files were changed.

| Contract                                | Verified behavior                                                                                                                                                                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/requests/review-history`   | `JwtAuthGuard` and bearer authentication; query parameters are `page`, `limit`, `decision`, `search`, and `scope`. The response is `{ data, meta }`; `meta` contains `total`, `page`, `limit`, `totalPages`, and `summaryCounts: { approved, returned, rejected }`.                                                 |
| Default `scope=personal`                | The service selects completed stage-history rows whose `actorId` matches the authenticated user's ID and whose stage matches the role (ADMIN is matched by actor across completed stages). The controller test verifies that omitted scope defaults to `personal`; service QA-03 tests verify the actor constraint. |
| Explicit `scope=role`                   | Returns completed decisions for the authenticated reviewer role/stage without the actor constraint. ADMIN is a special case returning completed review stages across roles. The frontend makes this scope an explicit user selection; it does not label role-wide results as personal decisions.                    |
| HOD department boundary                 | Both personal and role scope add a server-side filter on the applicant's `departmentId` matching the authenticated HOD's `departmentId`. A HOD with no department ID receives an empty response. The frontend also retains the existing profile gate, but backend filtering remains authoritative.                  |
| Other roles                             | DEAN maps to `DEAN`, EXAMINATION_OFFICER to `EXAMINATION_OFFICE`, FINANCIAL_OFFICER to `FINANCIAL_OFFICE`, and ASSISTANT_BURSAR to `ASSISTANT_BURSAR`. A lecturer and unsupported non-admin role receive an empty list. The endpoint uses authentication plus service scoping rather than a controller role guard.  |
| Decision mapping                        | The selected completed stage action controls the historical decision: `REJECT_RETURN` maps to `RETURNED_FOR_CORRECTION`, approved actions map to `APPROVED`, and the legacy `REJECT` action maps to `REJECTED`. QA-04 regression coverage confirms a later-stage return does not rewrite an earlier HOD approval.   |
| Search, decision filter, and pagination | Search is applied by the backend to tracking number or applicant name. `decision` filters the table result total. Pagination is server-side. `summaryCounts` are computed over the role/personal scope and search before the decision filter, so the decision selector does not alter the summary cards.            |
| Unsupported filters                     | No date-range or department filter is defined. The production page does not send or apply either filter. Department is displayed only as a returned record field.                                                                                                                                                   |
| Response data                           | Each entry provides request ID, tracking number, applicant, claim type, department and optional department code, historical decision/date, total amount, and audit events. The frontend validates the DTO shape and timestamps before rendering.                                                                    |

The list endpoint returns the audit events attached to each authorized review
entry. The page labels those as request activity and does not imply that every
event was performed by the selected reviewer. It does not navigate to request
details, tracking, or document endpoints; those are separate resource contracts
and are not needed for this integration.

Backend source and test assertions establish the above scoping/mapping
behavior; no live authenticated backend request was performed in this frontend
task. `origin/mvp` was at the PR #49 merge commit recorded above during
implementation.
