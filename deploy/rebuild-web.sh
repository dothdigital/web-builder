#!/usr/bin/env bash
# Explicit downtime rebuild of the web application from the current source.
set -Eeuo pipefail
cd /home/ubuntu/webtummy
release=${1:-fresh-$(date -u +%Y%m%d-%H%M%S)}
[[ "$release" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$ ]] || { echo 'Invalid release ID.'; exit 2; }
[[ ! -e "/home/ubuntu/webtummy-releases/$release" ]] || { echo 'Release already exists; use a new ID.'; exit 1; }
# Serialize this entire rebuild in addition to release-web.sh's per-step lock.
exec 8>/home/ubuntu/webtummy-releases/.rebuild.lock
flock -n 8 || { echo 'Another rebuild is running.'; exit 1; }
running=$(sudo -n systemctl list-units --state=running --no-legend --plain 'webtummy-web*')
old_units=()
while read -r unit rest; do
  [[ -n "$unit" ]] && old_units+=("$unit")
done <<< "$running"
complete=false
recover() {
  code=$?
  trap - EXIT
  if [[ "$complete" == false && ${#old_units[@]} -gt 0 ]]; then
    echo 'Rebuild failed; restarting the previously running web services.'
    sudo -n systemctl start "${old_units[@]}" || true
  fi
  exit "$code"
}
trap recover EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
if [[ ${#old_units[@]} -gt 0 ]]; then
  sudo -n systemctl stop "${old_units[@]}"
fi
bash deploy/release-web.sh prepare "$release"
bash deploy/release-web.sh activate "$release"
complete=true
if [[ ${#old_units[@]} -gt 0 ]]; then
  sudo -n systemctl disable "${old_units[@]}"
fi
sudo -n systemctl list-units --state=running 'webtummy-web*' --no-pager
echo "Fresh build deployed: $release"
