# Backend compatibility register

Inspected 2026-10-21 (Asia/Colombo). Current frontend branch: `feature/frontend-paper-marking-integration`.
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
