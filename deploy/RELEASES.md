# Webtummy web releases

Never stop the live web or worker service to run a build. Never build in the
directory from which the live web service runs. The old stop-and-build instructions
in SERVER.md are superseded by this workflow.

Prepare in `/home/ubuntu/webtummy-releases/RELEASE_ID`:

```sh
bash deploy/release-web.sh prepare RELEASE_ID
```

Preparation copies source, installs its own dependencies and builds independently.
Builds have a separate 1.6 GB memory limit and low CPU priority. Preparation
refuses an on-server build when less than 2.3 GB of RAM is available. If that
happens, use a separate compatible Linux build machine or increase server RAM;
do not stop production to free memory. Offline builds must include the complete
release source, installed Linux dependencies, generated Prisma client and `.next`;
production secrets remain on this server and are linked only at deployment.

After review and browser checks, activate:

```sh
bash deploy/release-web.sh activate RELEASE_ID
```

The release starts on an unused loopback port (3002/3003). Health and public-page
checks must pass before Nginx is gracefully reloaded. Failure before switching
leaves live traffic untouched; failure after switching restores the previous
proxy configuration. Keep the old process running for at least 450 seconds to
finish long requests. Keep its files for rollback. Hashed static assets from old
and new releases are retained in `/var/www/webtummy-assets` for open browser tabs.

To roll back, activate the previous release ID. For the initial legacy release,
restore the new release's `deploy/proxy-before.conf` to the proxy snippet and test
and reload Nginx; the original `webtummy-web` service is kept running.

The script refuses activation when both candidate ports are occupied. After the
drain interval and a healthy observation period, explicitly stop and disable the
older inactive release to free its port. Never stop the active release.

Database migrations are separate: only backward-compatible additive migrations
can overlap old and new releases. Do not run destructive schema changes during
activation. Worker deployments are separate and are not stopped by this script.
This removes deployment-caused downtime; a single server still cannot tolerate
a host failure. Host-level availability needs another server/load balancer and
appropriately resilient storage/database infrastructure.


## Source of truth and release identity

GitHub `dothdigital/web-builder`, branch `main`, is the canonical source. Make
source changes in Git, then prepare web and worker releases from that same commit.
Release directories are immutable runtime snapshots, not alternate development
checkouts. A worker release may intentionally lag the web release, but record
its source identity and review that difference before activation.

`copy_source` writes `deploy/source-version.json` into every new release. It
records the Git commit and dirty state when the source is a Git checkout, plus a
content fingerprint even when the source was copied without `.git`. A null
commit means provenance is unknown; do not describe that snapshot as the latest
Git version based only on its directory name. Runtime secrets, uploads, builds
and dependencies are excluded from the fingerprint.

Inspect a checkout or release without changing it:

```sh
python3 deploy/source-version.py --root /path/to/source
systemctl show -p WorkingDirectory webtummy-worker.service
systemctl show -p WorkingDirectory webtummy-web@RELEASE_ID.service
```

When distributing a Git archive without `.git`, generate and retain its manifest
alongside the artifact. Do not edit the source inside a running release. Deploying
a new web snapshot does not automatically update the background worker.
