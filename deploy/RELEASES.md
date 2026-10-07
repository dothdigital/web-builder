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
