# Life Path test page — what's real, what needs you

## What's fully built and working
- Real numerology math (Life Path Number + optional Expression Number), Pythagorean method, unit-checked against known worked examples and a full-year sweep — every result lands in {1–9, 11, 22, 33}, no invalid outputs.
- Free result is genuinely free — no email wall, matching iq-test.icu's mechanic exactly (this matters for a controlled comparison).
- Same 3-tier structure and price points as iq-test.icu ($1.99 / $3.99 / $6.99) — intentional, so the test is apples-to-apples.
- 12 original archetypes (not real people, no copyright/citation risk) with free one-liners + locked full profile teaser, mirroring the "historical figure match" mechanic.
- Responsive, keyboard-focus-visible, respects `prefers-reduced-motion`.
- Instrumentation hooks (`window.dispatchEvent` custom events: `lifepath:quiz_viewed`, `lifepath:free_result_shown`, `lifepath:tier_button_clicked`) so you can wire GA4/Plausible/PostHog/whatever without me guessing your stack.

## What's deliberately NOT built, and why
**No backend. No report generation. No Supabase, no edge function, no Stripe API integration.**
This is a scope call, not an oversight: the original research recommended a *cheap 2-week test* to see if the category converts before investing build time. Building full report generation first would mean spending the effort the test exists to avoid spending.

## What you must configure before this goes live (3 things)

1. **Three Stripe Payment Links** (Dashboard → Payment Links → one-time payment, one per tier at $1.99 / $3.99 / $6.99). Paste the three URLs into `CONFIG.paymentLinks` near the top of the `<script>` block in `lifepath-test.html`. Until you do, the buttons show an honest "not configured" alert instead of silently failing or faking a redirect.

2. **Two custom fields on each Payment Link**: "Full birth name" and "Birth date." This is how you'll receive what you need to fulfil each report by hand during the test window (concierge-MVP pattern — normal for validating demand before automating). Stripe emails you every purchase with these fields attached.

3. **Deployment target.** This is one static file — deploy it to Cloudflare Pages (or anywhere static) same as the rest of your stack. Before launch, replace the two `<!-- CONFIG -->` comments (canonical/og URL, footer entity line) with the real domain.

## What I could not verify from this session
I don't have access to the iq-test.icu repo, its Supabase schema, or its actual traffic/Stripe numbers — so I can't tell you whether this page's eventual conversion rate is *good* relative to iq-test.icu's, only that the structures are now comparable. That comparison still requires pulling both funnels' real numbers once this has run for a couple of weeks.

## Reading the test
Compare, over the same window, against iq-test.icu:
- Free-result completion rate (form submitted ÷ page views)
- Tier-button click rate (`tier_button_clicked` events ÷ free results shown)
- Paid-conversion rate (Stripe completed payments ÷ tier-button clicks)

If paid-conversion clears iq-test.icu's own rate, the category hypothesis holds and building real report generation is justified. If it doesn't, the bottleneck is traffic/positioning, not category — the original diagnostic question is still open either way.
