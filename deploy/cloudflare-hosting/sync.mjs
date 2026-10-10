import { readFile } from 'node:fs/promises'
import { config } from 'dotenv'
config({ path: new URL('../../.env', import.meta.url), quiet: true })
const secret = process.env.HOSTING_CRON_SECRET
if (!secret || secret.length < 32) throw new Error('Hosting sync secret is not configured')
const proxy = await readFile('/etc/nginx/snippets/webtummy-proxy.conf', 'utf8')
const port = proxy.match(/^proxy_pass http:\/\/127\.0\.0\.1:(300[123]);$/m)?.[1]
if (!port) throw new Error('Cannot determine the active Webtummy release')
const response = await fetch(`http://127.0.0.1:${port}/api/internal/hosting/sync`, { method: 'POST', headers: { Authorization: `Bearer ${secret}` }, redirect: 'error', signal: AbortSignal.timeout(310000) })
if (!response.ok) throw new Error(`Hosting sync returned HTTP ${response.status}`)
const result = await response.json()
const failed = result.checked.filter(site => !site.ok).length
console.log(`Hosting sync checked ${result.checked.length} websites; ${failed} failed`)
if (failed) process.exitCode = 1
