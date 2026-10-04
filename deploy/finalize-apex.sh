#!/bin/bash
set -euo pipefail
cd /home/ubuntu/webtummy
for domain in webtummy.com www.webtummy.com; do
    if ! dig +short @dns1.registrar-servers.com "$domain" A | rg -qx '99\.79\.22\.221'; then
        echo "$domain DNS does not point to 99.79.22.221 yet. No TLS or redirect changes made."
        exit 1
    fi
done
sudo certbot certonly --webroot -w /var/www/webtummy-acme \
    --cert-name webtummy.com -d webtummy.com -d www.webtummy.com \
    --non-interactive --agree-tos --register-unsafely-without-email
sudo install -m 644 deploy/webtummy-apex-https.nginx.conf /etc/nginx/sites-available/webtummy
sudo nginx -t
sudo systemctl reload nginx
echo 'HTTPS routing enabled. Verify https://webtummy.com and both hostname redirects.'
