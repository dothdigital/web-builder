from pathlib import Path
import re
import os

root = Path('/home/ubuntu/webtummy')
env = root / '.env'
backup = root / 'deploy' / '.env-before-apex'
if not backup.exists():
    backup.write_bytes(env.read_bytes())
    os.chmod(backup, 0o600)
text = env.read_text()
for key, value in {
    'AUTH_URL': 'https://webtummy.com',
    'PUBLIC_APP_URL': 'https://webtummy.com',
    'PLATFORM_DOMAIN': 'webtummy.com',
}.items():
    text = re.sub(rf'^{key}=.*$', f'{key}="{value}"', text, flags=re.MULTILINE)
env.write_text(text)
os.chmod(env, 0o600)
for name in ('.database-setup.sql', '.redis-webtummy.conf'):
    (root / 'deploy' / name).unlink(missing_ok=True)
print('Application URLs now use https://webtummy.com; original environment backed up privately.')
