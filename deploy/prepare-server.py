from pathlib import Path
import secrets
import os

root = Path('/home/ubuntu/webtummy')
target = root / '.env'
if target.exists():
    raise SystemExit('Existing environment preserved; refusing to replace secrets.')
db_password = secrets.token_hex(32)
redis_password = secrets.token_hex(32)
target.write_text('\n'.join([
    f'DATABASE_URL="postgresql://webtummy:{db_password}@127.0.0.1:5433/webtummy?schema=public"',
    f'AUTH_SECRET="{secrets.token_hex(48)}"',
    'AUTH_URL="https://webtummy.com"',
    'AUTH_TRUST_HOST="true"',
    'PUBLIC_APP_URL="https://webtummy.com"',
    'PLATFORM_DOMAIN="webtummy.com"',
    f'REDIS_URL="redis://:{redis_password}@127.0.0.1:6380/0"',
    'USE_REDIS_QUEUE="true"',
    'AI_PROVIDER="stub"',
    'LOCAL_UPLOAD_DIR="/home/ubuntu/webtummy/.uploads"',
    'WEBSITE_JOB_CONCURRENCY="1"',
    'CONTENT_JOB_CONCURRENCY="1"',
    'CONTENT_JOBS_PER_MINUTE="12"',
    'WORKER_CONCURRENCY="1"',
    'SES_MAILER_AWS_REGION="ca-central-1"',
    'SES_MAILER_FROM=""',
]) + '\n')
os.chmod(target, 0o600)
sql = root / 'deploy' / '.database-setup.sql'
sql.write_text(f"CREATE ROLE webtummy LOGIN PASSWORD '{db_password}';\nCREATE DATABASE webtummy OWNER webtummy;\n")
os.chmod(sql, 0o600)
redis = root / 'deploy' / '.redis-webtummy.conf'
redis.write_text('\n'.join([
    'bind 127.0.0.1', 'protected-mode yes', 'port 6380',
    f'requirepass {redis_password}', 'daemonize no', 'supervised no',
    'dir /var/lib/redis-webtummy', 'appendonly yes', 'appendfsync everysec',
    'maxmemory 256mb', 'maxmemory-policy noeviction', 'logfile ""',
]) + '\n')
os.chmod(redis, 0o600)
(root / '.uploads').mkdir(exist_ok=True)
print('Created private Webtummy environment and initialization files; no secrets displayed.')
