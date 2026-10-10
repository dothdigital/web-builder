# Cloudflare and the Webtummy server pool

Webtummy uses Cloudflare for customer hostname validation and HTTPS. Traffic
reaches gateway servers, which route each hostname to its assigned pool server.
S3 stores website releases independently of server assignments:

```
webtummy-website/<website-slug>-<project-id>/releases/<release-id>/
```

The application saves the storage prefix at first publication. Renaming a
project does not rename its stored releases. Each release also has an internal
`_deployment/site.zip` archive for future restoration or migration.

## Configuration

Use `platform.env.example` for the application and `server.env.example` for each
pool server. Each server needs a unique, stable ID and a separate agent token.
Configure all pool servers in `HOSTING_SERVERS_JSON`, including their private
administration endpoint, traffic endpoint, site capacity and enabled state.
List the gateway server IDs in `HOSTING_GATEWAY_IDS`.

Configure gateway peers with the traffic endpoint and token of every origin
server they can route to. Protect administration endpoints with private network
access. Use the supplied systemd and nginx examples to run the agent and expose
the origin traffic endpoint.

Configure the Cloudflare zone and scoped API token in the application. Configure
Cloudflare's SaaS fallback origin to reach the gateways, along with the published
preview domain and the customer CNAME target. The application creates customer
custom hostnames and displays their ownership and certificate validation records.
The example environment values are placeholders; infrastructure configuration
and live DNS/HTTPS verification are required before publishing to customers.

## Allocation and publication

For a new assignment, the application probes enabled servers concurrently with
a five second timeout. Under a database advisory lock, it selects a healthy
server with spare capacity and the lowest assigned-sites/capacity ratio. It saves
the assignment before publication. Existing websites keep their assigned server.
Setting a server to disabled prevents new allocations; it does not migrate its
existing websites.

Publishing stores the release in S3, uploads it to the assigned server, activates
it, and updates each gateway's route. Publication is marked live only after the
assigned server, gateway manifests and public HTTPS release check agree. Domain
routing and billing suspension are handled by the same manifests.

Automatic server migration and failover are not implemented. Do not remove a
server that still has assigned websites. S3 archives provide recovery material,
but restoration and reassignment need a separate migration workflow.

## Validation

From the repository root:

```
node --test deploy/cloudflare-hosting/agent.test.mjs
npm run typecheck -w @awb/web
```

The integration test runs a local origin and gateway and checks authenticated
administration, proxy routing, domain isolation, canonical redirects, release
verification, suspension, duplicate domain rejection and missing-release rejection.
It does not contact Cloudflare or S3.

## Deployed setup — October 9, 2026

Application release `default-design-20261009` and the preview-capable agent
are deployed. Wildcard `*.webtummy.com` DNS routes through Cloudflare to server-1.
The app server resolves `webtummy.com` through public resolvers using
`/etc/systemd/resolved.conf.d/webtummy-dns.conf`, avoiding stale VPC answers while
retaining private-domain DNS. `webtummy-hosting-sync.timer` reconciles pending
deployments each minute using `sync.mjs` and the active release port.

Real S3 upload, public HTTPS preview/publication, preview/live isolation and
billing suspension/restoration passed with a dedicated sample website:
https://test-cmv12mbmf000310nrq9kbdrfm.webtummy.com

The publishing interface passed owner login, desktop/phone rendering, real
preview update, and viewer/support replay rejection. Evidence is saved in
`/home/ubuntu/webtummy-hosting-*-verification.json`; the report is
`/home/ubuntu/webtummy-deployment-status-2026-10-09.txt`.

Custom customer domains remain blocked by Cloudflare account provisioning.
Fallback-origin error 1456 says SSL for SaaS is unavailable; custom-hostname
error 1404 says no quota is allocated. Enable Cloudflare for SaaS for
`webtummy.com` in SSL/TLS → Custom Hostnames. Cloudflare may request payment
information. Then set the fallback origin to `hosting.webtummy.com` and verify
an owner-authorized external test domain. Official instructions:
https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/enable/

The live validation scripts retain a dedicated billing-exempt sample site so
its links remain reviewable:

```
TSX_TSCONFIG_PATH=apps/web/tsconfig.json node --import tsx scripts/validate-hosting-live.cjs
TSX_TSCONFIG_PATH=apps/web/tsconfig.json node --import tsx scripts/validate-hosting-ui.cjs
```

These scripts make real hosting writes. Use only with owner authorization,
configured infrastructure and spare capacity. Sample credentials are stored
outside the repository in a mode-0600 file.
