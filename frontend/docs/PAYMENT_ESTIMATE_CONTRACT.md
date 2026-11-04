# Payment estimate compatibility

Branch: `bugfix/frontend-payment-estimate-contract`  
PR target: `mvp`  
Inspected backend/base: `019879bb2ae1261d53d23510ab4108c0ba5585c8`

## Root cause and verified contract

`GET /api/v1/requests/paper-marking/rates/circular` delegates to
`FeeCalculationService.getApprovedRates()`. The previous adapter required every
old rate key and exact old unit before estimating anything. In this revision:

- `CANDIDATE_ASSESSMENT` is absent from the response.
- `PRACTICAL_ASSESSMENT` is published as `per script / candidate`, not `per hour`.
- The backend charges candidate quantities through that practical-assessment fee
  line when there are no positive aggregate hours.
- Translation is explicitly published at zero. Absence and a published zero are
  different cases.
- A missing or unsupported unused fee rate should not prevent estimates for
  other supported items.

The new adapter validates each supported line independently:

| Circular key           | Required unit            | Frontend estimate                                  |
| ---------------------- | ------------------------ | -------------------------------------------------- |
| `PAPER_SETTING`        | `per paper`              | Standard paper-setting count                       |
| `PAPER_MODERATION`     | `per paper`              | Moderation count                                   |
| `PAPER_TRANSLATION`    | `per paper`              | Translation count, including an explicit zero rate |
| `SCRIPT_MARKING`       | `per script`             | Scripts marked                                     |
| `SECOND_MARKING`       | `per script`             | Scripts second-marked                              |
| `PRACTICAL_ASSESSMENT` | `per script / candidate` | Candidate assessment count                         |

Missing/unsupported rates stay `null`. A zero quantity contributes zero without
requiring a rate; a positive quantity with no supported rate makes that component
and the total unavailable. Other component estimates remain visible. No legacy
candidate-key fallback or hourly-rate inference is used.

The wire decoder validates objects, nonempty labels/units, finite nonnegative
money amounts, safe magnitude, and cent precision. Unknown nonempty units and
additional valid rate types remain displayable reference data. They are not
silently assigned to another fee type. Application code contains no rate table;
the snapshot fixture is imported only by tests.

## Calculation and authority boundaries

For supported fields, quantities are aggregated before rounding each fee line
once to two decimal places, then summing. Per-row previews use the same line
calculation on that row. Overflow and invalid quantities yield unavailable values.

Positive hours cannot be estimated from a candidate unit. They leave supported
setting/marking row components visible, while the full total remains unavailable.
The form can still send its existing DTO to the server; this task does not change
submission eligibility or backend payment rules.

Shared-setting/marking metadata, combined-paper configuration, and nonzero typing
data received by the estimator are explicitly unsupported until their calculation
contracts are integrated. They do not receive a partial total disguised as a full
claim estimate. The existing older form restoration/payload model still excludes
newer payment fields; their complete workflow preservation is a separate task.

Draft responses, submitted totals, tracking amounts, and officer fee breakdowns
remain server data. They are never replaced with a local estimate or recomputed
from the displayed circular. Regression tests exercise different local and server
totals and server-only fee lines. Estimate amounts/rates are not added to payloads.

## Backend blockers left unchanged

1. The calculator consumes positive `practicalAssessmentHours` using the practical
   rate even though the circular has no hourly unit. When aggregate hours are
   positive, it chooses hours instead of candidate counts, discarding candidate
   quantities from that fee line. Hour and mixed-unit estimates therefore remain
   unavailable pending a confirmed backend contract.
2. Duration-specific setting constants/options, qualifying/external/MCQ/PG rate
   distinctions, and combined-paper weights are not applied by the inspected
   calculator. The frontend uses the published standard setting rate and states
   that duration does not select a different rate. No new financial policy is
   inferred from the handoff specification.
3. The advertised typing ceiling constant is not applied to its subtotal. Typing
   requires server calculation and a clarified backend allowance contract.
4. Stored aggregate items and row-derived quantities are merged using `Math.max`.
   Old larger totals can survive edits/recalculations. A scalar circular response
   cannot establish the correct treatment; server-confirmed values stay separate.
5. CA, dissertation/thesis, sharing, and other new fee types need their own complete
   form and calculation integration. Their reference rates do not establish UI
   quantity/eligibility rules.
6. The circular does not provide currency/effective-date/version metadata per fee
   rule. LKR is established by the inspected calculation result, not invented from
   an unfamiliar rate label. Live endpoint and deployment behavior remain untested.

No backend files, rate values, dependency manifests, authentication flows, or
shared branches were changed. Task 1's academic dropdown commit is not merged in
this base and is not included in this task branch.

## Files and verification

- `src/auth/contracts.ts`: named circular rate type and money decoding.
- `src/features/paper-marking/estimates.ts`: independent supported-rate mapping,
  partial components, safe aggregation, and unsupported-claim guards.
- `src/features/paper-marking/components/EstimateNotice.tsx`: shared estimate scope
  and limitation presentation.
- `PaymentTable.tsx`, `ReviewStep.tsx`, and `ReadOnlyInformation.tsx` in that same
  components directory: compatible amounts and accurate unit/authority wording.
- `estimates.test.ts`, `estimatePresentation.test.tsx`, `validation.test.ts`, and
  `PaperMarkingClaimPage.test.tsx`: calculation/decoder/presentation regressions
  and existing claim journeys using current test-only circular data.
- `src/test/circularRatesFixture.ts`: snapshot of the current backend contract.
- `src/features/officer-history/OfficerReviewHistory.test.tsx`: the existing
  date-filter preview test pins its clock to the fixture month for reproducibility.
- This document and `FRONTEND_PROGRESS.md`: contract findings and review record.

Exact final command results and pending human-review status are recorded in
`FRONTEND_PROGRESS.md`. Automated API responses are mocked; no live claim or
financial action is executed by these checks.
