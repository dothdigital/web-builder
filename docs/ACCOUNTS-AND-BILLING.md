# Webtummy accounts, trial and subscriptions

## Available screens

- `/signup`, `/signin`, `/forgot-password`, `/reset-password`, `/verify-email`: verified email/password accounts. The old any-email development login is removed.
- `/dashboard`: website portfolio, trial countdown, plan/usage, editor, temporary preview, analytics, publishing.
- `/account`: profile and SES password setup/recovery.
- `/team`: owner-managed email invitations and Editor/Viewer roles; workspace switching in the top bar.
- `/billing`: monthly/yearly plan selection, Stripe checkout, upgrade confirmation, invoices/payment methods/cancellation.
- `/admin`, `/admin/users`, `/admin/plans`: platform administration, suspensions, roles, complimentary access, plan allowances and prices. All actions check admin authority on the server and record audit events.

## Trial rules

New workspaces receive seven calendar days from account creation. Email verification is required before password sign-in. The trial includes all editor and AI tools, up to 25 websites, and existing temporary `/preview/...` URLs. No Stripe subscription or card is needed for the trial. Live hosting/domain actions require a paid active subscription (or an explicitly complimentary workspace).

After expiry, the dashboard and saved previews remain readable. Editor navigation sends the user to billing; creation, generation, saving, uploads, export, and other project mutations are denied server-side. Existing background jobs can finish; their work is retained. No website data is deleted. A browser left open across expiry cannot bypass the server checks.

Paid subscriptions use their package's website allowance, checked inside a workspace row lock during creation. Concurrent requests cannot exceed that allowance. If an externally initiated downgrade puts usage above its new allowance, existing websites remain and creation is blocked until usage fits.

Existing workspaces are grandfathered as complimentary by the migration, so introducing billing doesn't lock out existing work. Admin can require a paid plan for a workspace explicitly. Your admin workspace is complimentary; newly registered accounts receive the trial instead.

## Configure Stripe before accepting payments

Set these in the deployment secret manager or local `.env` (do not commit keys):

```
STRIPE_SECRET_KEY=<test secret first>
STRIPE_WEBHOOK_SECRET=<webhook signing secret>
PUBLIC_APP_URL=https://app.webtummy.com
# Optional, if using a specific portal configuration:
STRIPE_PORTAL_CONFIGURATION_ID=<bpc_...>
```

No existing environment files were changed by this implementation. Checkout is disabled until the secret key and webhook secret exist. Price amounts are not guessed: until an admin configures them, packages show “Coming soon”. Agency starts at 25 websites and its allowance can be increased in Admin.

1. Start with Stripe test mode. In Admin → Packages, create monthly/yearly prices in CAD, USD, EUR, GBP or AUD, or attach existing fixed recurring `price_...` IDs. Prices are verified with Stripe; displayed amounts/currencies come from Stripe. Creating a replacement price affects future purchases, not existing subscribers.
2. Configure the Stripe customer portal: enable invoices, payment method updates, cancellation at period end, and subscription price updates. Add the Webtummy products/prices to its allowed catalog. Configure your desired proration behaviour (for example, invoice prorated upgrade charges immediately). Put the configuration ID above if not using the default configuration.
3. Configure the webhook `/api/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `customer.subscription.pending_update_applied`, `customer.subscription.pending_update_expired`.
4. Local test: `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Use that listener's signing secret. For production, use a public HTTPS endpoint and its own signing secret.
5. Verify checkout, a failed payment, plan changes, cancellation, webhook retries and renewal in test mode before using live keys. The browser's checkout success URL never grants access. Only signed events synchronised against Stripe's current subscription state update paid access.

Webhook events are deduplicated transactionally. Subscription updates fetch Stripe's current state under a workspace lock, preventing older deliveries from overwriting newer state. Customer IDs are workspace-scoped; checkout and portal sessions are owner-only. Unknown/unmapped prices do not grant paid access. Existing subscribers retain their price mapping even after a price is retired for new purchases.

Renewal failure locks editing when the subscription is no longer active and the initial app trial has ended. Already deployed static files are not automatically removed from AWS; separate hosting suspension automation is needed if you want non-payment to take an existing live site offline. This implementation blocks new publishing and domain changes.

## SES and account access

Uses the existing `SES_MAILER_FROM`, `SES_MAILER_ACCESS_KEY`, `SES_MAILER_SECRET_KEY`, `SES_MAILER_AWS_REGION`; AWS IAM role credentials are supported when explicit keys are absent. Verify the sender and move SES out of sandbox before emailing arbitrary users. Keep `AUTH_SECRET` strong/stable and configure a public HTTPS `AUTH_URL`/`PUBLIC_APP_URL` in production.

Existing email-only users keep their current sessions. Use My account → Email password setup link before signing out. Recovery links expire after one hour; invitation links after seven days. Tokens are hashed in storage and consumed once. Passwords use salted scrypt. Password reset and suspension invalidate previous sessions. Login, registration, recovery and invitations have database-backed rate limits across app instances.

## Operations

Run `npm run db:deploy` and `npm run db:generate` on deployment. The additive migrations create billing/auth tables, trial fields (with a UTC default) and the email studio tables. Apply them before starting the new app version. Keep app and worker builds in sync.

Tests: `scripts/validate-accounts-billing.mts` uses temporary fixtures and mocked Stripe calls only; it never charges a customer or sends email. `scripts/validate-account-http.mts` exercises real local password login and protected pages using a temporary account, then deletes it. Existing accounts and projects are not modified by these tests.

Stripe references: https://docs.stripe.com/webhooks and https://docs.stripe.com/customer-management/integrate-customer-portal.

## Google and Microsoft sign-in

Both providers are implemented with Auth.js and enabled only when their credentials exist. Users authenticate with the provider itself; Webtummy does not receive their Google/Microsoft password. New social accounts are provisioned with one workspace and the same seven-day trial. Disabled accounts cannot log in. Existing email accounts are not automatically linked by matching email: first sign in with the existing password, then connect a provider in My account.

Google: create a Web OAuth client and configure:

```
AUTH_GOOGLE_ID=<Google OAuth client ID>
AUTH_GOOGLE_SECRET=<Google OAuth client secret>
```

Redirect URLs: `http://localhost:3000/api/auth/callback/google` for local testing; `https://app.webtummy.com/api/auth/callback/google` for production. Configure the consent screen/publishing status in Google Cloud. Only verified Google email profiles are accepted.

Microsoft: register an application in Microsoft Entra and configure:

```
AUTH_MICROSOFT_ENTRA_ID_ID=<Application client ID>
AUTH_MICROSOFT_ENTRA_ID_SECRET=<Client secret VALUE>
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/common/v2.0
```

Allow work/school and personal Microsoft accounts if that is the intended audience. Redirect URLs: `http://localhost:3000/api/auth/callback/microsoft-entra-id` and `https://app.webtummy.com/api/auth/callback/microsoft-entra-id`. Use a tenant-specific issuer instead of `common` if restricting sign-in to your organisation.

Register callback URLs for the actual application host, not a generated customer website. Restart the app after configuring credentials. No OAuth credentials were invented or added by this implementation; provider consent flows must be verified after configuration.
