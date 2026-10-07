#!/usr/bin/env bash
# Isolated web releases. Never stop the serving application to build.
set -Eeuo pipefail
source_root=/home/ubuntu/webtummy
releases=/home/ubuntu/webtummy-releases
proxy=/etc/nginx/snippets/webtummy-proxy.conf
assets=/var/www/webtummy-assets
mode=${1:-}
release=${2:-}
[[ "$release" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$ ]] || { echo 'Usage: bash deploy/release-web.sh prepare|snapshot|activate RELEASE_ID'; exit 2; }
mkdir -p "$releases"
exec 9>"$releases/.deployment.lock"
flock -n 9 || { echo 'Another release operation is running.'; exit 1; }
target="$releases/$release"

copy_source() {
  [[ ! -e "$target" ]] || { echo 'Release already exists; use a new ID.'; exit 1; }
  mkdir -p "$target"
  rsync -a --exclude=.git --exclude=node_modules --exclude=.next --exclude=.turbo --exclude=.env --exclude='.env-*' --exclude=.uploads "$source_root/" "$target/"
  ln -s "$source_root/.env" "$target/.env"
  ln -s "$source_root/.uploads" "$target/.uploads"
}

case "$mode" in
  prepare)
    # An offline/CI-built release can be placed here and activated instead.
    available_kb=$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)
    [[ "$available_kb" -ge 2300000 ]] || { echo 'Insufficient free RAM to build beside production. Build on a separate Linux builder or increase RAM. Live site left running.'; exit 1; }
    copy_source
    # Cap build RAM/CPU so a failed build cannot consume all production memory.
    sudo systemd-run --wait --pipe --collect --unit="webtummy-build-$release" \
      --property=User=ubuntu --property=Group=ubuntu --property="WorkingDirectory=$target" \
      --property=MemoryMax=1600M --property=CPUWeight=20 \
      /bin/bash -c 'set -e; npm ci; npm run db:generate; NODE_OPTIONS=--max-old-space-size=1280 npm run build -w @awb/web -- --webpack'
    test -s "$target/apps/web/.next/BUILD_ID"
    echo 'Build ready; activate separately after review. No migration or traffic changes made.'
    ;;
  snapshot)
    # Bootstrap an immutable release from the currently running, built checkout.
    copy_source
    cp -a "$source_root/node_modules" "$target/node_modules"
    cp -a "$source_root/apps/web/.next" "$target/apps/web/.next"
    test -s "$target/apps/web/.next/BUILD_ID"
    echo "Snapshot ready: $release"
    ;;
  activate)
    test -s "$target/apps/web/.next/BUILD_ID"
    test -f /etc/systemd/system/webtummy-web@.service
    test -d "$assets"
    current_port=$(sed -nE 's/^proxy_pass http:\/\/127\.0\.0\.1:([0-9]+);$/\1/p' "$proxy")
    case "$current_port" in 3001|3002|3003) ;; *) echo 'Unexpected live upstream; refusing traffic switch.'; exit 1 ;; esac
    if [[ -f "$target/deploy/runtime.env" ]]; then
      port=$(sed -nE 's/^WEBTUMMY_PORT=([0-9]+)$/\1/p' "$target/deploy/runtime.env")
      [[ "$port" == 3002 || "$port" == 3003 ]] || exit 1
      [[ "$port" != "$current_port" ]] || { echo 'This release is already serving.'; exit 0; }
    else
      for candidate_port in 3002 3003; do
        [[ "$candidate_port" != "$current_port" ]] || continue
        if ! ss -H -ltn "sport = :$candidate_port" | rg -q .; then port="$candidate_port"; break; fi
      done
      [[ -n "${port:-}" ]] || { echo 'Both candidate ports occupied. Retire a previously drained release explicitly; live site left running.'; exit 1; }
      printf 'WEBTUMMY_PORT=%s\n' "$port" > "$target/deploy/runtime.env"
    fi
    cp "$proxy" "$target/deploy/proxy-before.conf"
    # Never remove old hashed chunks: already-open browser tabs still use them.
    sudo rsync -a --chmod=D755,F644 "$source_root/apps/web/.next/static/" "$assets/"
    sudo rsync -a --chmod=D755,F644 "$target/apps/web/.next/static/" "$assets/"
    sudo systemctl start "webtummy-web@$release"
    ready=false
    for attempt in {1..30}; do
      if curl --fail --silent --max-time 3 "http://127.0.0.1:$port/api/health" | rg -q '"database":"up"'; then ready=true; break; fi
      sleep 1
    done
    [[ "$ready" == true ]] || { echo 'Candidate health failed. Live traffic left unchanged.'; exit 1; }
    for route in /signup /pricing /signin; do
      curl --fail --silent --max-time 10 "http://127.0.0.1:$port$route" -o /dev/null
    done
    switched=false
    restore_proxy() {
      code=$?
      if [[ "$code" != 0 && "$switched" == true ]]; then
        sudo install -m 644 "$target/deploy/proxy-before.conf" "$proxy"
        sudo nginx -t && sudo systemctl reload nginx
        echo 'Activation failed; traffic restored to the previous version.'
      fi
      exit "$code"
    }
    trap restore_proxy EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    sed "s/127.0.0.1:$current_port/127.0.0.1:$port/" "$target/deploy/proxy-before.conf" > "$target/deploy/proxy-next.conf"
    switched=true
    sudo install -m 644 "$target/deploy/proxy-next.conf" "$proxy"
    sudo nginx -t
    # Persist the candidate before switching; both releases remain running.
    sudo systemctl enable "webtummy-web@$release"
    sudo systemctl reload nginx
    for route in /api/health /signup /pricing; do
      curl --fail --silent --max-time 15 "https://webtummy.com$route" -o /dev/null
    done
    printf '%s\n' "$release" > "$releases/active-release"
    trap - EXIT
    echo "Traffic now serves $release on $port. Previous version remains running for draining and rollback."
    ;;
  *) echo 'Unknown operation.'; exit 2 ;;
esac
