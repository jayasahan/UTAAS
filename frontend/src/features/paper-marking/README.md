# Paper Setting & Marking — Phase 1 UI and Phase 2 read-only integration

Route: `/requests/new`. Existing application routes/layouts remain intact.

## Boundaries

- `model.ts`: editable frontend state, separate personal/academic information,
  independent paper rows and assessment units, local `File` objects, declaration.
  These are not backend DTOs. No serializer to the aggregate backend DTO exists.
- `useClaimForm.ts`: in-memory edits, validation-aware navigation, stable row/file
  identifiers, announcements and declaration reset after edits. Assessment unit
  changes clear the row's quantity and require re-entry with inline validation;
  unrelated rows/fields remain intact. The selected document category lives in
  feature-level state and survives step unmounts independently of each file's category.
- `validation.ts`: required fields, positive paper duration, non-negative integer
  counts/candidates, fractional assessment hours, numeric/money safety and local
  file limits. These frontend rules do not prove server-side enforcement.
- `estimates.ts`: optional future verified-rate input; matches inspected backend
  line rounding for supported categories. No runtime rates are supplied in Phase 1.
  Missing rates, translation or positive candidate assessment yield `null`, rendered
  as Unavailable, including the overall total if any row cannot be estimated.
- Components compose existing design-system controls, tables, cards and buttons.
  Error summaries focus and link to fields; add/remove restores useful focus.

Phase 2 adds DEV-only backend lecturer sign-in and the profile/circular GETs.
The private React session is memory-only, clears on logout/expiry/401/reload and
never exposes credentials in UI, storage, logs or environment configuration.
Production excludes the mock-login module and has no authentication implementation;
its form remains explicitly unavailable for authenticated reads. The API client
uses VITE_API_URL, bearer headers, cookie omission, no-store, no redirects and
sanitized failures. No production responses are simulated.

Only untouched matching fields receive /auth/me name and department code;
designation/staff ID remain blank/editable until manually entered. Edited values,
including deliberate empty edits, are never overwritten by later responses.
Read-only circular labels/rates/units appear with their backend reference, without
invented currency or validity dates. Unknown units are displayed, never converted.
Rates are not yet passed to estimate helpers because multi-paper mapping is not
agreed; all totals remain unavailable. Test fixtures are not runtime fallbacks.

No draft/upload/submit/resubmit requests, uploaded IDs/URLs or fake success states
exist. Save Draft and Submit remain disabled even after declaration acceptance.
Validate local review checks local readiness only. Leaving the route/reloading
loses entries/files; full-page exit warns on edits. SPA navigation is not intercepted.

## Design references and intentional differences

Current PRIMARY Figma: 39:48 (personal), 42:110 (payment table), 42:154 (documents),
67:2 (shared review). ARCHIVED and earlier REFERENCE Step 4 are excluded.

- Keep navy/blue/teal branding, white cards, grouped table headers and four steps.
- Editable identity starts blank; DEV backend profile data fills only untouched
  matching fields. Mock identity and local edits are not production university SSO.
- Add academic fields required by Sprint 1 above the table, including separately
  editable course code and course title; preserve paper titles without treating
  them as course metadata or serializing rows to an aggregate DTO.
- Separate setting, moderation and translation counts; show second-marking and
  explicit candidate/hour units so distinct quantities cannot be silently conflated.
- Use readable labels and horizontally scrollable grouped columns on all widths
  instead of the specimen's compact 10px table text. Existing shell variants and
  accessible stronger input boundaries remain. No pixel-perfect sign-off claimed.
- Amounts display Unavailable rather than Figma sample numbers. Actual authenticated
  reference rates appear separately. No editable rates/amounts are offered.
- Local file picker/list replaces the upload specimen: PDF/PNG/JPEG, 10 MiB per
  file, maximum 10 files, matching extension/MIME, empty/duplicate rejection.
  These are client preparation limits, not a verified server upload policy; MIME
  metadata is not content/security verification. At least one local document is
  required to reach review; final category/evidence rules remain undecided.
- Full summaries grow naturally with paper/document count. Declaration applies
  only to local review; blocked actions have a persistent explanatory message.
- Review summaries use an explicit single-column layout below sm, min-width zero
  children and anywhere wrapping, including long unbroken user values. Step 1
  restores the PRIMARY Next steps panel with honest local-selection wording.
- The feature-scoped secondary table header uses canvas slate #F1F5F9 with ink
  #334155; the primary grouped header retains #DDEBEF/navy. Shared tables are unchanged.
- Review uses the PRIMARY compact sky progress strip with keyboard-accessible
  backward editing and numbered teal section markers. It wraps on narrow screens.
  Existing approved teal tokens are reused; automatic height/readable typography,
  the shared shell and the claim title above the Review & Submit subheading remain
  intentional adaptations. No pixel-perfect or independent accessibility sign-off
  is claimed.

## Verification

Run `npm test`, `npm run lint`, `npm run type-check`, `npm run format:check`, and
`npm run build` from frontend. Unit tests use labelled test-only rate fixtures;
none are injected into production. Browser checks must cover all four steps,
390/768/1440px, keyboard scrolling, error links, file selection, declaration reset
and disabled persistence actions. See docs/FRONTEND_PROGRESS.md evidence E11 and
docs/BACKEND_COMPATIBILITY.md for actual results and remaining integration gates.
