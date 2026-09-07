# Stripe Live Mode Migration Guide

When you are ready to switch from Stripe Test/Sandbox mode to Live mode to collect real payments, follow this automated procedure:

---

## 1. Prerequisites in Stripe Dashboard
1. Open [dashboard.stripe.com](https://dashboard.stripe.com/) and toggle to **Live mode** (switch out of Sandbox).
2. Ensure Managed Payments or automatic tax is enabled or use the standard digital products tax code (`txcd_10000000`).
3. Create a Restricted API Key (or standard Secret Key) in Live mode with write permissions for:
   - **Products** (Write)
   - **Prices** (Write)
   - **Payment Links** (Write)

---

## 2. One-Command Automated Live Provisioning

Run the turnkey provisioning script with your live key:

```powershell
$env:STRIPE_LIVE_KEY="rk_live_YOUR_ACTUAL_LIVE_KEY_HERE"
node scripts/setup-live-stripe.js
```

### What this script does automatically:
1. Creates the 3 live Stripe products and prices ($1.99, $3.99, $6.99 USD).
2. Attaches the required custom fields (`full_birth_name` and `birth_date`).
3. Generates the 3 live `https://buy.stripe.com/xxxxxx` URLs.
4. Updates `CONFIG.paymentLinks` across `lifepath-test.html`, `index.html`, and `public/`.

---

## 3. Deploy and Publish Live Links

Run the preflight check, commit, and deploy to Cloudflare:

```powershell
# 1. Verify numerology math
node scripts/verify-numerology.js

# 2. Verify zero secret leakage
Select-String -Path "lifepath-test.html","index.html" -Pattern "sk_live","sk_test","api_key","rk_live","rk_test"

# 3. Commit and push to GitHub
git add lifepath-test.html index.html public/
git commit -m "feat(stripe): wire live Stripe payment links for production launch"
git push origin main

# 4. Deploy to Cloudflare
npx wrangler pages deploy public --project-name lifepath-repo --branch main
npx wrangler deploy
```
