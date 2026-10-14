#!/usr/bin/env bash
set -Eeuo pipefail
release=$(cat /home/ubuntu/webtummy-releases/active-release)
[[ "$release" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$ ]] || exit 2
target="/home/ubuntu/webtummy-releases/$release"
test -s "$target/apps/web/.next/BUILD_ID"
test -f "$target/apps/worker/src/index.ts"
sudo -n systemctl is-active --quiet "webtummy-web@$release.service"
cd "$target"
# Apply production migrations before the worker loads the new Prisma client.
npm exec -w @awb/database -- prisma migrate deploy
npm exec -w @awb/database -- prisma migrate status
config_tmp=$(mktemp)
trap 'rm -f -- "$config_tmp"' EXIT
cat > "$config_tmp" <<EOF
[Service]
WorkingDirectory=$target/apps/worker
ExecStart=
ExecStart=/usr/local/bin/webtummy-node22 $target/node_modules/tsx/dist/cli.mjs src/index.ts
EOF
sudo -n install -m 644 "$config_tmp" /etc/systemd/system/webtummy-worker.service.d/release.conf
sudo -n systemctl daemon-reload
sudo -n systemctl restart webtummy-worker.service
sudo -n systemctl is-active --quiet webtummy-worker.service
sudo -n systemctl status webtummy-worker.service --no-pager -l
curl -fsS --max-time 15 https://webtummy.com/api/health
printf '\n'
sudo -n journalctl -u webtummy-worker.service --since '2 minutes ago' --no-pager -l -n 40
echo "Migration and worker update commands completed for $release. Review logs for runtime errors."
