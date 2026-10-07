# Webtummy server deployment

Source checkout: `/home/ubuntu/webtummy` from `dothdigital/web-builder`.
Webtummy has no application, database, queue, or configuration dependency on Senuke.

## Domains

- `webtummy.com`: repository marketing homepage and full Next.js builder on the same domain,
  running behind Nginx on `127.0.0.1:3001`.
- `www.webtummy.com` and `build.webtummy.com`: redirect to `https://webtummy.com`, preserving paths.
- Public server IPv4: `99.79.22.221`.
- Nginx configuration: `/etc/nginx/sites-available/webtummy`.
- Builder TLS certificate: `/etc/letsencrypt/live/build.webtummy.com`.

The apex and www A records now point to this server. `deploy/finalize-apex.sh` completed on
2026-10-04, issuing the apex/www certificate and enabling the final HTTPS routing.
The apex TLS certificate is at `/etc/letsencrypt/live/webtummy.com` and expires 2027-01-02;
renewal is automatic. The live Nginx configuration matches `deploy/webtummy-apex-https.nginx.conf`.
Certbot renewal runs through its system timer; the Webtummy deployment hook tests and reloads Nginx.
Application AUTH_URL, PUBLIC_APP_URL, and PLATFORM_DOMAIN now use webtummy.com. The original
environment was backed up privately in `deploy/.env-before-apex`.

## Independent services and storage

- `webtummy-web@trial-copy-20261006.service`: active isolated Next.js release on
  `127.0.0.1:3002`, enabled at boot. `/home/ubuntu/webtummy-releases/active-release`
  records the active release; Nginx's proxy snippet records its port. The original
  `webtummy-web.service` on port 3001 remains running as the initial rollback target.
- `webtummy-worker.service`: temporary local worker, concurrency one; enabled at boot. The user prefers
  moving it to the existing Senuke worker server if possible. Its SSH destination is still needed;
  an existing administrative worker SSH key is available here. The remote service template is
  `deploy/webtummy-remote-worker.service`; adjust its account and runtime paths after inspecting that server.
- `redis-webtummy.service`: private, password-protected Redis on `127.0.0.1:6380`, AOF persistence,
  dedicated `/var/lib/redis-webtummy` storage, no eviction.
- `postgresql@18-webtummy.service`: dedicated PostgreSQL cluster on `127.0.0.1:5433`, database and role
  named `webtummy`, data at `/var/lib/postgresql/18/webtummy`. All 17 repository migrations were applied.
- Private `.env` at the repository root (mode 0600). Preserve AUTH_SECRET across deployments.
- Local uploads: `/home/ubuntu/webtummy/.uploads`.

Services currently run under the Ubuntu account, with individual restart and resource limits.
Database and Redis are not exposed publicly. No Senuke configuration or source was edited.

## Settings still needed for full product operation

- AI: currently `AI_PROVIDER=stub`, the repository's deterministic test provider. Configure a dedicated
  Webtummy provider API key and select `AI_PROVIDER=openai` to enable live generation.
- Email: `SES_MAILER_FROM` is empty. Configure a verified Webtummy SES sender and dedicated credentials
  or an appropriately scoped instance role. Email verification and password resets require this.
- Billing: configure Webtummy Stripe credentials, webhook, and real plans/prices before paid sales.
- Customer website publishing: provision the repository's AWS hosting module separately; the public
  marketing site and builder deployment do not create customer CloudFront distributions or S3 buckets.
- Remote worker: obtain its address/access and check spare capacity. Use a separate Webtummy folder and
  service. Connect to this database and queue over private networking or an authenticated tunnel; do not
  expose either port on the public internet. Remote image processing needs Webtummy shared asset storage
  (such as a dedicated S3 bucket). Disable the local worker when the remote worker is verified.

Do not reuse Senuke keys, databases, Redis, or asset buckets.

## Routine operations

### Seven-day subscription trial (2026-10-06)

The Individual plan now offers eligible new customers a seven-day trial, then US$29/month.
Checkout uses the existing configured monthly Stripe price, requires a card and explicitly sets
`subscription_data.trial_period_days=7`; the separate Stripe pricing-table trial does not configure
these API-created sessions. A trial starts only after Stripe confirms `trialing` with a valid
mapped price and future `billingTrialEnd`. Creation, editing, AI and hosting use the same access
policy and are fully available during that period. Signup alone grants no trial access.
The user's prior paid subscriptions are not changed. Workspace/user trial-history timestamps and
a short checkout reservation prevent repeat trials and simultaneous trial checkouts. Abandoned
reservations expire with checkout. Reactivation uses paid checkout without another trial.

Trial cancellation stops the first automatic charge and keeps access through the original trial
end; resuming before that end restores billing without extending the trial. An expired trial
without a confirmed post-trial payment loses editing and hosting access and enters the existing
90-day retention policy. Its $0 trial invoice does not count as a paid period, so a failed first
charge does not receive previously-paid renewal grace. Later failed paid renewals keep the
7-day/30-day policy. Existing admin/support and explicit payment exemptions are preserved.

Core email flow: welcome after verification; one themed activation email after confirmed trial
checkout; one combined subscription-active/payment receipt email after the first paid invoice.
No separate trial reminder is sent by this implementation. Cancellation/resume, payment problems
and suspension/retention notices still follow their events. Branded previews are in
`deploy/email-previews/`. The complete Stripe publishable key is stored only in private `.env`.
Stripe's enabled webhook already includes checkout completion, subscription lifecycle and
`invoice.paid` events. The billing sweep is the fallback if an event is delayed.

Run `TSX_TSCONFIG_PATH=apps/web/tsconfig.json node --import tsx
scripts/validate-subscription-trials.cjs` with the worker paused; its synthetic fixtures mock all
Stripe, AWS and mail delivery. Before the additive trial migration, database/uploads were backed
up to `/home/ubuntu/backups/webtummy/20261006T021650Z`.

Account verification now queues a separate welcome email after verification succeeds.
Confirmed paid Stripe invoices queue a payment email for verified workspace owners, including
zero-dollar invoices (such as a 100% coupon), which receive a subscription confirmation rather
than a claim that money was received. Messages include the paid invoice and PDF links supplied
by Stripe. Transactional messages use `ACCOUNT_EMAIL_FROM` (currently
`Team Webtummy <no_reply@webtummy.com>`) with the SES sender as fallback.
The `TransactionalEmail` outbox is separate from marketing consent and billing failure notices;
the verification/webhook response schedules prompt delivery, and the existing authenticated
billing sweep drains pending messages each minute. Unique welcome/user and invoice/user keys
prevent duplicate messages. SES throttling is retried with backoff; `FAILED` or `UNKNOWN` records
need review, and uncertain sends are never automatically repeated.
Validate with `npx tsx scripts/validate-transactional-emails.mts`; delivery is mocked and test
records are removed. The 2026-10-06 migration backup is in
`/home/ubuntu/backups/webtummy/20261006T012807Z` (private database dump and uploads archive).

Never stop production services to build, or build in the active release directory.
Use the isolated release and checked traffic-switch workflow in `deploy/RELEASES.md`.
The small server may refuse an on-server build for insufficient free RAM; use a
separate Linux builder or increase memory instead of stopping the live site.
Authentication forms show plain validation messages without support error-code banners.

Subscription cancellation stops renewal at the current period end and queues a confirmation
email containing the access end date and retention policy. Until that period ends, owners can
select **Resume subscription** in the billing dialog and explicitly confirm automatic renewal.
Resume removes Stripe's scheduled cancellation while preserving the subscription, billing date,
discounts and saved card; it queues a resume confirmation and does not create a new checkout.
Ended subscriptions show **Reactivate subscription**, using the same Stripe customer and existing
workspace/project through checkout. Confirmed paid invoices (including $0 coupon invoices) restore
access, clear suspension/retention-review state, retain legal holds and queue receipt/reactivation
emails. The existing billing sweep removes hosting's suspension gate for published websites.
Existing unpaid subscriptions use payment recovery instead of starting duplicate subscriptions.
Cancellation at the period boundary never grants failed-renewal grace while waiting for a webhook.
No automatic refunds or permanent website deletion are performed by this flow.

Regression checks: `TSX_TSCONFIG_PATH=apps/web/tsconfig.json node --import tsx
scripts/validate-billing-management.cjs`, `npx tsx scripts/validate-billing-lifecycle.mts`, and
`TSX_TSCONFIG_PATH=apps/web/tsconfig.json node --import tsx
scripts/validate-subscription-reactivation.cjs`. The reactivation suite uses synthetic records and
mocked Stripe/AWS calls, tests the three retention warning intervals and delivered-warning review
gate, and removes its fixtures. Pause the worker while running database-backed email tests so it
cannot pick up their synthetic outbox records; start it afterward.

The public contact page is `/contact`, linked in the footer. Its same-origin JSON endpoint
`/api/contact` validates and bounds input, rate-limits requests using the independent database,
discards honeypot submissions, and uses AWS SES with the visitor's address as Reply-To.
Only the configured server-side recipient can receive messages; visitors cannot select a recipient.
See `deploy/contact.env.example` for the private settings. Sending remains disabled until a
recipient and verified sender are configured. The existing EC2 role was denied SES identity/account
inspection; no email was sent during setup. The requested recipient needs confirmation because the
user wrote `info@dothdigtial.com` after previously providing `info@dothdigital.com`.

Contact reCAPTCHA supports v2 checkbox and v3; the supplied keys were confirmed as v3.
Set CONTACT_RECAPTCHA_TYPE=v3 and configure both site and secret keys in the private root .env.
Email/password signup shares these v3 keys and fails closed if they are missing or misconfigured.
Server verification checks the hostname, the expected contact or signup action, and score >= 0.5.
Contact partial configuration fails closed. Social sign-in uses the provider's authentication flow.
Neither the recipient nor mail/verification secrets are exposed to the browser. After confirming
the sending service and configuring credentials, validate a real delivery with the owner's approval.

```sh
systemctl status webtummy-web webtummy-worker redis-webtummy postgresql@18-webtummy
journalctl -u webtummy-web -n 100 --no-pager
journalctl -u webtummy-worker -n 100 --no-pager
curl https://webtummy.com/api/health
```

For web updates: review source changes, prepare an isolated release with
`bash deploy/release-web.sh prepare RELEASE_ID`, then activate it after checks with
`bash deploy/release-web.sh activate RELEASE_ID`. Do not restart the serving release.
Database migrations and worker updates are separate; only backward-compatible
additive migrations may overlap web releases.
Back up the database and uploads before migrations. Do not re-run `prepare-server.py`; it intentionally
refuses to overwrite existing secrets. No demonstration accounts were seeded.

The separately created marketing design is retained in `marketing/` and `/var/www/webtummy-marketing`
for reference. It is not served: the user chose the repository's existing homepage instead.
Edit `apps/web/src/app/page.tsx` to change that homepage, following its AGENTS.md instructions.

## Validation

- Production monorepo build: all nine tasks passed, including Next.js and worker TypeScript.
- Landing page: reviewed desktop 1440px and mobile 390px screenshots; HTTP 200, no horizontal overflow,
  no browser errors, FAQ expands, CTA points to the builder signup.
- Live builder `/`, `/signin`, `/signup`, `/api/health`: HTTP 200. Unauthenticated `/dashboard` goes to sign-in.
- Health endpoint reports database up; worker logs confirm queue consumption is running.
- Senuke app returned HTTP 200 and both Senuke services remained active after deployment.
- The monorepo build must use `--force` after changing root `.env` until environment files are included
  in the Turbo cache inputs; otherwise Turbo may restore outputs for the previous hostname.
- Patched Next.js to 16.3.8 and sharp to 0.35.5. Four audit findings remain in Prisma CLI transitive
  dependencies (`deepmerge-ts`, `mysql2`); the application uses PostgreSQL and no forced Prisma downgrade
  was performed. These findings require a compatible upstream dependency update.
