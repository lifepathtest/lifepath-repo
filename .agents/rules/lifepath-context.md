# Life Path Test — Standing Context

Place at `.agents/rules/lifepath-context.md` in the target repo, or append as a
section to the repo's root `AGENTS.md`. This is a Rule: standing facts that
should be true on every task touching this workspace, not a procedure.

## What this is
A standalone quiz-funnel landing page (`lifepath-test.html` +
`lifepath-test-NOTES.md`) built to test whether a numerology/astrology
category converts at least as well as the existing IQ-test funnel
(iq-test.icu) before committing engineering time to a full report-generation
backend. Research ranked astrology/numerology #1 by ICE score (576) against
love-compatibility (#2, 504) and AI face-rating (#3, 210 — staged last on
compliance and market-saturation grounds).

## Current state (verified, not assumed)
- Single static HTML/CSS/JS file. No backend, no Supabase, no Stripe API
  integration — deliberate MVP scope, not an oversight.
- Numerology math (Life Path Number + optional Expression Number, Pythagorean
  method) is implemented and unit-verified: cross-checked against known
  worked examples plus a full 366-day sweep, 0 invalid outputs (every result
  lands in {1-9, 11, 22, 33}).
- Pricing mirrors iq-test.icu exactly — $1.99 / $3.99 / $6.99 — for a
  controlled comparison. Do not change these tiers without also revising the
  comparison methodology in the Workflow.
- Twelve original archetype names (not real people) stand in for
  iq-test.icu's historical-figure match — zero citation/copyright exposure.

## Non-negotiables for any agent touching this workspace
- No placeholder logic, no `// TODO`, no invented Stripe keys or endpoints.
- No hardcoded secrets in the static file. Stripe Payment Link URLs are
  configuration, not secrets, and are the only external references this file
  makes.
- Any change to the numerology functions requires re-running the numerology
  unit test and confirming 0 invalid outputs before shipping.
- Do not build report generation, Supabase persistence, or Stripe
  API/webhook integration as part of this test phase. That is explicitly out
  of scope until the 2-week test clears the decision gate defined in the
  Workflow — building it earlier defeats the purpose of running a cheap test.

## Open items — UNCERTAIN, do not silently assume
- Target repo and production domain for deployment: not yet specified.
- Three Stripe Payment Link URLs: not yet created or configured.
- Analytics vendor: not yet chosen. `window.dispatchEvent` custom events
  (`lifepath:quiz_viewed`, `lifepath:free_result_shown`,
  `lifepath:tier_button_clicked`) are the wiring point — do not assume GA4,
  Plausible, or any specific vendor without confirmation.
- iq-test.icu's actual baseline conversion numbers: not available in this
  workspace. The decision gate in the Workflow cannot be evaluated without
  them.

## Related files
- `lifepath-test.html` — the page itself
- `lifepath-test-NOTES.md` — original config/deployment notes
- `.agents/workflows/lifepath-launch.md` — the execution contract for
  shipping and evaluating this test
