# Workflow: Life Path Test — Launch & Evaluate

Trigger: `/lifepath-launch`  
Recommended mode: Fast — single static file, no multi-file coordination, nothing here benefits from parallel agents. If you later add real report-generation, split that into its own workflow rather than extending this one.

## Phase 0 — Preflight
Objective: confirm the environment matches what this workflow assumes.
- Confirm `lifepath-test.html` and `lifepath-test-NOTES.md` are present in the workspace. If not, stop and request them — do not reconstruct either from memory or regenerate the numerology logic from scratch.
- Extract the numerology functions from `lifepath-test.html` and run them against a full 366-day sweep plus the known worked examples in `lifepath-context.md`. Confirm 0 invalid outputs (every result in {1-9, 11, 22, 33}).
- Exit criteria: files present, math re-verified.

## Phase 1 — Configuration (human input required — do not proceed without it)
Objective: resolve the UNCERTAIN items listed in the Rules context.
1. Human creates three Stripe Payment Links (Dashboard → Payment Links → one-time payment): $1.99, $3.99, $6.99.
2. Human adds two custom text fields to each Payment Link: "Full birth name" and "Birth date."
3. Human pastes the three resulting URLs into `CONFIG.paymentLinks` in `lifepath-test.html`.
4. Human confirms the deployment target (Cloudflare Pages project name and production domain).
- Exit criteria: `CONFIG.paymentLinks` has three non-empty URLs; a deployment target is confirmed in writing.
- STOP condition: if any of steps 1–4 is incomplete, output exactly: `UNCERTAIN: Phase 1 configuration incomplete — provide [missing item] before proceeding to Phase 2.` Never fabricate a Payment Link URL or a domain to move forward — that produces a page that looks deployed but isn't wired to anything real.

## Phase 2 — Pre-deploy verification
- Re-run the numerology unit test (repeat of Phase 0 step 2, as a gate immediately before shipping).
- Confirm no secrets are present in the file — search for `sk_live`, `sk_test`, `api_key`; expect zero matches. This file should only ever contain Payment Link URLs, which are not secrets.
- Manually click through all three `.buy` buttons in a local preview and confirm each resolves to its configured Payment Link.
- Confirm responsive layout at 375px and 1440px widths, and confirm `prefers-reduced-motion` disables the reveal animation.
- Exit criteria: all four checks pass. Report any failure as CONFLICT or UNCERTAIN — do not silently patch around a failure in a way that changes scope (e.g., do not add a backend to "fix" a missing Payment Link).

## Phase 3 — Deploy
- Deploy `lifepath-test.html` as a static asset to the confirmed Cloudflare Pages target.
- Replace both `<!-- CONFIG -->` comment placeholders in the file (canonical/og URL, footer entity line) with the real production domain before the first real visitor arrives.
- Exit criteria: page reachable at the production URL over HTTPS.

## Phase 4 — Instrumentation
- Wire the three `lifepath:*` custom events (`quiz_viewed`, `free_result_shown`, `tier_button_clicked`) to whichever analytics tool already instruments `iq-test.icu`. Prefer reusing that tool over introducing a new one — this test's value depends on a like-for-like comparison.
- Confirm all three events fire in the browser console during a manual walkthrough before relying on them for the live run.
- Exit criteria: all three events observed firing during a manual test.

## Phase 5 — Run window
- Run for 14 days from first real traffic, matching duration and — as closely as possible — traffic sources to `iq-test.icu`'s own baseline window.
- Do not change pricing, copy, or the numerology math during the run. Any mid-test change invalidates the comparison in Phase 6.

## Phase 6 — Decision gate
Compare against `iq-test.icu` over the same window:
- Free-result completion rate (form submits ÷ page views)
- Tier-button click rate (`tier_button_clicked` events ÷ free results shown)
- Paid-conversion rate (Stripe completed payments ÷ tier-button clicks)

- GO: paid-conversion rate ≥ `iq-test.icu`'s own rate → the category hypothesis holds; build real report generation next.
- NO-GO: paid-conversion rate below `iq-test.icu`'s → the constraint is traffic or positioning, not category. Do not conclude the category failed — the original open question (is `iq-test.icu`'s own funnel broken?) still stands either way and needs its own investigation.

## Security implications
- No PCI scope touches this workspace's infrastructure — Stripe Payment Links keep all card data on Stripe's hosted checkout.
- The only PII this page ever transmits is what the customer enters directly into Stripe's checkout (email plus the two custom fields) — none of it passes through code in this file.
- No API keys, secrets, or credentials belong in this file at any point. If a later phase adds server-side report generation, that logic belongs in an Edge Function, never in this static file.

## Rollback
- Single static file, no database, no migration. Rollback is redeploying the previous version or removing the Cloudflare Pages deployment — no stateful rollback risk exists at this phase.
