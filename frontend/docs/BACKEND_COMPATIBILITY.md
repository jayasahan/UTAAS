# Backend compatibility register

Inspected 2026-10-21 (Asia/Colombo). Frontend branch: `feature/frontend-design-system`.
Backend ownership: another team member. This register records findings only.
Never modify backend sources, configuration, schemas, dependencies or seeds as
part of a frontend task. Report incompatibilities to the backend owner.

## Revision and integration boundary

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
