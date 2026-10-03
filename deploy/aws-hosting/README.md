# Webtummy AWS publishing setup

The application now has a **Domains & Publish** screen. Nothing in this folder
has been deployed to AWS. The customer's only tasks are saving their website,
adding their domain, setting DNS records, and clicking Publish. Never provide
customers with SSH, S3, AWS console, IAM keys, or database access.

## Architecture

- `webtummy.com`: your public business/marketing website.
- `app.webtummy.com`: the authenticated builder and public forms/analytics API.
- A private S3 bucket holds immutable HTML/CSS/JS/image releases under
  `sites/<projectId>/releases/<releaseId>/`.
- Each website has its own CloudFront distribution and temporary
  `d....cloudfront.net` address. Customer aliases attach only after ownership
  and certificate verification. This first implementation does not provision
  branded `*.sites.webtummy.com` temporary addresses.
- CloudFront Origin Access Control reads the private S3 files. No PHP or
  per-customer database is required on the website hosting side.
- ACM certificates are requested in `us-east-1`, regardless of the S3 region.
  DNS-validation CNAME records must remain in place for automatic renewal.
- Website visitors submit forms and tracking beacons directly to the public
  application backend. The frontend S3 bucket cannot run either backend.

## Administrator setup (once)

1. Register/control `webtummy.com` and choose the AWS region/account. Host the
   platform at `app.webtummy.com` with HTTPS. Keep PostgreSQL and Redis private;
   use a dedicated background worker and a separate asset-upload S3 bucket.
   This module does not deploy the Next.js application, worker, database or Redis.
2. Give the application an EC2 instance profile or ECS task role. Do not place
   long-lived AWS credentials in customer-visible settings. The existing S3
   asset client also supports role credentials when explicit S3 keys are omitted.
3. Install Terraform, then run `terraform init` and `terraform plan` in this
   folder, supplying `region`, a globally unique `bucket_name`, and the existing
   `platform_role_name`. Review the plan before running `terraform apply`.
   The module adds a private, encrypted/versioned bucket, an OAC, and publishing
   permissions on the application role. It does not modify DNS or existing sites.
4. Set the deployment variables shown in `platform.env.example` using the
   Terraform outputs. `HOSTING_PUBLIC_API_URL` must be the public HTTPS origin
   of the builder API, not localhost. Keep production `AUTH_SECRET` stable and
   private because saved integration credentials are encrypted using it.
   Leave the developer's existing local `.env` unchanged.
5. Run `npm ci`, `npm run db:generate`, `npm run db:deploy`, and the normal web
   build/start commands in the application deployment. Use long-lived Node
   hosting with enough request timeout for image bundling and uploads; the
   current Publish action executes synchronously until AWS accepts deployment.
6. Schedule a POST to `/api/internal/hosting/sync` every minute with
   `Authorization: Bearer <HOSTING_CRON_SECRET>`. Keep this secret in your scheduler.
   The endpoint checks 10 oldest hosting records per call; increase scheduling
   throughput as the customer count grows. The open publishing screen also
   checks every 30 seconds for editors. No browser needs to stay open if the
   scheduler is configured.
7. Test one site first: prepare hosting, publish, wait for LIVE, check the
   temporary URL, connect a test custom domain, complete TXT plus ACM CNAME
   records, set the primary hostname and republish. Test forms, reCAPTCHA and
   analytics using that public hostname. No real AWS tests have been run here.

## Customer DNS flow

1. Add each hostname separately (`example.com` and `www.example.com`).
2. Set the unique `_awb-verification.<hostname>` TXT value shown by Webtummy.
3. Click Prepare AWS hosting to obtain the CloudFront target. Use CNAME for
   subdomains; use Route 53 A/AAAA Alias or provider ALIAS/ANAME/CNAME flattening
   for the apex. CloudFront has no fixed customer-facing A-record IP.
4. Click Check DNS & deployment. After TXT verification, Webtummy requests the
   certificate and displays ACM's validation CNAME records. Add and retain them.
5. Choose a primary hostname and publish after the routing and certificate are
   ready. Connected aliases redirect with HTTP 308 to the chosen primary.
   Keep existing MX and email-related TXT records intact.

Adding/changing a primary domain does not change live traffic until publishing.
Root-domain providers without alias support should use `www` plus their domain
forwarding service. DNS propagation takes time. Proxying DNS before connection
can prevent verification. Existing unrelated DNS/site records are never edited
by this application.

## Releases and failure handling

Files upload into a new prefix. CloudFront is then updated to use that prefix.
The release stays DEPLOYING while configuration propagates and a full cache
invalidation completes. The dashboard marks LIVE only after both complete.
Failed bundling/uploads do not switch the live origin. Old release files remain
available for operator recovery. The UI lists recent releases but does not yet
provide a rollback or verified-domain disconnect button. Unverified domains can
be removed. Verified aliases must be disconnected by an administrator before
releasing their database ownership.

The database and AWS are not one transaction. If a publish request is interrupted,
check status before retrying. A persisted deployment can be reconciled by the
scheduler. Staged files and unused ACM certificates need a retention/cleanup
policy that never deletes the active release or in-use certificate.

## Capacity planning

This first adapter uses one standard distribution per website, and a routing
function per release (old functions are cleaned after a successful switch).
Before onboarding hundreds or 1,000 sites, inspect and request increases for
CloudFront distribution/function quotas, distributions per shared OAC, and ACM certificate/request quotas.
CloudFront SaaS Manager is an alternative architecture for larger fleets; it is
not silently enabled by this implementation. Domain, account and request quotas
are distinct from the number of registered Webtummy users. Set AWS budgets and
monitor origin errors, failed deployment checks, storage and transfer costs.

## Sources

- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-procedures.html
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-limits.html
