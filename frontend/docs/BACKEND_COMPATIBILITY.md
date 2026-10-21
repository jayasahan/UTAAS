# Backend compatibility register

Inspected 2026-10-21 (Asia/Colombo). Current frontend branch: `feature/frontend-officer-claim-review`.
Backend ownership: another team member. This register records findings only.
Never modify backend sources, configuration, schemas, dependencies or seeds as
part of a frontend task. Report incompatibilities to the backend owner.

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
