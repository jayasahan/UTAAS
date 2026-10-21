# UTAAS frontend development progress

## Persistence worktree continuation (2026-10-21)

Current working branch: `feature/frontend-paper-marking-persistence-v2`, based on merged `origin/mvp` at `ba37ecce7fb2b9f0302434379621a7b374c7f878`. The original checkout at `E:\Academic Works\Sem 05\Software Project\UTAAS` remains untouched on its prior branch with all uncommitted tracked and untracked files preserved. Request tracking PR #13 and backend contract PR #14 are present in this base.

Separate course code/title fields and validation were selectively carried forward. Stale request-tracking copies were not transferred; merged pages/contracts remain from `mvp`.

Phase 3 evidence: authenticated POST draft create/update and GET-by-ID resume are implemented against PR #14 source contracts. My Requests surfaces DRAFT rows for resume. Mapping keeps per-paper rows separate, preserves course fields and does not send aggregate items. An untouched blank row is omitted; started untitled rows and locally selected files block save to avoid silent loss. Server fee values are not calculated in the browser. Submission and upload remain disabled: document download has no ownership check, and local files are not uploaded. Translation/candidate quantities remain unpriced in the inspected server calculator. These are source-based/mock-tested findings only; live backend behavior was unavailable and has not been verified. No roadmap document exists in the clean `mvp` base.

Validation on Node 25.2.1: `npm ci` completed with 0 reported vulnerabilities; Vitest passed 104/104 across 10 files; ESLint and strict TypeScript passed; Prettier passed for every changed file using the checkout's CRLF-aware `--end-of-line auto` setting; production build passed. `127.0.0.1:4000` was not listening, so live integration was unavailable. Browser/responsive checks were not run. Independent review, CI, live integration and merge are pending.

Snapshot: 2026-10-21 (Asia/Colombo). Owner: frontend developer, Fernando A.N.V.
Current feature branch: `feature/frontend-request-tracking` from `origin/mvp` at `e1c3f7e`. Scaffold commit: `101184c7ad19d2ae4f9450aed56b101ced5425b3`.
The scaffold is implemented, locally validated, committed and pushed.
[PR #8](https://github.com/jayasahan/UTAAS/pull/8) merged into `mvp` at
`f9f17d8e941b3df87bb8f3057e53af96bd7a9a9a`. Reviewer approval and independent QA
remain UNVERIFIED. Design-system [PR #9](https://github.com/jayasahan/UTAAS/pull/9)
merged at `4208d2e`; Phase 1 commit `b5e2689` merged through
[PR #10](https://github.com/jayasahan/UTAAS/pull/10) at `b0f713d`.
Phase 2 authentication/read-only changes merged through
[PR #12](https://github.com/jayasahan/UTAAS/pull/12) at `e1c3f7e`. Source and
mocked tests are present; live authenticated integration remains unverified.
PR #12 has no reported status checks; independent QA is not inferred from merge.
No feature is accepted as fully delivered. Earlier evidence entries retain
historical status.

Use [FRONTEND_REVIEW_CHECKLIST.md](FRONTEND_REVIEW_CHECKLIST.md) for each task's
review record. This tracker describes planned work; it does not authorize Git
operations or changes outside an assigned task.

## Sources and scope

Read the local `Agents files/Agents files/AGENTS.md`, `CODEX.md`, and
`docs/agentic/ROLE_FRONTEND.md`, `GIT_CONVENTIONS.md`, and
`SPRINT_1_MVP_TRACKING_HISTORY.md` within that directory. These instructions stay
local and untracked. Their old `E:/Projects/UTAAS` links are stale. Do not copy
agent files into deliverables to repair those links.

The official [UTAAS Figma design](https://www.figma.com/design/BzLWUOHB9HGDnUV6fNGbrG/UTAAS?node-id=1-6)
defines visual targets. The current frontend uses React, TypeScript, Vite,
Tailwind CSS, and React Router. See [frontend setup](../README.md).

Sprint 1 delivers Paper Setting & Marking claims through Lecturer, HOD, Dean,
Examination Officer, Financial Officer, and Assistant Bursar, with tracking,
history, corrections, and settlement visibility. Lecturer submission is one of
the six displayed stages, not an officer approval. Other request categories
remain future work. Dashboard/list views are limited to supporting this slice.
Direct queries are documented Sprint 1 requirements, with interaction details
pending agreement. Final rejection behavior is provisional, not implicitly
authorized by a design mockup.

## Status and counting rules

Implementation status: `NS` not started; `IP` in progress with evidence; `B`
blocked by a specific unresolved issue; `I` implemented with local acceptance
evidence. Dependency on a future task alone does not make a task blocked.

Each task also has independent gates:

- Local verification: NOT RUN / PARTIAL / PASS / FAIL, with evidence and revision.
- Teammate review before merge: UNVERIFIED / PENDING / IN REVIEW / CHANGES REQUESTED / APPROVED.
- Git: UNCOMMITTED / COMMITTED / PUSHED; record commit only when it exists.
- Formal PR: NOT OPENED / OPEN / CHANGES REQUESTED / APPROVED / MERGED / CLOSED.
- CI: UNVERIFIED / NOT RUN / RUNNING / PASS / FAIL; identify the checked commit.
- QA: NOT RUN / IN PROGRESS / PASS / FAIL, with tester and tested revision.

Only call a task **Complete** when implementation is I, local verification PASS,
a named teammate has approved the final formal PR revision, the PR is merged into `mvp`, CI
passed for the merged changes, and task-specific QA passed. Reopen affected gates
after substantive changes. A local build, backend test, or mock response alone
does not prove an integrated frontend feature works.

There are 30 equal-weight Sprint 1 tasks below. Do not assign partial credit:

- Implementation percentage = I tasks / 30 x 100.
- Teammate approval, merge, and QA percentages = tasks passing each gate / 30 x 100.
- Delivery percentage = Complete tasks / 30 x 100.
- Round to one decimal. These are task-count measures, not estimates of effort.
- Future tasks and tracker maintenance are excluded. Log scope changes before
  changing the denominator; do not silently split tasks to increase progress.

### Current summary

| Scope             | Complete (all gates) | Implemented I | In progress IP | Blocked B | Not started NS | Total |
| ----------------- | -------------------: | ------------: | -------------: | --------: | -------------: | ----: |
| Sprint 1          |                    0 |             2 |             13 |         3 |             12 |    30 |
| Future (excluded) |                    0 |             0 |              0 |         0 |              5 |     5 |

Complete is an overlapping release measure, not an additional implementation
bucket. I + IP + B + NS = Total.

| Measure                        | Evidence-backed numerator | Percentage |
| ------------------------------ | ------------------------: | ---------: |
| Sprint 1 implementation        |                      2/30 |       6.7% |
| Teammate approval before merge |                      0/30 |       0.0% |
| Merged into mvp                |                      2/30 |       6.7% |
| QA verified                    |                      0/30 |       0.0% |
| Complete delivery              |                      0/30 |       0.0% |

## Sprint 1 task register

Priority: P0 blocks the core slice; P1 required for Sprint 1 acceptance; P2 future
enhancement. All tasks below are Sprint 1. Unless noted, owner is Frontend;
backend dependencies require coordination, not frontend changes to backend code.
E0 means no implementation/verification evidence yet. Dependencies refer to task
IDs, evidence IDs, decision IDs (D), or backend dependency IDs (API).

### Foundation and design

| ID    | Task                                              | Priority | Depends on   | Impl. | Acceptance criteria                                                                                                                                      | Verification/evidence                                                       |
| ----- | ------------------------------------------------- | -------- | ------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| FE-01 | Scaffold and foundational configuration           | P0       | None         | I     | Vite/React/strict TS, Tailwind, router, ESLint/Prettier, scripts, public env example, maintained folders and placeholder shell; backend/Docker untouched | E1-E4/E7; local PASS; PR #8 merged; approval/QA unverified                  |
| FE-02 | Figma screen and state inventory                  | P0       | D1           | IP    | Inventory current lecturer/officer frames, tokens, states and responsive targets; distinguish PRIMARY, REFERENCE, ARCHIVED and provisional frames        | E5 partial; full inventory outstanding                                      |
| FE-03 | Agree frontend/API contract and permission matrix | P0       | FE-02; D2-D8 | B     | Approved mapping for data, errors, drafts, returns, actions, identity, uploads and settlement; document any unsupported UI                               | E6 source inspection only; decisions unresolved                             |
| FE-04 | Full design token and asset foundations           | P1       | FE-02        | I     | Figma palette/type/spacing/radius mapped to semantic tokens; local fonts/assets and correct dimensions; contrast verified                                | E10; accessibility fixes locally validated; review/QA pending               |
| FE-05 | Reusable accessible components                    | P1       | FE-04        | IP    | Buttons, inputs/selects, dialogs, tables, badges, alerts, skeletons, upload and history primitives; disabled/error/focus states                          | E9; core primitives implemented; full task inventory not complete           |
| FE-06 | Production application shell and routing states   | P1       | FE-02, FE-05 | IP    | Responsive lecturer/officer shells, active navigation, breadcrumbs, route errors/not-found and focus behavior match approved designs                     | E9; layout variants implemented; route/error/focus acceptance still pending |

### Identity and lecturer workspace

| ID    | Task                                       | Priority | Depends on                    | Impl. | Acceptance criteria                                                                                                                             | Verification/evidence                                                                        |
| ----- | ------------------------------------------ | -------- | ----------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| FE-07 | Authentication UI and session handling     | P0       | FE-03, FE-06; API1            | IP    | Agreed sign-in, session restoration/expiry, logout and error states; mock identity visibly limited to development; no fictitious production SSO | E13; development memory-only session; production auth/live validation unresolved             |
| FE-08 | Role-based navigation and route protection | P0       | FE-07; D3                     | NS    | Lecturer/HOD/Dean/Exam/Finance/Bursar routes/actions reflect permissions; forbidden routes handled; no reliance on UI as security boundary      | E0; role and department test matrix required                                                 |
| FE-09 | Lecturer dashboard                         | P1       | FE-08, FE-26; API4            | NS    | Relevant summary and recent applications use real data; loading/error/empty states; no fabricated metrics                                       | E0; design/data mapping and browser checks required                                          |
| FE-10 | My Applications list and discovery         | P1       | FE-08, FE-26; API4, D5        | IP    | Own applications, supported pagination/filtering/search, accessible links and status; private reference title only if agreed                    | E14-E15; paginated GET and mocked list states tested; live ownership/draft discovery pending |
| FE-11 | Save, list and resume drafts               | P0       | FE-12, FE-13, FE-26; API2, D4 | NS    | Save intended partial data, reopen same draft, retain values between steps; clear unsaved/error states; no unintended submit                    | E0; reload and existing-draft update tests                                                   |

### Four-step Paper Setting & Marking form

| ID    | Task                                       | Priority | Depends on              | Impl. | Acceptance criteria                                                                                                                                                                                                              | Verification/evidence                                                                          |
| ----- | ------------------------------------------ | -------- | ----------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| FE-12 | Step 1: Personal & Application Information | P0       | FE-03, FE-05, FE-07; D5 | IP    | Authorized staff name/designation/department/ID; agreed editability and optional private title; step validation and persisted navigation                                                                                         | E11; local fields/errors/navigation pass; authoritative identity and persistence missing       |
| FE-13 | Step 2: Examination & Payment Details      | P0       | FE-12; API2, D2         | IP    | Academic year/semester/degree/course/exam/examiner details; per-paper grouped setting/moderation/translation, marking, assessment and second-marking scope agreed; approved rates and LKR estimates; server totals authoritative | E11; editable rows and validation pass; estimates unavailable and backend row contract blocked |
| FE-14 | Step 3: Supporting Documents               | P0       | FE-13; API3, D6         | B     | Agreed upload API, PDF/PNG types, size/count limits, required evidence, progress/failure/retry/remove/preview and safe document access                                                                                           | E11; local file selection/removal validated; uploads/downloads remain blocked                  |
| FE-15 | Step 4: Review & Declaration               | P0       | FE-12, FE-13, FE-14; D5 | IP    | Read-only summaries of all steps and evidence; back/edit preserves data; declaration required before submission                                                                                                                  | E11; local summaries/declaration reset pass; save/submit deliberately disabled                 |
| FE-16 | Submit application and confirmation        | P0       | FE-11, FE-15; API2      | NS    | Promote existing draft or submit agreed payload once; handle validation/retry; show server tracking code and canonical amount; open request detail                                                                               | E0; live create/submit/double-click tests                                                      |

### Tracking, correction and officer screens

| ID    | Task                                    | Priority | Depends on                    | Impl. | Acceptance criteria                                                                                                                                             | Verification/evidence                                                                                      |
| ----- | --------------------------------------- | -------- | ----------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| FE-17 | Request detail and status header        | P0       | FE-16, FE-26; API2, API4      | IP    | Code/type/title/submission time/status and current reviewer from server; all request statuses incl. APPROVED/REJECTED/SETTLED mapped without conflating them    | E14-E15; detail route/basic status fixture tested; all status/live response checks remain                  |
| FE-18 | Workflow stepper and timeline           | P0       | FE-17; API4                   | IP    | Data-driven six-stage sequence; completed/active/future/returned distinct with text/icons; desktop horizontal and mobile vertical; prior approvals retained     | E14-E15; current-stage adapter/active-stage fixture tested; six-stage and populated browser checks pending |
| FE-19 | Approval and audit history              | P0       | FE-17; API4                   | IP    | Chronological immutable event display with actor/role/action/time/comments and available diffs; accessible expand/collapse; no audit editing                    | E14-E15; event/diff rendering and empty-comment contract tested; ordering/live response pending            |
| FE-20 | Correction detail and permitted editing | P0       | FE-17, FE-19; D3, D5          | NS    | Returning reviewer/reason prominent; correction sections/fields follow agreed permissions; retain existing documents and approvals                              | E0; returned-by-HOD/Exam/Finance scenarios                                                                 |
| FE-21 | Review and resubmit corrections         | P0       | FE-20, FE-15; API5            | NS    | Review corrected values and reconfirm declaration; resubmit to same returning officer/stage; no replay of approved stages; refresh history                      | E0; Exam/Finance direct-resubmission E2E evidence required                                                 |
| FE-22 | Officer work queues                     | P0       | FE-08, FE-26; API4            | NS    | HOD/Dean/Exam/Finance/Bursar queues and request links; correct department/faculty scope; loading/error/empty and supported pagination                           | E0; all reviewer roles and forbidden-scope cases                                                           |
| FE-23 | Officer detail and review actions | P0 | FE-22, FE-17, FE-19; API5, D3 | I | Read-only claim/evidence review; approved role/stage actions only; required return comments and valid target; confirmation, pending and failure states | Source-verified against merged PR #31; 31 focused mocked tests pass; no live mutation test |
| FE-24 | Finance/Bursar settlement visibility    | P0       | FE-23, FE-18; API5, D8        | NS    | Distinguish finance payout authorization from Bursar settlement; show server amount/status and available settlement history; no claim of payment before SETTLED | E0; full six-stage forward path and settled read-only view                                                 |
| FE-25 | Direct link/query UI                    | P1       | FE-17; API5, D7               | B     | Lecturer-to-Exam/Finance clarification behavior, recipient, thread/history and permissions agreed; querying does not change active approval stage               | E0; DIRECT_QUERY exists, conversation contract unresolved                                                  |

### Integration and release quality

| ID    | Task                                             | Priority | Depends on                        | Impl. | Acceptance criteria                                                                                                                                                         | Verification/evidence                                                       |
| ----- | ------------------------------------------------ | -------- | --------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| FE-26 | Typed API and shared data-state integration      | P0       | FE-03, FE-07; API1-API5           | IP    | Typed verified DTO mapping, base URL, auth/error handling, cancellation, safe retries and refresh after mutations; accessible loading/retry/empty states                    | E13; profile/circular reads implemented; live authenticated GETs unverified |
| FE-27 | Accessibility, responsive and Figma audit        | P1       | FE-04 through FE-25 as delivered  | NS    | WCAG 2.1 AA checks; keyboard/screen reader/focus/contrast; reduced motion; form/table/mobile layouts; screenshots matched to approved frames                                | E0; 390px scaffold check is not full accessibility QA                       |
| FE-28 | Automated frontend and security regression suite | P0       | FE-13, FE-18, FE-21, FE-23, FE-26 | IP    | Component/integration/E2E tests for claims, totals, draft recovery, all stage actions, returns, IDOR/role boundaries and failure cases; agreed coverage measured            | E17; 97 local tests; live workflow/security integration remains outstanding |
| FE-29 | CI and reproducible frontend delivery checks     | P1       | FE-01, FE-28; D9                  | NS    | npm ci, lint, type-check, build, formatting and appropriate tests required on PRs; lockfile/runtime verified; hosting fallback and env documented                           | E0; existing CI lacks frontend test/format steps and permits some failures  |
| FE-30 | Integrated QA, UAT and Sprint 1 handoff          | P0       | FE-09 through FE-29               | NS    | Live backend six-role journey and failure/return paths verified; teammate and PR approvals, passing CI and mvp merges recorded; QA/UAT sign-off and known issues documented | E0; no frontend QA/UAT or merge evidence                                    |

## Gate ledger

Each ID must retain its own gate values when it changes. The grouped defaults
below apply individually, not as a combined approval. Expand ranges as work moves.

| Task IDs                                                                  | Local verification                         | Teammate review     | Git                                    | Formal PR                                                 | CI                                    | QA         |
| ------------------------------------------------------------------------- | ------------------------------------------ | ------------------- | -------------------------------------- | --------------------------------------------------------- | ------------------------------------- | ---------- |
| FE-01                                                                     | PASS, E2-E4/E7                             | UNVERIFIED          | PUSHED, 101184c                        | MERGED, [#8](https://github.com/jayasahan/UTAAS/pull/8)   | UNVERIFIED                            | UNVERIFIED |
| FE-02                                                                     | PARTIAL, E5                                | PENDING             | UNCOMMITTED                            | NOT OPENED                                                | NOT RUN                               | NOT RUN    |
| FE-03, FE-08/FE-09, FE-11, FE-16, FE-20 through FE-25, FE-27, FE-29/FE-30 | NOT RUN                                    | PENDING             | UNCOMMITTED                            | NOT OPENED                                                | NOT RUN                               | NOT RUN    |
| FE-04                                                                     | PASS, E10                                  | UNVERIFIED          | PUSHED, ab47148                        | MERGED, [#9](https://github.com/jayasahan/UTAAS/pull/9)   | UNVERIFIED                            | NOT RUN    |
| FE-05/FE-06                                                               | PARTIAL, E9/E10                            | UNVERIFIED          | PUSHED, ab47148                        | Partial scope merged in #9; full tasks remain IP          | UNVERIFIED                            | NOT RUN    |
| FE-12/FE-13/FE-14/FE-15/FE-28                                             | PARTIAL, E11/E12/E13                       | PENDING for Phase 3 | Phase 1 PUSHED b5e2689; Phase 2 MERGED | UI scope MERGED #10; Phase 2 MERGED #12                   | PR checks unavailable; local E13 pass | NOT RUN    |
| FE-07/FE-26                                                               | PARTIAL, E13                               | PENDING             | MERGED via #12                         | MERGED, [#12](https://github.com/jayasahan/UTAAS/pull/12) | No reported checks; local E13 pass    | UNVERIFIED |
| FE-10/FE-17/FE-18/FE-19                                                   | PARTIAL, E14-E15 mocked/browser scope only | PENDING             | LOCAL, UNCOMMITTED                     | NOT OPENED                                                | NOT RUN                               | UNVERIFIED |

Merged percentage counts fully implemented tasks FE-01 and FE-04; merging partial
UI scope does not mark the remaining integrated tasks as merged/complete.

## Evidence register

| ID  | Evidence and limits                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0  | No evidence supplied. Never treat planned acceptance criteria as a passed test.                                                                                                                                                                                                                                                                                                                                                 |
| E1  | Source inspected 2026-10-21: [package/scripts](../package.json), [app TS](../tsconfig.app.json), [Vite TS](../tsconfig.node.json), [Vite plugins](../vite.config.ts), [ESLint](../eslint.config.js), [Prettier](../.prettierrc.json), [env example](../.env.example), [router](../src/App.tsx), [shell](../src/components/layout/AppLayout.tsx), [styles](../src/styles/globals.css). Source exists; pages remain placeholders. |
| E2  | Earlier scaffold implementation session on 2026-10-21: npm run type-check (also executed by build), npm run build, npm run lint and npm run format:check passed. Vite build required elevation after sandbox EPERM/realpath errors. Node v25.2.1/npm 11.8.0 recorded then. Historical tool results are in this chat, not committed CI artifacts; no new execution claimed by this documentation task.                           |
| E3  | Earlier Playwright smoke check: /, /requests, /requests/new, /requests/example and /missing rendered expected headings; 390px viewport/document width both 390; Inter and surface color applied. Missing favicon request was corrected and final build passed. No full visual/a11y/workflow suite; no teammate QA sign-off.                                                                                                     |
| E4  | Earlier npm installation reported zero vulnerabilities. This is historical install output, not a fresh audit or proof of future security. Generated dist exists locally, but build output alone cannot prove a current test passed.                                                                                                                                                                                             |
| E5  | Earlier Figma MCP inspection identified lecturer page 1:6, current four-step form and shared detail/review frames. Screenshots/context retrieved for 39:48, 42:110, 67:2 and 27:2. Foundations, complete officer inventory, mobile variants and formal fidelity sign-off remain outstanding.                                                                                                                                    |
| E6  | Current repository source inspection: NestJS auth, claim, workflow and tracking controllers/DTOs exist. Backend progress tracker reports completion, but no backend tests or live API calls were run for this documentation task. This is not frontend integration evidence.                                                                                                                                                    |

Future evidence must include task ID, date/timezone, human tester/reviewer,
revision or exact uncommitted scope, command/scenario, result, and artifact link.
Do not put personal claims, credentials, tokens or private attachments in evidence.

## Figma screen coverage

| Area                                  | Reference / intended scope                                                                                          | Current state                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Foundations / components              | Pages 1:2 and 1:3; patterns 1:4                                                                                     | Full inventory pending FE-02/04/05                        |
| Lecturer dashboard / selection / list | 3:109, 3:141, 37:2; restrict functionality to Sprint 1                                                              | Placeholders only                                         |
| Claim steps 1 / 2 / 3                 | PRIMARY 39:48 / 42:110 / 42:154                                                                                     | Phase 1 local UI implemented; integration blocked, E11    |
| Review / declaration                  | PRIMARY shared 67:2, adapted to paper marking                                                                       | Local summaries/edit/declaration; submit unavailable, E11 |
| Detail / correction                   | PRIMARY shared 67:50                                                                                                | Not implemented                                           |
| Tracking / history                    | 27:47 normal; 27:2 returned; general-reimbursement examples need six-stage paper-marking data                       | Not implemented                                           |
| Authentication                        | 6:170 is provisional                                                                                                | Decision and current context needed                       |
| Officer workspaces                    | Page 1:7: locate current HOD, Dean, Exam, Finance, Bursar queue/detail/action frames via MCP; do not guess node IDs | Inventory and implementation pending                      |
| States / handoff / print              | Pages 1:9 / 1:11 / 1:8; inspect applicable states; printing future unless scope approved                            | Pending; final rejection 27:95 provisional                |

These IDs reflect the earlier inspection, not a new design version guarantee.
Fetch current high-fidelity context/screenshots before implementing each screen.
Do not implement ARCHIVED v1.0 or REFERENCE Step 4 in place of current PRIMARY
screens. Figma sample data/rates are not approved backend rules.

## Backend dependency register

API paths below are observed in controller source with global prefix `/api/v1`.
All are **source-present, live integration unverified**. These are dependency
observations, not a newly defined contract. Agree response/error shapes first.

| ID   | Observed endpoints/source                                                                                                                               | Frontend dependency / outstanding verification                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| API1 | POST /auth/login; POST /auth/mock-login/:role; GET /auth/me; GET /auth/test-actors                                                                      | Session/token strategy, staff profile completeness and production mock restrictions; FE-07/08/26                                                  |
| API2 | GET /requests/paper-marking/rates/circular; POST /requests/paper-marking/draft and /submit with optional draftId query; GET /requests/paper-marking/:id | Partial draft rules, per-paper data vs aggregate DTO, rates, server totals, submit/update semantics; FE-11 through FE-17                          |
| API3 | supportingDocuments accepts name/url/documentType metadata                                                                                              | No binary upload controller found in inspected request controllers; agree storage/upload/download authorization, limits and errors; FE-14 blocked |
| API4 | GET /requests/my-requests; /pending-queue; /:id/tracking; /:id/history                                                                                  | Pagination/search support, status and timestamps, owner/department access and history ordering; FE-09/10/17/18/19/22                              |
| API5 | POST /requests/:id/actions; enum includes APPROVE, REJECT_RETURN, APPROVE_PAYOUT, DIRECT_QUERY, RESUBMIT, SETTLE                                        | Validate allowed role/stage actions, comments, updatedFormData, targetReturnRole, conflict handling and same-officer resume; FE-21/23/24/25       |

Inspect [backend controllers](../../backend/src/modules/requests/controllers/),
[request DTOs](../../backend/src/modules/requests/dto/),
[auth controller](../../backend/src/modules/auth/auth.controller.ts), and
[backend progress](../../docs/BACKEND_PROGRESS_TRACKER.md) as inputs. Their presence
does not certify live behavior. Backend changes require a separate assigned task.

## Blockers and pending decisions

Proposed decision participants are roles, not assigned reviewers or approvals.
All entries are OPEN; no resolution date is promised.

| ID  | Issue                                                                                                                                                      | Impact                                             | Proposed decision participants / closure evidence                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| D1  | Full current Figma inventory and mobile targets missing; sign-in/rejection provisional                                                                     | FE-02 can continue, fidelity acceptance pending    | Frontend + design/client: agreed frames/version and behavior                                                      |
| D2  | Figma per-paper table includes translation/duration/candidate quantities; backend DTO has one metadata object and aggregate counts/hours                   | Blocks FE-03; affects FE-13                        | Frontend + Backend + client: approved field mapping, rate basis, multi-paper and translation/second-marking scope |
| D3  | QA guide allows Dean return; frontend rules permit Dean approval only; Exam/Finance return recipient vs lecturer correction and final rejection differ     | Blocks FE-03; affects FE-08/20/23                  | Backend + QA + coordinator: one state/action/role/department matrix; preserve same-officer resubmission           |
| D4  | Required DTO metadata/items may conflict with saving incomplete Step 1 drafts                                                                              | Blocks FE-03 contract acceptance; FE-11 dependency | Backend + Frontend: verified partial-save/update examples and invalid-draft behavior                              |
| D5  | Private reference title, declaration persistence, staff designation/ID and correction-field permissions absent from inspected claim DTO                    | FE-10/12/15/20 require agreement                   | Frontend + Backend + client: profile source, privacy, editability and persistence rules                           |
| D6  | Upload/storage/preview contract missing beyond metadata                                                                                                    | FE-14 blocked                                      | Backend + Frontend: tested upload/download flow and validation/security limits                                    |
| D7  | DIRECT_QUERY action exists but recipient/thread/reply contract is unclear                                                                                  | FE-25 blocked                                      | Backend + Frontend + client: agreed communication scope and example responses                                     |
| D8  | Available settlement timestamp/reference/amount and approved-vs-settled semantics need confirmation                                                        | FE-24 dependency                                   | Backend + Finance/client: verified response fields; no invented payment confirmation                              |
| D9  | Existing CI skips absent directories/scripts, tolerates commit-lint/setup failures, lacks frontend tests/format checks; local Node differs from CI Node 20 | FE-29 acceptance dependency                        | DevOps + QA: required job matrix and supported runtime, fresh CI run; no CI changes in this docs task             |

## Future enhancements (excluded from Sprint 1 percentages)

All future rows: implementation NS, local NOT RUN, teammate PENDING,
Git UNCOMMITTED, PR NOT OPENED, CI NOT RUN, QA NOT RUN; evidence E0.

| ID     | Task                                                         | Priority | Dependencies                                 | Acceptance criteria before delivery                                                    |
| ------ | ------------------------------------------------------------ | -------- | -------------------------------------------- | -------------------------------------------------------------------------------------- |
| FUT-01 | General reimbursement and examination-duty forms             | P2       | FE-30; approved schemas/templates            | Each category's official form, rates, route, evidence and end-to-end tests verified    |
| FUT-02 | Production institutional SSO and expanded profile management | P2       | FE-07; identity provider agreement           | Real identity integration and security/session acceptance; no mock users in production |
| FUT-03 | Notifications, advanced search and reporting                 | P2       | FE-30; notification/search/report APIs       | Permission-scoped, accessible delivery/filtering with agreed channels and metrics      |
| FUT-04 | Official printable/exportable claims                         | P2       | FE-30; verified print templates              | Official paper output, personal-title privacy and financial formatting approved        |
| FUT-05 | Configurable additional workflows and advanced theming       | P2       | FE-30; versioned schemas and design approval | New types rendered without hardcoded chains; agreed modes and regression coverage      |

## Updating this tracker

1. Before coding, select an ID, confirm acceptance criteria/dependencies, record
   scope/branch and actual owner. Use short-lived `feature/`, `chore/`, `test/`,
   `bugfix/`, etc. branches from current `mvp`; never permanent frontend/backend
   branches or development commits on `main`. No branch switch is needed just to
   update this document.
2. Change NS to IP only when work starts. Set B only with a concrete issue,
   owner/decision participant and unblock condition; retain existing evidence.
3. Add source references and local verification results for the actual change.
   Mark I only when task-level local acceptance passes. Record failed checks too.
4. Complete the linked review checklist and request another human team member
   to review the formal GitHub PR. Approval requires a name, date and exact
   reviewed revision; self-review is not teammate approval.
5. After explicit user confirmation, commit with human team attribution and
   Conventional Commits, push the task branch, and open a PR targeting `mvp`.
   Record the actual URL, reviewed SHA and CI links. The current team instruction
   requires approval before merge; it supersedes the earlier pre-push agreement.
   Resolve requested changes and obtain review of the final revision.
6. Record actual mvp merge and separate QA results/revision. Set Complete only
   after all gates pass. Broader release flow remains `mvp` -> `dev` -> `main`.
7. Recalculate summary counts/percentages and add dated change-log evidence.
   Do not mark future work complete because a placeholder route exists.

Per-task update record (copy when work begins):

```text
Task ID / owner / date (Asia/Colombo):
Branch / commit or exact uncommitted files:
Scope / acceptance criteria changes:
Implementation status / blocker ID:
Figma frame/version / API source revision:
Local commands and scenarios / result / evidence links:
Teammate reviewer / date / decision / review record:
Commit / push status:
PR URL / base mvp / reviewed SHA / formal approval:
CI run URL / checked SHA / result:
Merge SHA / date:
QA tester / date / revision / scenarios / result:
Open findings / follow-up IDs:
Complete gate met? (yes/no, evidence):
```

### Change log

| Date       | Change                                                                | Evidence / gate impact                                                                                            |
| ---------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 2026-10-21 | Initial tracker from repository inspection and prior scaffold session | FE-01 implemented/local PASS; FE-02 partial discovery; no approvals, commits, pushes, PRs, merges or QA sign-offs |

## Scaffold PR record (merged; prior snapshot below is historical)

- Workflow update (2026-10-21): user requires teammate approval before merging
  through the formal GitHub PR, superseding the earlier pre-push review rule.
- Scaffold commit: `101184c7ad19d2ae4f9450aed56b101ced5425b3`,
  `chore(frontend): initialize React scaffold`; pushed to `origin/chore/frontend-scaffold`.
- PR: [#8 — chore(frontend): initialize React scaffold](https://github.com/jayasahan/UTAAS/pull/8).
- Verified PR base/head: `mvp` / `chore/frontend-scaffold`; state: MERGED at f9f17d8.
- Reviewer request: `jayasahan` was requested. Reviewer approval: UNVERIFIED; no submitted review in last query.
- E8 (2026-10-21): GitHub PR metadata and review submissions queried;
  head was `101184c7ad19d2ae4f9450aed56b101ced5425b3`, `merged` was false,
  requested reviewers included `jayasahan`, and submitted reviews were empty.
- Git author identity: configured human team account `PrabodhaRanawaka`; no
  identity changes made. This does not change frontend ownership.
- Teammate approval: UNVERIFIED. Merge: MERGED (#8). CI: UNVERIFIED. QA: UNVERIFIED.
  CI was not checked in this documentation update; no passing result is claimed.
- E7 (2026-10-21): fresh `npm run lint`, `npm run type-check`,
  `npm run format:check` and `npm run build` passed during PR preparation.
  Production build ran outside the Windows sandbox due to its known Vite
  realpath restriction. These are local checks, not teammate or CI approval.
- Scope: frontend foundation and tracking documentation only. No business
  workflows, API integration or automated frontend test suite implemented.
- The PR #8 tracking update was included as commit 6ac09d7. New design-system work
  will have its own PR to mvp after user confirmation. Approval and QA are separate gates.

### PR tracking update

| Date       | Change                                                             | Evidence / gate impact                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-21 | Record actual PR #8, pushed scaffold commit and requested reviewer | E8 verifies open PR to mvp, jayasahan requested, no submitted reviews and no merge. FE-01 remains I/local PASS; implementation 3.3%, accepted delivery 0.0%. Only this tracker is changed. |

## Design-system implementation evidence (E9, 2026-10-21)

- Branch feature/frontend-design-system equals fetched origin/mvp at base f9f17d8;
  all inspected backend feature tips are already merged. No synchronization needed.
- Tokens, buttons, labelled native form controls, cards, feedback, table primitives,
  request badges, form/workflow steppers, correction banner, controlled dialog and
  lecturer/officer layout variants implemented as presentation-only components.
- FE-04 implemented; FE-05 and FE-06 remain IP because broader task acceptance
  includes additional UI/route-state work. Generic steppers do not complete FE-18
  API-connected workflow tracking. Starter component tests do not complete FE-28.
- Local suite: 19 component tests passed; lint, strict type checking and build
  passed. Initial strict-type/jsdom failures were fixed; tests use an explicit
  jsdom modal adapter and browser checks verify actual native behavior.
- Browser: lecturer/officer specimens at 1440/768/390px had no page overflow;
  form indicator 4/2/1 columns and workflow row/column adaptations observed.
  Dialog focus wrap initially failed; explicit handler fixed forward/backward
  wrap. Escape, focus restoration and skip-link focus passed. Existing five
  routes rendered expected headings, with no page errors in route smoke check.
- Semantic navy/blue/teal/amber/red against white: 13.57/5.17/5.47/5.02/6.47:1.
  These targeted checks are not a full WCAG audit. Screen reader, full cross-browser
  coverage, independent QA, frontend/backend integration and final Figma sign-off
  have not been performed.
- See [component usage and Figma sources](DESIGN_SYSTEM.md) and
  [backend compatibility](BACKEND_COMPATIBILITY.md). Backend ownership restriction
  applies to all future frontend tasks; incompatibilities are documented only.
- Implementation 2/30 = 6.7%; merged 1/30 = 3.3%; accepted delivery 0.0%.
  No design-system commit, push, PR, approval or merge is claimed.

## Design-system review fixes (E10, 2026-10-21)

- FE-04 was reassessed after review found input-boundary/sidebar-focus contrast
  gaps. Those findings were fixed and targeted regression checks pass; FE-04
  remains I/local PASS, not reviewer-approved or independently QA-verified.
- jest-dom pinned 6.9.1, jsdom 28.1.0, Node typings 20.19.43, Rollup override
  4.62.2. All 220 lockfile Node engine declarations accept Node 20.20.2, including
  optional platform dependencies. No backend dependencies or CI config changed.
- Verified prior frontend CI job used Node 20.20.2/npm 10.8.2; exact same versions
  used locally for clean npm ci --engine-strict, tests, lint, strict types and build.
  The clean install/audit reported zero vulnerabilities. Local platform is Windows;
  a Linux CI run of these uncommitted changes is still pending.
- 29 tests pass, covering exact badge labels and semantic variants, native dialog
  close/reopening and duplicate-callback prevention, controlled prop closure,
  actual-token non-text/text contrast, existing controls, navigation and steppers.
  Vitest CSS inclusion is explicit so contrast tests do not read an empty mock.
- Browser checked both layouts at 1440/768/390px: no page overflow; connected
  stages adapt between desktop horizontal and vertical layouts. Native form
  dismissal, Escape and close button all allow reopening and restore trigger
  focus; Tab/Shift+Tab remain trapped. Skip link focus passes.
- Input boundary #64748B has 4.76:1 against white and about 4.55:1 against
  slate-50. Sidebar and active form-step white focus has 13.57:1 against navy;
  blue light-surface focus has 5.17:1 against white. Invalid border stays red
  under hover; disabled controls remain disabled.
- Solid badges follow component specimen 3:77; soft queue badges follow PRIMARY
  60:2. Table header variants use #DDEBEF/#E4EDF1. Connected tracking follows
  PRIMARY 27:47 with the approved desktop horizontal adaptation. See updated
  DESIGN_SYSTEM.md for deliberate readable typography and responsive differences.
- No implementation approval, QA certification, new CI success or backend
  integration success is claimed. Backend findings BC-01 through BC-11 remain
  open and unchanged. No commit/push/PR/merge was performed.

## Claim Phase 1 evidence (E11, 2026-10-21, Asia/Colombo)

Scope: uncommitted files under src/features/paper-marking, NewRequestPage and
frontend documentation, based on ab47148. Verification performed by the coding
agent; no independent human tester/reviewer or QA approval is claimed.

- Fetched origin with prune and confirmed feature/frontend-paper-marking-claim.
  Preserved the prior uncommitted BACKEND_COMPATIBILITY.md assessment. PR #9
  remains OPEN, reviewer jayasahan requested. Design-system branch was untouched.
  No merge/rebase/cherry-pick/commit/push/PR operation occurred in this phase.
- PRIMARY Figma context/screenshots freshly inspected: 39:48, 42:110, 42:154,
  67:2. Four local interactive steps now replace the /requests/new placeholder.
  All other route definitions and shared layouts remain unchanged.
- Personal fields start empty with required/accessibly linked errors; private
  title is local only. Payment state preserves independent rows, paper duration,
  separate setting/moderation/translation/marking/second-marking quantities and
  assessment candidate/hour units. No aggregation into a backend DTO exists.
- Local document selection/removal and summaries implemented; no uploads or URLs.
  Declaration gates local review validation and resets on edits. Save Draft and
  Submit always remain disabled with reasons; no fake success or API calls.
- Node 20.20.2/npm 10.8.2 on Windows: npm test passed 52 tests in 4 files (29
  existing plus 23 claim tests); npm run lint, strict type-check and production
  build passed. Initial label-query/lint failures were fixed before final results.
  Tests cover required fields/errors, four steps, row edits/removal, numeric and
  money boundaries, unsupported calculation rules, local file checks, review,
  declaration reset and disabled persistence. Test rates are fixtures only.
- Playwright in isolated headless Edge at default zoom: all four steps at
  verified CSS widths 390/768/1440px had no document overflow; the
  payment table scrolls within its labelled region, including via ArrowRight.
  Error summary/field links, row add/remove focus, file selection, keyboard Space
  declaration and disabled Save/Submit passed. No page errors or API requests
  were observed during the exercised journey. Screenshots were visually inspected.
  The initial browser harness had 50% zoom; its viewport-only checks were replaced
  by these verified default-zoom checks. ArrowRight moved the table 40px from zero;
  active navy step focus was white with a 2px outline. Declaration reset on editing
  was verified in the same browser journey.
- Intentional visual adaptations: readable/wider table with distinct categories,
  extra required academic fields, explicit local-only notices, unavailable amounts,
  file picker/list and full growing review summaries. See feature README.
- FE-12/13/15/28 now IP; FE-14 remains B despite local selection progress.
  Full identity/persistence/rates/uploads/backend correction contracts remain open.
  Summary: I=2, IP=7, B=3, NS=18; implementation 6.7%, merged 3.3%, delivery 0.0%.
  Review, new CI, independent QA, full screen-reader/cross-browser audit and live
  frontend/backend integration remain unverified. No task is newly marked I.

## Claim Phase 1 review fixes (E12, 2026-10-21, Asia/Colombo)

Scope: uncommitted claim feature files and frontend documentation on
feature/frontend-paper-marking-claim, base ab47148. Existing E11 changes and
historical backend assessment were preserved. PR #9 remains OPEN/unmerged,
review requested from jayasahan. No merge/rebase, commit, push or PR creation.

- Fixed 390px review overflow with explicit one-column grids below sm,
  min-width-zero children and anywhere wrapping. Tests render every editable
  text value intact. In isolated headless Edge, all four steps had exact
  document/viewport widths 390/768/1440 with 200-character unbroken values in all
  eleven text fields, 16-digit numeric entries and a 200-character filename.
  This replaces the review finding where degree programme expanded to 2249px.
- Candidates/Hours changes clear only the affected row's assessment quantity,
  reset declaration and require new unit-appropriate input. Inline revalidation
  does not move focus to the summary. Both directions, already-empty quantities,
  multiple independent rows and fractional candidate rejection are covered.
- Selected document category now lives in feature form state. Back/forward
  navigation, adding differently categorized files and removal preserve the
  selection and each remaining file's assigned category.
- Restored PRIMARY Next steps panel (39:48), feature-scoped slate secondary table
  headers (42:110), numbered teal review markers and wrapping sky review progress
  strip (67:2). Primary blue headers/branding and shared design-system files are
  unchanged. Backward editing in the strip is keyboard accessible. Remaining
  deliberate differences are listed in the feature README.
- Node 20.20.2/npm 10.8.2 on Windows: 68 tests passed in 5 files (16 additional
  regressions). ESLint, strict TypeScript, Prettier checks and the production build
  also passed. Tests include file sizes just below/at/above 10 MiB, exactly 10
  files/rejected eleventh/replacement, supported/unsupported types, retained valid
  files, categories, unit changes, long summaries and existing four-step behavior.
  An initial full-journey test exceeded its 5s timeout; removing artificial typing
  delays allowed the complete suite to pass without increasing the global timeout.
- Browser journey passed: row add/remove, category persistence and assigned labels,
  review summaries, validation-summary focus, declaration checking/unchecking,
  disabled Save/Submit and 40px ArrowRight scrolling. Keyboard ArrowDown/ArrowUp
  unit changes cleared quantity, showed invalid state and retained selector focus.
  Header backgrounds verified #DDEBEF/#F1F5F9; markers 1/2/3 and progress strip
  verified. No page errors or API requests occurred in these scenarios.
- Backend ownership and integration boundary unchanged: no runtime rates, identity
  calls, DTO flattening, uploads, persistence or successful submission claims.
  FE-12/13/15/28 remain IP, FE-14 remains B; task counts/percentages are unchanged.
  Teammate approval, new CI, independent QA and live integration remain unverified.

## Phase 2 development session and authenticated reads (E13, 2026-10-21)

Scope: uncommitted frontend auth/API client, claim read-only data/components,
configuration example, focused tests and documentation on
feature/frontend-paper-marking-integration, based on origin/mvp b0f713d.
Phase 1 PR #10 and design-system PR #9 are merged; their branches were untouched.
No backend/CI/agent/dependency files, commit, push, PR, merge or rebase changes.

- The human approved development-only lecturer sign-in using the existing mock
  endpoint. Runtime authentication obtains a real backend token or fails; no fake
  response, token, identity or rates fallback is used in the application.
- Mock-login POST requires no credentials/body and returns accessToken/user.
  GET /auth/me and /requests/paper-marking/rates/circular require bearer JWT.
  Controllers, profile DTO, guards/strategy and provider/rates services were read;
  contracts and source/runtime distinctions are recorded in BACKEND_COMPATIBILITY.md.
- JWT stays in a private React ref, with logout/expiry/401/unmount clearing,
  cancelled requests and no storage/cookies/logging/UI exposure. Reload does not
  restore a session. Development module is conditionally imported only under DEV.
  Production authentication is explicitly unavailable, without authenticated reads.
- Validated profile data fills untouched fullName and returned department code.
  Designation/staff ID are never invented or autofilled. Manual edits, including
  intentional blanks, survive delayed responses and logout; untouched autofills
  clear when authentication disappears. Late responses after logout are ignored.
- Actual circular rates/labels/units are displayed as reference data only. The
  endpoint has no currency/effective-date fields; multi-paper mapping, translation
  and candidate calculations remain unresolved. Estimates stay unavailable and
  no aggregate DTO is fabricated. Save Draft/Submit/uploads/resubmission stay blocked.
- Node 20.20.2/npm 10.8.2: 91 tests pass in 7 files (23 new API/auth tests plus
  the 68 previous tests). ESLint, strict TypeScript, Prettier and production build
  passed. A build retry hit Windows ENOTEMPTY while preview was running; stopping
  preview/dev servers and rebuilding passed without source changes. Mocked tests
  cover request headers, status/network/config/
  contract errors, loading, successful reads, retries, expiry, logout, reload,
  cancellation/late results, user-edit preservation, nullable staff fields and
  unsupported rate units. These are not real-backend integration passes.
- Initial testing-library option type errors were corrected. Two long Phase 1
  journeys timed out under the expanded suite; their fixture setup now uses change
  events instead of per-character typing. Interaction assertions and original
  timeouts remain; the full suite then passed.
- Production JS was searched for the mock-login endpoint, development login labels,
  provider name and mock-session fixture marker: all absent. Isolated headless Edge
  production preview showed no login bar/button, zero API requests, unavailable
  authentication, disabled Save Draft, no page errors and no overflow at 390px.
- Development browser verified a real connection failure against localhost:4000,
  sanitized network feedback and enabled retry, with no overflow at 390/768/1440px.
  The backend was not listening; no backend/database was started or mutated, no
  real JWT was obtained, and live authenticated GET success remains UNVERIFIED.
- FE-07 and FE-26 become IP. Summary I=2, IP=9, B=3, NS=16; implementation 6.7%,
  fully implemented tasks merged 6.7%, delivery 0.0%. No new task is I/Complete;
  Phase 2 independent review, CI, QA and live integration remain unverified.
- Resumed verification (2026-10-21): existing implementation was preserved.
  Default parallel Vitest failed to start its workers before any tests ran;
  `npm run test -- --maxWorkers=1` then passed all 91 tests in 7 files.
  ESLint, strict TypeScript, Prettier and production build passed again on Node 20.
  Production bundle markers remained absent. A fresh localhost:4000 probe failed
  to connect; live authenticated integration remains unverified.

## Authenticated lecturer request reads (E14, 2026-10-21)

On `feature/frontend-request-tracking`, replaced the My Applications
and Request Details placeholders with authenticated read-only integrations for
the paginated applicant list, claim detail, tracking timeline and audit history.
The API client now accepts typed query parameters. Response decoders validate
documented fields; page state handles loading, error, retry and empty results.
Request identifiers are UUID-validated before requests. Server LKR totals and
workflow status are displayed as returned. No draft, submission, upload or
workflow mutation is enabled.

Strict TypeScript, ESLint, Prettier and production build pass. No automated tests
or browser checks were run for E14. No live backend response has been verified;
the Phase 2 localhost probe had failed to connect. User ownership and HOD scope
remain enforced by backend endpoints. This implementation is local and
uncommitted; teammate review, CI and QA are pending.

## Request reads: tests and responsive check (E15, 2026-10-21)

The read-only work began as uncommitted Phase 3 work on
`feature/frontend-paper-marking-persistence`; origin was fetched with prune and
confirmed the branch remains based on latest `origin/mvp` at `e1c3f7e`. No
commit, rebase, merge or push occurred. The backend source revision is unchanged;
no backend, CI or agent files were changed.

Added five mocked request-page tests for authenticated list query/bearer header,
detail plus tracking/history reads, invalid UUID call prevention, sanitized 401
feedback and an empty list. The detail view now uses the request type returned by
tracking rather than a hardcoded Paper Marking label, and audit history renders
backend-provided field differences in a keyboard-operable disclosure. Tests
also verify the request type and a sample field diff. These tests uncovered a
history decoder bug: an empty string comment is valid display data, but the
shared non-empty text decoder rejected it. Comments now accept empty strings
while other required text fields remain strict. Fixture responses do not verify
live server behavior.

Node 20.20.2 validation: 96 tests pass in 8 files; ESLint, strict TypeScript,
Prettier check and production build pass. Browser viewport checks on the signed-
out `/requests` route found no horizontal document overflow at CSS widths 390,
768 and 1440px. This checks shell/unavailable states only; authenticated
content, the populated table and timeline were not browser-tested. The local
backend probe at `127.0.0.1:4000` returned unavailable, so live API integration
remains unverified. Independent QA, CI and reviewer approval remain unverified.
Phase 3 persistence blockers BC-01 to BC-04 and save/submit/upload restrictions
remain unchanged.

Task status update: FE-10/17/18/19 are IP with limited evidence; FE-28 has 96
local tests but remains incomplete for mutation, role/security and live
integration scenarios. Counts: I=2, IP=13, B=3, NS=12 of 30 tasks;
implementation 6.7% (`I` only), merged 6.7%, accepted delivery 0.0%.

## Request-tracking separation and validation (E17, 2026-10-21)

Separated only authenticated request list, detail, tracking and history reads
onto `feature/frontend-request-tracking` from `origin/mvp` at `e1c3f7e` in an
independent worktree. The original persistence checkout and its uncommitted
course fields, documentation and other work remain untouched. The audit decoder
now accepts a null previous status allowed by the backend entity, and empty
stage comments, showing “Initial state” when there is no previous status.
Regression cases cover nullable audit status, empty stage comments and pagination with mocked responses; they are not live backend evidence.

Node 20 validation in this worktree: Vitest 97/97 tests passed across 8 files;
ESLint, strict TypeScript, changed-file Prettier and production build passed.
The checkout-wide Prettier command reported 60 unchanged files because Git
checked them out with CRLF line endings; the same checkout passed Prettier with
`--end-of-line auto`, and changed files passed the repository's normal check.
A production-preview browser check found no document overflow at CSS widths
390, 768 and 1440px on the signed-out My Requests route. The skip-to-content
link received keyboard focus; an invalid request ID showed the safe fallback.
These checks do not cover populated authenticated pages. The backend was not
listening on 127.0.0.1:4000, so authenticated live GETs remain unverified. Teammate review, PR,
CI and independent QA remain pending. No draft, submit or upload code is included.

## Paper-marking uploads and final submission (E18, 2026-10-21)

Implemented on the isolated `feature/frontend-paper-marking-submission` branch,
based on `origin/mvp` at `dd9a48afd1350fc40c15df2b3f94db9521f4eded`. This adds
authenticated multipart uploads and final claim submission to the existing
four-step Paper Setting & Marking workflow. Uploaded files stay visibly pending
until a matching server response is decoded; removal of an uploaded reference
does not imply server-side deletion. Submission preserves every paper row and
document reference, validates the declaration and upload state, guards against
duplicate requests, surfaces sanitized server validation errors, and shows the
tracking number and amount only after a valid `UNDER_REVIEW` response. Final
amounts come from the backend response; estimates use only exact inspected rate
keys and units, with unresolved line items shown as unavailable.

Source inspection covers the merged upload, download and paper-marking submit
contracts. `BACKEND_COMPATIBILITY.md` records the request/response shapes,
authorization observations and integration limits. A local health probe to
`127.0.0.1:4000` was refused, so no live authenticated upload, draft operation,
or submission was tested. Contract tests are mocked evidence only.

Validation in the feature worktree: Vitest 113/113 across 10 files; ESLint,
strict TypeScript, Prettier formatting check (`--end-of-line auto`),
`git diff --check`, and production build passed. Tests cover multipart bearer
requests and sanitized errors, file/response decoding, safe payload mapping,
multi-paper preservation, verified rate units and rounding, document constraints,
upload retry, declaration gating, validation and confirmed-submission handling.
The Node 20 local backend was unavailable. Browser responsive/keyboard checks
were not performed for this phase, and real authenticated integration,
independent review, CI and QA remain pending. No backend, CI or agent files were
changed. Existing persistence checkout remains separate and untouched.

Current status: upload and submit UI/API paths are implemented against inspected
source contracts, but live integration and independent QA are unverified. Draft
save/resume remains implemented from the existing merged feature. Translation
is retained in the request but not priced by the current backend; the estimate
is unavailable when such an unsupported line is present. Backend follow-up
remains for broad non-lecturer document access, durable storage/orphan cleanup,
and official translation pricing. No PR, commit or push was created in this task.

## Read-only officer approval queue (2026-10-21)

Implemented on isolated branch `feature/frontend-officer-queue`, based on latest fetched `origin/mvp` commit `1ab2c26a31ff4c32f3d4b4aaad1aab4783431529`, which contains the merged paper-marking upload/submission work (PR #17). The original persistence checkout was left unchanged.

The officer portal supports the backend's verified development personas (HOD, Dean, Examination Officer, Financial Officer, Assistant Bursar, and Admin), displays the authenticated role and approved scope, and provides an authenticated pending queue with a typed/validated response decoder, accessible table, request-detail link, loading/empty/error/retry states, and page/limit pagination. Lecturer and HOD-without-verified-department access are blocked before queue retrieval. Detail uses the existing read-only Paper Marking request detail route. No approval, rejection, return, or editing actions are included.

Figma reference: current PRIMARY frame `60:2` (“PRIMARY / Shared Officer Approval Queue”). The implementation follows the navy officer shell, institutional header, role/scope banner, pending count, table hierarchy, teal review action and responsive shared table treatment. Search and status/type/date filters, assignment controls, and returned/resubmitted/urgent summary cards are intentionally omitted because the inspected endpoint does not support them. The single displayed pending count is the server's `meta.total`, not a locally inferred number.

Validation evidence: focused tests passed (25 tests across 3 files); the full suite passed 129/129 across 12 files. ESLint, strict TypeScript and production build passed. Full-project Prettier check passed with `--end-of-line auto` after formatting the changed documentation and source files. Browser checks used the signed-out/development-login and unavailable-backend state: the document had no horizontal overflow at CSS viewport widths 390, 768 and 1440, and keyboard Tab reached the labeled development-role selector. The authenticated populated queue was not browser-verified because `127.0.0.1:4000` was unavailable; no live authenticated GET was performed. Mocked tests do not establish live integration. Independent review, CI and QA are pending. No backend, CI or agent files were changed. No commit, push or PR has been created.

## Read-only Officer Claim Review (2026-10-21)

Work is in progress on isolated branch `feature/frontend-officer-claim-review`,
created from `origin/mvp` at `a583ec892de1d3fcafb15028f37021ab85acfb93` and
fast-forwarded to `3cadf234683af423d2741713461a76f06791430c` after backend PR #21
merged. Officer Approval Queue PR #20 remains in the branch history. Existing
worktrees, including the original persistence checkout, were preserved. The
uncommitted feature files were backed up in recoverable stash
`8b798f94cf73fdd5623b205f634f60913e87d831` before the fast-forward and reapplied;
the stash was retained as a backup.
This feature work remains uncommitted and unpushed; no PR has been created.

The queue detail route stops after verifying the authenticated officer profile.
It does not call request detail, tracking, history or document endpoints. PR #21
now fails closed for HOD pending-queue requests when department identity is
missing (issue #18, closed and verified in source), and applies HOD department
matching plus draft privacy to detail/tracking/history. Those read endpoints
still do not verify reviewer access to the current workflow stage: HOD can read
same-department requests at other stages, and other reviewer roles lack a
request-level stage check. Issue #19 is marked closed in GitHub, but this source
re-check identifies remaining scope work. Document downloads remain disabled
because any authenticated non-Lecturer can retrieve a known filename without
request-level authorization. No approval, rejection, correction, editing or
document viewing actions exist.

The reusable read-only view follows the PRIMARY Officer Review hierarchy:
application header, numbered personal and claim sections, distinct Paper
Marking rows, server-returned fee lines and total, supporting-document metadata
without URLs, approval progress, and activity history. It reuses the officer
portal shell, design-system cards, tables, status badge and workflow stepper. A
separate DEVELOPMENT-ONLY route shows clearly labeled fictional fixture data
for visual checks and makes no backend requests. It is not live request data or
an authorization bypass.

Figma source: current PRIMARY frames on page 06 Officer Screens: HOD `56:2`,
Dean `56:83`, Examination Officer `56:162`, Financial Officer `56:241`, and
Assistant Bursar `56:320` in the [UTAAS file](https://www.figma.com/design/BzLWUOHB9HGDnUV6fNGbrG/UTAAS?node-id=56-2).
The shared navy officer shell, institutional header, typography, numbered
review sections, status treatment and workflow/history hierarchy are retained.
Intentional read-only differences: decision/edit controls are omitted; document
links are omitted until authorization is fixed; the claim section shows the
Paper Marking row model (the primary role frames use other claim examples).

Contract tests cover multiple paper rows, document URL stripping, server fee
values, workflow/history, absent optional data, invalid quantities and
mismatched responses. UI tests verify that the production route reads only
`/auth/me` and makes no request-specific calls for officer roles until the
remaining stage/resource authorization is implemented. These mocked tests do
not verify backend authorization at runtime.

Earlier validation on Node 25.2.1: focused review tests passed 8/8; the full
Vitest suite passed 137/137 across 14 files; ESLint, strict TypeScript,
changed-file Prettier and production build passed. Production JavaScript contains none of the
synthetic preview marker, fixture applicant, filename or URL. Playwright tested
the dev-only fixture at CSS widths 390, 768 and 1440: document scroll width
matched each viewport, with wide paper rows contained in the labeled horizontal
scroll region. Keyboard Tab reached the development role selector, skip link,
sidebar links and Back to Queue with visible focus outlines. No `/api/` requests
or browser console errors were observed during the preview. The backend port
check for `127.0.0.1:4000` failed; live authenticated detail access remains
unverified and intentionally disabled. Updated validation after PR #21
synchronization on Node 25.2.1: focused review tests passed 14/14 across 2
files; the full suite passed 143/143 across 14 files; ESLint, strict TypeScript,
repository-wide Prettier, production build, and `git diff --check` passed. The
production assets contain none of the selected synthetic fixture markers. A
Playwright preview at CSS viewport widths 390, 768 and 1440 had no document
overflow; keyboard Tab reached the development role selector with a visible
1.6px focus outline. The preview made no `/api/` requests and produced no
browser errors. Independent QA, teammate review, CI, PR and merge remain
pending. No backend, CI or agent files are changed.

## Read-only Officer Review History — 2026-10-21

Created isolated worktree `E:\Academic Works\Sem 05\Software Project\UTAAS-officer-review-history` on
`feature/frontend-officer-review-history` from `origin/mvp` commit
`570db438f0dc60386678b28e8322830f4776364f`. Verified that merge commit
`570db438` includes Officer Claim Review PR #22. Existing worktrees and the
recovery stash were preserved; no existing checkout was switched, reset,
rebased, or modified.

The PRIMARY Figma source is frame `60:81`, “PRIMARY / Shared Officer Review
History” on the Officer Screens page. The production route uses the existing
officer portal shell and renders a safe unavailable state after the shared
`/api/v1/auth/me` role/scope gate. It does not request an officer history list,
request details, tracking, history, or documents because no secure officer-wide
history listing contract exists. Safe navigation to individual requests is
therefore not enabled.

A separate development-only preview follows the Figma summary, search/decision/
department/date controls, decision table, status badges, and expandable history
hierarchy using clearly labeled fictional fixtures. Filters and sample counts
are local-only; they do not call APIs and do not demonstrate production
pagination or backend filter support. The preview route and lazy import are
conditional on `import.meta.env.DEV`.

Automated evidence: focused history tests passed 12/12 across 2 files; the full
Vitest suite passed 155/155 across 16 files. ESLint, strict TypeScript,
production build, `git diff --check`, Prettier on changed TypeScript/TSX files,
and Prettier on the new documentation sections passed. The repository-wide
`format:check` script still reports formatting drift in the two historical
compatibility/progress documents; existing sections were preserved, and the new
sections pass independently. The production bundle contains none of the checked
fixture markers.

Playwright verified the development-only preview at CSS viewport widths 390,
768, and 1440 with no document overflow. Keyboard focus remained visible on the
role selector, sidebar links, filters, and history disclosure; pressing Enter
expanded the fictional history panel. No `/api/` requests or new browser console
errors were recorded. The UI tests use mocked profile responses. No live
authenticated history integration was attempted because the backend has no
secure officer-specific listing contract. Issue #19 is closed on GitHub, but
the missing scoped history listing and reviewer navigation contract remain
backend follow-up items as recorded in `BACKEND_COMPATIBILITY.md`.

Implementation, backend integration, independent review, CI, and QA are tracked
separately: UI is implemented; production history integration is blocked;
automated tests are verified; teammate review, CI, QA, and merge are pending.
No commit, push, or PR was created. Backend, CI, agent files, and other
worktrees were not modified.

## Officer Claim Review live read integration — 2026-10-22

Branch: `feature/frontend-officer-review-integration`, based on
`origin/mvp` at `e5270bed5c9447ed93750552d9c974bf77b3e9aa` (includes merged
backend PR #25 and Officer Review History). GitHub [issue #23](https://github.com/jayasahan/UTAAS/issues/23)
tracks this frontend integration; [PR #25](https://github.com/jayasahan/UTAAS/pull/25)
was verified merged and its authorization implementation/tests were inspected.

Implemented production reads for authenticated Paper Marking details, tracking,
and audit history. Request-specific calls are gated by the existing officer
profile/role/department check and strict UUID validation. The existing decoder
combines the three responses only when their request ID, tracking number, and
status agree. The existing Figma-aligned review view now renders real decoded
data, with loading, missing-data, unauthorized, forbidden, network, invalid
response, and retry states. Authenticated binary downloads are enabled only
for safe filenames supplied by that request detail, through a bearer-auth
binary client; private backend URLs are not displayed. Read-only scope is
preserved.

Validation evidence: focused tests passed 45/45 across Officer Claim Review,
review contract decoding, and API-client binary download tests; the full suite
passed 168/168 across 16 files. ESLint, strict TypeScript, production build,
Prettier on all changed TypeScript/TSX files, and `git diff --check` passed.
The newly appended documentation sections were formatted; a full-file
Prettier check still flags historical formatting in both long-running Markdown
documents. Browser smoke checks of the shared review presentation at CSS
widths 390, 768, and 1440 found no document overflow; keyboard Tab navigation
reached the development sign-in selector and skip link with visible focus.
These checks used the fictional development preview only. No officer-
authenticated local backend session was available (port 4000 was closed), so
live integration remains unverified. Teammate review, CI, QA, commit, push,
and PR are pending. No backend, CI, agent, or tracked files in other worktrees
changed. Playwright generated an untracked console log and page snapshot in the
original persistence checkout; both were left in place. Its pre-existing
uncommitted changes and recovery stash remain intact. This feature is in a
separate worktree.


## Officer Decision UI — initial implementation snapshot (2026-10-22)

Worktree branch: feature/frontend-officer-decision-ui, based on origin/mvp at
6a5f287c4af340b9b1a171371a27125a7caf3a20. FE-23 is now in progress. This
records frontend implementation and mocked verification separately from live
backend integration, independent review, CI, QA, and merge.

The existing Officer Claim Review screen now has a Figma-aligned decision
section. It offers HOD, Dean, and Examination Officer approval as APPROVE;
Financial Officer payout authorization as APPROVE_PAYOUT; and Assistant
Bursar final approval as SETTLE. Each action is gated by authenticated role,
UNDER_REVIEW status, matching request/tracking current stage, IN_PROGRESS
stage status, and the verified next-stage response expectation. The UI does
not offer the backend ADMIN bypass. Approval requires an explicit confirmation
dialog and accepts optional decision comments. Successful responses are
validated against request ID, tracking number, resulting status, and next stage
before the page refreshes.

Return for correction is a PRIMARY-design presentation only. Its section and
explanation fields have frontend validation, but Confirm Return remains
disabled because backend Issue #27 is still open and the current DTO accepts
comments and targets as optional without validated correction routing. HOD
editing is displayed as unavailable because no verified editing contract
exists. No terminal Reject action is offered.

Focused mocked Officer Decision and Claim Review tests pass 25/25 after the
current implementation. Full-suite, lint, strict TypeScript, formatting, build,
responsive/browser, keyboard, and git diff validation are pending final run.
No live authenticated backend mutation was tested. Issue #26 officer-specific
review history listing remains blocked and should be integrated in a separate
feature PR if its endpoint is implemented and source-verified. Teammate review,
CI, QA, commit, push, PR, and merge remain pending.
## Officer Decision UI — merged backend contract update (2026-10-22)

This update supersedes the initial mid-task snapshot above. Latest fetched
origin/mvp is f5953a596aae529f833cdc889f6fb906e2f34024. The feature worktree
remains at 6a5f287c4af340b9b1a171371a27125a7caf3a20 because the user prohibited
merges and rebases. The intervening upstream commits change backend files only.

GitHub issues [#26](https://github.com/jayasahan/UTAAS/issues/26) and
[#27](https://github.com/jayasahan/UTAAS/issues/27) are closed after backend
PRs [#30](https://github.com/jayasahan/UTAAS/pull/30) and
[#31](https://github.com/jayasahan/UTAAS/pull/31) merged. Their source and
tests were inspected in latest origin/mvp; backend tests were not rerun.

The production decision section now maps HOD, Dean, and Examination Officer to
APPROVE, Financial Officer to APPROVE_PAYOUT, and Assistant Bursar to SETTLE.
All require matching authenticated role, UNDER_REVIEW status, request/tracking
stage agreement, and an IN_PROGRESS active stage. The UI excludes the Admin
bypass. Approval is confirmed before submission and its response must match
request ID, tracking number, result status, and next stage before success is
shown.

Return for correction is enabled for HOD, Dean, Examination Officer, and
Financial Officer. The dialog requires a correction section and nonblank
explanation for each item. It sends those entries as a readable comments string
and sends a verified target: HOD is fixed to LECTURER; later-stage reviewers
must explicitly select HOD or LECTURER. The response must confirm the expected
RETURNED_FOR_CORRECTION stage. Assistant Bursar has no return control in the
PRIMARY design. No terminal Reject action is offered.

HOD edit remains disabled. PR #31 permits updatedFormData during HOD approval
and recalculates server fees, but the DTO accepts a generic record and does not
define a field-level allowlist or validated editable-field schema. The frontend
does not send updatedFormData until the permitted fields are specified.

Current evidence: 31/31 focused Officer Decision and Claim Review tests pass
with mocked API responses. Full-suite and final lint/type/build/browser checks
are recorded after this update below. No authenticated backend mutation was
performed. Independent review, CI, QA, commit, push, PR, and merge remain
pending. No backend, CI, or agent files were changed.

### Final verification — 2026-10-22

- Focused Officer Decision and Claim Review tests: 31/31 passed.
- Full frontend suite: 187/187 passed across 17 files with one worker. A
  concurrent run had one transient failure in the unrelated development
  session provider test; that test passed in isolation and the serial full
  run passed.
- ESLint, strict TypeScript, production build, and Prettier checks for changed
  TypeScript/TSX files passed. Whole-file Prettier checks for both Markdown
  trackers still fail; checking the committed `HEAD` versions confirms that
  drift predates this task. Historical content was preserved instead of
  reformatting the full documents.
- `git diff --check` passed.
- Browser smoke checks used only the fictional, inert development preview.
  At CSS viewport widths 390, 768, and 1440, document scroll width did not
  exceed the viewport. Keyboard Tab reached the sign-in control, the skip
  link, and the review's Back to Queue link; the focused link showed a solid
  1.6px blue outline, and Enter on the skip link moved focus to `main-content`.
  The preview deliberately does not execute workflow actions, so this was not
  a live decision-dialog or authenticated workflow test.
- No authenticated backend mutation was tested. Backend PR #31 source and
  tests were inspected but not run. The implementation was committed as
  `06158c2aa1b07abfee938a0b45bdb3c66461595f` and pushed to
  `origin/feature/frontend-officer-decision-ui`. Independent review, CI, QA,
  PR creation, and merge remain pending.

The feature branch was synchronized onto fetched `origin/mvp`
`f5953a596aae529f833cdc889f6fb906e2f34024` after preserving its worktree in a
recoverable stash. The intervening upstream commits changed backend files
only. The working tree contains the seven modified frontend files and three
new frontend decision files listed in the task report; no backend, CI, agent,
or unrelated worktree files changed.
