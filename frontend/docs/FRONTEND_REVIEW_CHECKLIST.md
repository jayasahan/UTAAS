# UTAAS frontend task review and approval checklist

Use one copied review record per task or clearly enumerated small task group in
[FRONTEND_PROGRESS.md](FRONTEND_PROGRESS.md). Checkboxes below are an unfilled
template, not evidence that checks passed. Mark N/A with a specific reason;
never use N/A to bypass applicable validation or approval gates.

## Required sequence and Git policy

The current team instruction (2026-10-21) requires **review and approval by
another human team member before merging into `mvp`**. It supersedes the earlier
pre-push review agreement. User confirmation is still required before committing,
pushing or creating a PR in this task; confirmation is not reviewer approval.

1. Implement, inspect and validate locally on a short-lived branch from `mvp`.
2. Obtain explicit user confirmation for commit, push and PR creation.
3. Commit the intended scope with the correct human identity and push the branch.
4. Create a formal GitHub PR targeting `mvp`, request a teammate review, and record
   the actual PR URL, head revision and CI results.
5. Resolve findings, revalidate changes, and obtain approval for the final revision.
6. Merge only under repository rules after required approval and passing CI;
   never merge automatically. Record independent QA verification and handoff.

Do not commit directly to `main` or develop on permanent `frontend`/`backend`
branches. Use lowercase kebab-case names such as `chore/frontend-scaffold`,
`feature/paper-marking-form`, `feature/tracking-stepper`, or
`test/paper-marking-e2e`. Keep branches short-lived (guide target: 1-3 days).
Sprint 1 PRs return to `mvp`; release promotion to `dev`/`main` is separate.

Commits follow `<type>(<scope>): <imperative description>`; aim below 50 subject
characters and never exceed 72. Human team attribution is required. Never invite
an AI/bot as a GitHub collaborator. Keep `Agents files/` local and untracked;
never force-add agent files, secrets, node_modules, or generated dist output.

## Review record template

| Field                                            | Value to complete                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Task IDs and title                               | Pending                                                                              |
| Author / frontend owner                          | Pending                                                                              |
| Branch / intended base                           | Pending / mvp                                                                        |
| Scope / files changed                            | Pending; include untracked files explicitly                                          |
| Local snapshot                                   | Pending: commit SHA if any, plus exact uncommitted scope and diff/artifact reference |
| Figma file/frame IDs and design version/date     | Pending                                                                              |
| API/source contract revision                     | Pending or reasoned N/A                                                              |
| Pre-merge reviewer (different human team member) | Unassigned                                                                           |
| Review date/timezone                             | Not reviewed; use Asia/Colombo                                                       |
| Local verification summary                       | Not recorded for this task                                                           |
| Findings / requested changes                     | Not reviewed; do not write "none" before review                                      |
| Pre-merge approval status                        | PENDING                                                                              |
| Approval scope and date                          | None                                                                                 |
| Commit / push status                             | Record actual state only                                                             |
| Formal PR URL / base / reviewed SHA              | None / mvp / none                                                                    |
| Formal reviewer / approval date                  | None                                                                                 |
| CI URLs / checked SHA / results                  | Not run                                                                              |
| Merge SHA / date                                 | Not merged                                                                           |
| QA tester / date / revision / result             | Not verified                                                                         |

Allowed pre-merge states: PENDING, IN REVIEW, CHANGES REQUESTED, APPROVED.
Record blocked findings without inventing a reviewer assignment. Any substantive
post-approval change needs review of the changed scope before merging.

### Current scaffold record (actual state, not an approval)

| Field                      | Recorded state as of 2026-10-21                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| Task                       | FE-01: frontend scaffold                                                                   |
| Branch / base commit       | chore/frontend-scaffold / d0c43fe20cf9b4c1e333f1113199e6f6fb2499e1                         |
| Scope                      | New frontend source/configuration; documentation tracked separately as documentation work  |
| Local verification         | Historical PASS E2-E4 in progress tracker; no fresh application test run in this docs task |
| Reviewer / date            | Unassigned / not reviewed                                                                  |
| Findings                   | Awaiting teammate review                                                                   |
| Approval                   | PENDING                                                                                    |
| Commit / push / PR / merge | None                                                                                       |
| CI / independent QA        | NOT RUN / NOT RUN                                                                          |

## A. Scope and branch review

- [ ] Task ID, ownership, scope, acceptance criteria and dependencies are clear.
- [ ] Current branch/working tree inspected; task based on `mvp` and no unrelated
      backend, Docker, CI or root edits are included without explicit task scope.
- [ ] Review includes untracked source/config files: `git diff` alone omits them.
- [ ] Agent instructions remain local/untracked and are not staged.
- [ ] No secrets, personal claim data, tokens, real attachments or generated output
      enter the diff, screenshots, test fixtures or logs.
- [ ] Lockfile and environment example are included where applicable; all
      `VITE_*` values are treated as public browser data.
- [ ] Implementation does not silently resolve contradictory business rules;
      decisions are linked to approved contract/design evidence.

## B. React and TypeScript quality

- [ ] Strict type checking passes for app and Vite config; no unjustified `any`,
      type assertions, non-null assertions, ts-ignore or lint suppression.
- [ ] Components have focused responsibilities, typed props and stable list keys;
      shared UI belongs in common/layout/tracking/audit as appropriate.
- [ ] Hooks follow React rules; dependencies and cleanup are correct; no stale
      closures, unsafe mutation, unnecessary effects or state duplication.
- [ ] Rendering has no side effects; async work handles cancellation, stale data,
      unmounts and duplicate submissions; retry behavior is deliberate.
- [ ] Router navigation, direct links, parameters, not-found/forbidden states and
      route transitions behave correctly; browser routes are not API contracts.
- [ ] API types reflect verified DTOs; null/optional/error handling is explicit.
- [ ] Lint and Prettier checks pass; filenames/import casing work on Linux CI.
- [ ] New dependencies serve an actual need and fit the existing architecture.

## C. Figma fidelity and responsive behavior

- [ ] Current official Figma context/screenshots are linked; PRIMARY frames used
      rather than archived/reference alternatives; provisional behavior resolved.
- [ ] Tokens, typography, spacing, colors, dimensions and assets match approved
      foundations; static assets bundled locally, not temporary Figma URLs.
- [ ] Lecturer and relevant officer role screens/actions use consistent controls
      and terminology. Sample Figma amounts/names are not production rules/data.
- [ ] Four-step form and separate six-stage approval stepper are not conflated.
- [ ] Desktop/tablet/mobile screenshots and viewport dimensions recorded;
      application has no unintended page overflow; dense table scrolling is usable.
- [ ] Loading, error/retry, empty, pending, disabled and success states are covered
      for data-backed screens; no fake metrics or completed workflow indicators.
- [ ] Displayed APPROVED, REJECTED, RETURNED_FOR_CORRECTION and SETTLED states
      accurately reflect backend semantics and available fields.

## D. Accessibility (WCAG 2.1 AA)

- [ ] Semantic headings/landmarks, labels, instructions and error associations
      are correct; required inputs and validation summaries are announced.
- [ ] Keyboard access, logical tab order, skip link and visible focus work;
      route/dialog focus moves appropriately and returns after dismissal.
- [ ] Stepper uses an ordered structure, meaningful labels and `aria-current`
      where appropriate; icons/colors are not the sole status information.
- [ ] Tables have usable headers/captions; responsive alternatives preserve context.
- [ ] Controls have accessible names; alerts/live regions announce asynchronous
      results without excessive announcements; screen reader check recorded.
- [ ] Text/UI contrast, zoom/reflow and reduced-motion behavior are checked.
- [ ] Automated accessibility results and manual checks are recorded separately;
      a passing scanner alone is not a WCAG conformance claim.

## E. Security, data and workflow correctness

- [ ] UI role checks improve usability; backend still authorizes every request.
      Owner/department boundaries and 401/403 handling are tested appropriately.
- [ ] Session/token storage and expiry follow the agreed identity strategy; logout
      clears relevant state; development role selection is not production auth.
- [ ] Reviewer comments, filenames and diffs render safely as text; HTML is not
      injected from untrusted content; attachment URLs and access follow contract.
- [ ] Form quantities/rates/rounding and totals are validated; frontend estimates
      never override server-calculated amounts or official rate sources.
- [ ] Draft save/resume and submission preserve the same draft where intended;
      errors do not erase entered values or silently duplicate claims.
- [ ] Return/reject reason requirements and action permissions follow the approved
      matrix; no invented Dean return/final rejection capability.
- [ ] Corrections edit only agreed fields; prior documents and approvals remain;
      resubmission returns to the same returning officer/stage.
- [ ] Finance authorization and Assistant Bursar settlement remain distinct;
      UI makes no unsupported claim of payment completion.
- [ ] Audit display is read-only; chronological ordering, actor/role/time/notes
      and available changes are correct; direct queries do not advance approval.
- [ ] Upload limits/types, failure/retry/remove and secure preview/download are
      verified when applicable; attachment metadata is not called a working upload.

## F. Local verification before teammate approval

Run applicable commands from `frontend/`; record actual exit/result and revision.
Do not use `--if-present` to treat an absent required check as success.

```sh
npm ci
npm run type-check
npm run lint
npm run format:check
npm run build
npm audit
```

`npm ci` changes local dependency installation and `build` generates dist; execute
only during an authorized implementation/review validation task. This checklist
does not claim these commands were run during tracker creation. Use
`npm run format:check`, not a repository-wide formatting write during review.

- [ ] Supported Node/npm versions and clean lockfile installation verified.
- [ ] Above applicable commands pass; build includes type checking; warnings
      and sandbox/environment failures recorded honestly with any retry result.
- [ ] Dependency changes reviewed for necessity, compatibility, licenses and
      audit findings; no high/critical vulnerabilities left unresolved for acceptance.
- [ ] Relevant component/integration/E2E tests run with real results and artifacts.
      No frontend test runner/script exists in the initial scaffold: record that
      gap, not "tests passed". Add it under FE-28 before workflow acceptance.
- [ ] Calculation/transition helpers meet the local QA guide's >85% branch-coverage
      target where applicable; backend test counts do not prove frontend coverage.
- [ ] Applicable paths checked: draft/reload, form validation, uploads, submit,
      six-stage review/settlement, HOD/Exam/Finance returns, same-officer resubmit,
      history, direct queries, session expiry and server failures.
- [ ] Browser evidence includes relevant role/department/ownership cases, keyboard
      and responsive checks; fixture/mocked results distinguished from live API tests.
- [ ] Documentation, known issues and progress/gate records match the actual scope.

Verification results template:

| Check / scenario                              | Revision / environment / date | Result (PASS/FAIL/NOT RUN/N/A) | Evidence / reason / follow-up |
| --------------------------------------------- | ----------------------------- | ------------------------------ | ----------------------------- |
| Clean install / runtime                       | Pending                       | NOT RUN                        | Pending                       |
| Type check / lint / formatting / build        | Pending                       | NOT RUN                        | Record separately when run    |
| Dependency/security review                    | Pending                       | NOT RUN                        | Pending                       |
| Automated tests / coverage                    | Pending                       | NOT RUN                        | Pending                       |
| Figma / responsive / keyboard / screen reader | Pending                       | NOT RUN                        | Pending                       |
| Live API / permissions / workflow scenarios   | Pending                       | NOT RUN                        | Pending                       |

## G. Findings and pre-merge approval

| Finding ID | Severity     | File/line or screen/scenario | Finding and requested change | Owner      | Resolution evidence | Reviewer disposition |
| ---------- | ------------ | ---------------------------- | ---------------------------- | ---------- | ------------------- | -------------------- |
| To assign  | Not assessed | Pending                      | Awaiting review              | Unassigned | None                | OPEN                 |

- [ ] Reviewer is another registered human team member, named and dated.
- [ ] Reviewer inspected the actual source, config, lockfile and applicable UI,
      not just a progress percentage or generated screenshot.
- [ ] Blocking findings resolved and verified; non-blocking follow-ups have IDs
      and explicit disposition; do not label unreviewed code "no findings".
- [ ] Approval identifies exact reviewed scope and verification evidence.
- [ ] Author confirms the PR contains only the intended scope.

Approval record:

```text
Pre-merge reviewer / date (Asia/Colombo):
Task IDs / reviewed snapshot / files:
Decision: PENDING | IN REVIEW | CHANGES REQUESTED | APPROVED
Findings resolved / open follow-up IDs:
Verification evidence:
Approval statement and scope (only if actually approved):
```

## H. Formal PR, CI, merge and QA (after user confirmation)

- [ ] Authorized commit uses correct human identity and Conventional Commits;
      pushed commit matches intended scope; changes after approval are re-reviewed before merge.
- [ ] PR targets `mvp`, links task IDs and evidence, and explains behavior,
      validation, limitations and relevant screenshots without personal data.
- [ ] Formal human peer review is recorded against the final PR revision;
      approval is recorded on GitHub for the final revision.
- [ ] All required CI jobs passed on the final revision; PR has no conflicts.
      Inspect actual jobs: current workflow has no frontend test or format step,
      uses optional scripts, and tolerates commit-lint/setup failures. A green
      pipeline alone does not certify missing checks. FE-29 tracks remediation.
- [ ] Relevant existing backend CI remains green for shared integration; frontend
      task does not claim backend behavior solely from backend documentation.
- [ ] Merge performed under branch protection and project squash/rebase policy;
      actual merge SHA/date recorded; no direct main commit.
- [ ] QA verifies the merged revision with live backend where applicable and
      records tester, environment, role, scenarios, artifacts and defects.
- [ ] Sprint 1 UAT/handoff and known issues recorded under FE-30 when applicable.
- [ ] Progress ledger and summary recalculated; Complete used only after every
      required gate passes. Documentation-only/scaffold N/A checks explain scope.

No approvals, commits, pushes, PRs, merges or QA sign-offs are created by filling
the template headings. The current scaffold remains pending teammate review and user confirmation
for commit, push and PR creation. Proposed reviewer: `jayasahan`; not requested.
