# Dynamic academic dropdowns

- Branch: `feature/frontend-academic-dropdowns`
- PR target: `mvp`
Inspected backend/base: `b4f6062cf1f11433248565bfeb1e81ebe90b574a`

The claim form reads authenticated choices from
`GET /api/v1/requests/paper-marking/options/form-dropdowns`. Academic year,
semester, programme, examination type, examiner role, course code/title, and
each paper's examination duration use the existing native select design system.
No academic catalog is embedded in application code.

## Scope and dependencies

- Queries use the department ID from `/auth/me`, or its department code when an
  ID is unavailable. Editable personal-information fields never scope queries.
  Missing department information and non-lecturer accounts do not request choices.
- The semester query is numeric (1–8); the selected backend label stays unchanged
  in claim metadata. Both `Semester 5` and numeric string `5` can be converted for
  querying, but advancement requires a selection offered by the current catalog.
- The endpoint determines department curriculum rules, including common modules.
  The frontend additionally excludes returned courses for other semesters and
  rejects a conflicting returned `userDepartmentCode`. It does not duplicate
  department-prefix or programme-to-curriculum tables.
- Selecting either course code or title updates both fields atomically. Changing
  year, programme, semester, or the verified profile department clears the course
  and title. Other academic values and payment rows remain intact.
- The backend does not accept year/programme filtering parameters or provide
  programme-to-department mappings, so none are invented by this feature.

## Loading, validation, and draft behavior

Options use the shared authenticated API client and cancellable resource hook.
Changing query scope immediately removes stale options; aborted or late responses
cannot replace the current result. Failures have explicit error/retry states;
empty catalogs have no local fallback.

Restoring a draft does not replace saved academic labels, course titles, paper
durations, or select the first available option. While loading, current values
remain visible. Values absent from current choices remain visible as disabled
current options and can still be saved in a partial draft. They must be replaced
with current choices before advancing or submitting. Mismatched saved course
titles likewise require an explicit course selection.

Validation checks catalog membership, scoped course/title pairing, and each paper
duration at navigation, review, submission, and correction resubmission. The
existing payload contracts remain unchanged: academic metadata uses strings and
`papers[].durationHours` is serialized as a number.

## Backend contract mismatches

1. `PaperMarkingController.getFormDropdownOptions` replaces empty filtered module
   results and module-service errors with `ENGINEERING_COURSE_MODULES`. That
   unfiltered legacy list uses `level`; database-filtered rows use `semester`.
   The decoder recognizes the legacy shape, preserves the other academic options,
   and keeps those courses unselectable with an explicit retry message. Backend
   support should return genuine empty results/errors or an explicit source/
   filtering contract instead of silently replacing them. Until then, course
   selection requires database-backed modules for the selected scope.
2. Department authorization remains a server responsibility. Query parameters and
   frontend guards do not establish backend authorization.
3. Duration options advertise duration-specific rate values, but the existing fee
   calculator still uses a fixed setting rate and the earlier estimate adapter has
   a separate circular-unit mismatch. These financial contracts are unchanged by
   the dropdown task; duration rates are not used to claim a verified estimate.

## Verification and review

Tests cover response decoding, authenticated department scoping, numeric query
parameters, semester filtering, cancellation/late responses, linked course fields,
dependent clearing, duration serialization, draft restoration, unavailable saved
values, API failure/retry, empty results, malformed responses, and legacy fallback
handling. Existing claim, upload/submission, and correction tests use test-only
catalog responses rather than bypassing these controls.

Live API/database behavior, current Figma visual acceptance, independent QA, and
teammate approval are separate from mocked automated tests. No backend files or
dependency manifests were changed. See the task entry in `FRONTEND_PROGRESS.md`
for final command results and review status.

## Changed files

All paths below are relative to `frontend/`.

| File                                                          | Purpose                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/components/common/OptionSelect.tsx`                      | Shared select with visible preserved values.                        |
| `src/features/paper-marking/academicOptions.ts`               | Response types, decoding, semester conversion, choice validation.   |
| `src/features/paper-marking/useAcademicOptions.ts`            | Authenticated, scoped, cancellable catalog loading.                 |
| `src/features/paper-marking/components/InformationStep.tsx`   | Academic and linked course dropdowns.                               |
| `src/features/paper-marking/components/PaymentTable.tsx`      | Per-paper duration dropdown.                                        |
| `src/features/paper-marking/useClaimForm.ts`                  | Atomic course selection and dependent-field clearing.               |
| `src/features/paper-marking/PaperMarkingClaimPage.tsx`        | Integration, department changes, navigation/submission validation.  |
| `src/features/paper-marking/academicOptions.test.ts`          | Decoder and validation tests.                                       |
| `src/features/paper-marking/useAcademicOptions.test.tsx`      | Query scope and stale-response tests.                               |
| `src/features/paper-marking/AcademicDropdowns.test.tsx`       | Form integration, drafts, duration, errors, and dependent clearing. |
| `src/test/academicOptionsFixture.ts`                          | Test-only API catalog.                                              |
| `src/features/paper-marking/PaperMarkingClaimPage.test.tsx`   | Existing journeys adapted to API-backed selects.                    |
| `src/features/paper-marking/PaperMarkingPersistence.test.tsx` | Existing draft tests supply scoped choices.                         |
| `src/features/corrections/CorrectionResubmission.test.tsx`    | Existing correction tests supply scoped choices.                    |
| `src/auth/DevSessionProvider.test.tsx`                        | Expected authenticated dropdown request.                            |
| `src/features/officer-history/OfficerReviewHistory.test.tsx`  | Pin the existing preview date-filter test to its fixture month.     |
| `docs/ACADEMIC_DROPDOWNS.md`                                  | Feature behavior and backend limitations.                           |
| `docs/FRONTEND_PROGRESS.md`                                   | Verification and pending human-review record.                       |
