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

- `webtummy-web.service`: production Next.js app; restart on failure; enabled at boot.
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

For application updates: review source changes, run `npm ci`, `npm run db:generate`,
`npm run db:deploy`, and `npm run build`, then restart only the Webtummy web and worker services.
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
