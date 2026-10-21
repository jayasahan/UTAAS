# UTAAS design system

Presentation-only React/TypeScript components; no HTTP calls, authentication,
permissions or workflow transitions. Development specimens are available at
`/design-system` and `/design-system/officer` under `npm run dev`. They are not
registered in production routing. Existing application routes remain placeholders.

## Figma sources and approved decisions

File: [UTAAS](https://www.figma.com/design/BzLWUOHB9HGDnUV6fNGbrG/UTAAS?node-id=3-16).
Foundations 3:16, component kit 3:77, lecturer form 39:48/42:110, shared officer
review 56:2, queue 60:2 and return dialog 64:2 were inspected with design context
and screenshots. Use current PRIMARY screens, not ARCHIVED/REFERENCE frames.
Native interactive markup replaces the generated absolute-positioned prototype.

- Navy #12304A, action blue #2563EB, approved teal #0F766E, correction amber
  #B45309, rejected/destructive/critical red #B91C1C, canvas #F1F5F9, white cards.
- Inter 400/600/700 locally bundled; 36px display (approved resolution of the
  specimen's inconsistent 40px label), headings 24px, body 16px, captions 12px.
- Tailwind spacing uses the existing 4px base; preferred steps 4/8/12/16/24/32/48/64.
- Controls use 8px radii, cards 10px. Lecturer/officer sidebars consistently use
  246px/238px desktop variants; header baseline 72px. Below md, navigation wraps
  above content. Four-step form uses 1/2/4 columns; workflow stacks below xl.
- Semantic tokens live in styles/tokens.css; global controls/focus/reduced-motion
  rules live in globals.css. Figma returned no variable definitions for 3:16.
- Approve/return specimen colors were resolved by explicit user approval, not by
  changing Figma. Denser 10px table examples are rendered with readable 14px text.

## Components and usage

| Import path under src/components | Props / behavior                                                                                                                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| common/Button                    | Native button props; variant primary/secondary/success/warning/danger/ghost; default type button; pending disables and sets aria-busy; keep meaningful action text                                          |
| common/FormControls              | Input, Textarea, Select, Checkbox accept native props plus required label, optional hint/error; stable generated IDs; label/description/error associations; use native select options                       |
| common/FormControls: FormField   | Low-level labelled wrapper requires id matching child control; caller must supply aria-describedby/invalid for custom controls                                                                              |
| common/Card                      | Native div props and className; compose headings with logical document hierarchy                                                                                                                            |
| common/Feedback                  | Badge tone neutral/info/success/warning/danger; Alert title and children, polite by default, urgent opts into role alert; Skeleton named loading state; EmptyState optional onRetry                         |
| common/Table                     | Required caption and native table contents; keyboard-focusable overflow region; TableHead allows scope/colSpan/rowSpan for grouped headers; TableCell native td props                                       |
| common/Dialog                    | Controlled open/onClose, title, optional description, children; native showModal, Escape, close button, focus wrapping and native focus restoration; parent updates open; no business confirmation built in |
| tracking/Steppers                | FormStepper steps/currentStepId/optional onStepChange; parent owns validation/navigation. WorkflowStepper accepts display stages, no hardcoded route or stage count                                         |
| tracking/RequestStatusBadge      | RequestDisplayStatus mirrors inspected backend request status values; display only, APPROVED and SETTLED remain distinct labels                                                                             |
| tracking/CorrectionBanner        | reviewer/reason and optional onEdit; escapes text; parent determines permissions and handles edit                                                                                                           |
| layout/AppLayout                 | variant lecturer/officer, optional navigation items and workspaceLabel; composes Sidebar, Header, PageContainer and router Outlet; no role selection or permission checks                                   |

```tsx
<Button variant="warning" onClick={openCorrectionDialog}>Return for correction</Button>
<Input label="Course code" required hint="Use the official code"
  {...(errors.courseCode ? { error: errors.courseCode } : {})} />
<Select label="Semester"><option value="1">Semester 1</option></Select>
<RequestStatusBadge status="RETURNED_FOR_CORRECTION" />
<Dialog open={open} onClose={() => setOpen(false)} title="Correction details">
  <Textarea label="Reason" required />
</Dialog>
```

With exactOptionalPropertyTypes, conditionally spread an optional error prop if
its value may be undefined. Callbacks receive user intent only; they do not
execute backend actions. Workflow display states are completed/active/pending/
returned/rejected; a future verified adapter maps actual API DTOs to these props.
The four form steps and six approval stages are separate concepts.

## Accessibility and validation boundary

Text/icons supplement all statuses. Controls preserve native keyboard behavior,
required/disabled/readOnly attributes, labels and error descriptions. Dialogs
require a parent-controlled open state and an accessible title. Tables retain
semantic headers and captions, with contained scrolling. Reduced motion is respected.
No complete WCAG conformance or screen-reader certification is claimed.

Run `npm test`, `npm run type-check`, `npm run lint`, `npm run format:check`,
and `npm run build` from frontend. jsdom tests stub native modal APIs only;
real-browser checks must verify focus trapping, Escape and restoration. This is
component validation, not authentication/API/workflow integration or independent QA.

See [backend compatibility](BACKEND_COMPATIBILITY.md) before future connected work.

## Review fixes and intentional Figma variants

- Solid request badges follow component specimen 3:77; `appearance="soft"`
  follows PRIMARY officer queue 60:2 (blue #DBEAFE/#1D4ED8 and amber
  #FEF3C7/#92400E). Teal remains approval, amber correction, red rejection.
- Table `variant="claim"` (default) uses #DDEBEF from 42:110;
  `variant="officer"` uses #E4EDF1 from PRIMARY officer queue/review screens.
  Header/body text stays 14px for readability rather than the dense 10px example.
- Workflow stages are connected: vertical below xl, horizontal at xl per the
  approved desktop-first adaptation. PRIMARY 27:47 shows a vertical history
  timeline even on desktop; a complete history feed remains a separate task.
  Connectors supplement explicit state labels/icons and never decide routing.
- Controls deliberately use a stronger #64748B boundary than the light Figma
  fields to meet 3:1 non-text contrast. Light surfaces use blue focus; the navy
  sidebar scopes focus to white. Disabled controls remain visually distinct and
  are exempt from the enabled-control contrast requirement; invalid uses red.
- Dialog native `close` (including form method="dialog") notifies `onClose`
  once; Escape and the close button use that same native path. A parent prop
  close does not notify the parent again. The parent must set open=false.
- Responsive wrapping, readable typography, native select controls and consistent
  sidebar widths are intentional adaptations; no full pixel-perfect or WCAG
  certification is claimed. Review full pages separately during integration.

## Runtime compatibility

CI's frontend job for scaffold commit 6ac09d7 ran Node **20.20.2** and npm
**10.8.2** ([recorded run](https://github.com/jayasahan/UTAAS/actions/runs/39529101805/job/118990626087)).
The workflow selects Node major 20; future patch versions may differ.
Frontend engines now target ^20.20.2, ^22.13.0 or >=24.0.0. Backend dependencies
and CI configuration are unchanged.

- jest-dom is pinned to 6.9.1: 6.10/7 require Node >=22.
- jsdom is pinned to 28.1.0, which supports Node 20.19+ and 22.12+.
- @types/node is aligned to the Node 20 line.
- Rollup override 4.62.2 avoids the Node 22-only optional Linux lzma dependency
  found in 4.64.12; update only after checking all platform engines and audit.
  This is a compatible Rollup 4 patch, not a backend dependency change.
- A strict-engine clean install, 29 component/contrast tests, lint, strict type
  checking, formatting and production build passed locally on Node 20.20.2 and
  npm 10.8.2. All 220 declared dependency engine ranges also accept that Node
  version. Local OS is Windows; Linux CI execution of this uncommitted branch
  remains pending.
