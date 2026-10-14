import { createServer, request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, writeFile, rename, rm, stat } from 'node:fs/promises'
import { resolve, dirname, extname, join, sep } from 'node:path'
import { randomUUID, timingSafeEqual } from 'node:crypto'
import JSZip from 'jszip'

const identifier = /^[a-zA-Z0-9_-]+$/
const hostname = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }
function equal(a, b) { const first = Buffer.from(a ?? ''); const second = Buffer.from(b ?? ''); return first.length === second.length && timingSafeEqual(first, second) }
function json(response, status, value) { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)) }
async function body(request, limit) {
  const chunks = []; let bytes = 0
  for await (const chunk of request) { bytes += chunk.length; if (bytes > limit) throw new Error('Body too large'); chunks.push(chunk) }
  return Buffer.concat(chunks)
}
async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 }); await rename(temporary, path)
}
function validRoute(value, projectId, allowedOrigins) {
  if (value.preview !== undefined && typeof value.preview !== 'boolean') throw new Error('Invalid preview route')
  if (value.projectId !== projectId || !identifier.test(value.releaseId) || !Array.isArray(value.hosts) || !value.hosts.length || value.hosts.length > 11 || value.hosts.some((host) => typeof host !== 'string' || !hostname.test(host)) || !value.hosts.includes(value.primary) || typeof value.suspended !== 'boolean' || !allowedOrigins.has(value.originUrl)) throw new Error('Invalid route')
  return value
}
export async function createHostingAgent({ root, token, originUrl, peers = {}, adminHost = '127.0.0.1', adminPort = 9090, publicHost = '127.0.0.1', publicPort = 8080 }) {
  if (typeof token !== 'string' || token.length < 32) throw new Error('Agent token must be at least 32 characters')
  root = resolve(root)
  const routes = new Map(); const local = new Map()
  const allowedOrigins = new Set([originUrl, ...Object.keys(peers)])
  await mkdir(join(root, 'routes'), { recursive: true }); await mkdir(join(root, 'sites'), { recursive: true })
  const { readdir } = await import('node:fs/promises')
  for (const file of await readdir(join(root, 'routes'))) {
    if (!file.endsWith('.json')) continue
    const route = JSON.parse(await readFile(join(root, 'routes', file), 'utf8'))
    validRoute(route, file.slice(0, -5), allowedOrigins); routes.set(route.projectId, route)
  }
  for (const projectId of await readdir(join(root, 'sites'))) {
    if (!identifier.test(projectId)) continue
    try { const state = JSON.parse(await readFile(join(root, 'sites', projectId, 'current.json'), 'utf8')); validRoute(state, projectId, allowedOrigins); local.set(projectId, state) } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  let queue = Promise.resolve()
  const serialize = (task) => { const next = queue.then(task); queue = next.catch(() => {}); return next }
  const admin = createServer(async (request, response) => {
    if (!equal(request.headers.authorization, `Bearer ${token}`)) return json(response, 401, { error: 'Unauthorized' })
    try {
      const path = new URL(request.url, 'http://agent').pathname
      if (request.method === 'GET' && path === '/health') return json(response, 200, { ok: true })
      const match = path.match(/^\/(sites|routes)\/([a-zA-Z0-9_-]+)(?:\/(activate|releases\/([a-zA-Z0-9_-]+)))?$/)
      if (!match) return json(response, 404, { error: 'Not found' })
      const [, kind, projectId, action, releaseId] = match
      if (request.method === 'GET' && !action) return json(response, 200, (kind === 'routes' ? routes : local).get(projectId) ?? {})
      const bytes = await body(request, releaseId ? 64 * 1024 * 1024 : 64 * 1024)
      await serialize(async () => {
        if (kind === 'sites' && releaseId && request.method === 'PUT') {
          const destination = join(root, 'sites', projectId, 'releases', releaseId)
          try { await stat(join(destination, 'index.html')); return } catch { /* New immutable release. */ }
          const stage = `${destination}.${randomUUID()}.staging`
          await mkdir(stage, { recursive: true })
          try {
            const zip = await JSZip.loadAsync(bytes, { checkCRC32: true })
            const entries = Object.values(zip.files).filter((file) => !file.dir)
            if (!zip.file('index.html') || entries.length > 10000) throw new Error('Invalid archive')
            let total = 0
            for (const file of entries) {
              const name = file.unsafeOriginalName ?? file.name
              if (!name || name.startsWith('/') || name.includes('\\') || name.includes('\0') || name.split('/').some((part) => ['..', '.', ''].includes(part))) throw new Error('Invalid archive path')
              // Reject oversized entries before decompression as well as after it.
              if (file._data?.uncompressedSize > 64 * 1024 * 1024) throw new Error('Entry too large')
              total += file._data?.uncompressedSize ?? 0
              if (total > 256 * 1024 * 1024) throw new Error('Release too large')
              const contents = await file.async('nodebuffer')
              if (contents.length > 64 * 1024 * 1024) throw new Error('Entry too large')
              const path = join(stage, name)
              await mkdir(dirname(path), { recursive: true }); await writeFile(path, contents, { mode: 0o644 })
            }
            await rename(stage, destination)
          } catch (error) { await rm(stage, { recursive: true, force: true }); throw error }
          return
        }
        const value = validRoute(JSON.parse(bytes.toString()), projectId, allowedOrigins)
        if (kind === 'sites' && action === 'activate' && request.method === 'POST') {
          if (value.originUrl !== originUrl) throw new Error('Wrong hosting server')
          for (const existing of local.values()) if (existing.projectId !== projectId && existing.hosts.some((host) => value.hosts.includes(host))) throw new Error('Domain belongs to another website')
          await stat(join(root, 'sites', projectId, 'releases', value.releaseId, 'index.html'))
          await atomicJson(join(root, 'sites', projectId, 'current.json'), value); local.set(projectId, value); return
        }
        if (kind === 'routes' && !action && request.method === 'PUT') {
          for (const existing of routes.values()) if (existing.projectId !== projectId && existing.hosts.some((host) => value.hosts.includes(host))) throw new Error('Domain belongs to another website')
          await atomicJson(join(root, 'routes', `${projectId}.json`), value); routes.set(projectId, value); return
        }
        throw new Error('Unsupported operation')
      })
      json(response, 200, { ok: true })
    } catch { json(response, 400, { error: 'Hosting operation rejected' }) }
  })
  const publicServer = createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return }
      const host = String(request.headers.host ?? '').split(':')[0].toLowerCase()
      let route = [...routes.values()].find((route) => route.hosts.includes(host))
      const peerRequest = equal(request.headers['x-webtummy-peer'], token)
      if (peerRequest) route = [...local.values()].find((route) => route.hosts.includes(host))
      if (!route) { response.writeHead(404, { 'Cache-Control': 'no-store' }); response.end('Website not found'); return }
      if (route.suspended) { response.writeHead(503, { 'Cache-Control': 'no-store', 'Retry-After': '3600', 'X-Robots-Tag': 'noindex' }); response.end('This website is temporarily unavailable.'); return }
      const url = new URL(request.url, 'http://website')
      const path = decodeURIComponent(url.pathname)
      if (route.originUrl !== originUrl) {
        if (peerRequest) throw new Error('Proxy loop')
        const peerToken = peers[route.originUrl]
        if (!peerToken) throw new Error('Unknown pool origin')
        const target = new URL(request.url, `${route.originUrl}/`)
        // Only configured origins are allowed; preserve hostname for tenant selection.
        target.protocol = new URL(route.originUrl).protocol; target.host = new URL(route.originUrl).host
        const proxy = (target.protocol === 'https:' ? httpsRequest : httpRequest)(target, { method: request.method, headers: { host, 'x-webtummy-peer': peerToken }, timeout: 15000 }, (upstream) => {
          response.writeHead(upstream.statusCode ?? 502, upstream.headers); upstream.pipe(response)
        })
        proxy.on('timeout', () => proxy.destroy()); proxy.on('error', () => { if (!response.headersSent) response.writeHead(502, { 'Cache-Control': 'no-store' }); response.end() }); proxy.end(); return
      }
      const current = local.get(route.projectId)
      if (!current || current.releaseId !== route.releaseId) throw new Error('Release unavailable')
      if (path === '/.well-known/webtummy-release') return json(response, 200, { projectId: route.projectId, releaseId: route.releaseId })
      if (path !== '/.well-known/webtummy-release' && route.primary !== host) { response.writeHead(308, { Location: `https://${route.primary}${url.pathname}${url.search}`, 'Cache-Control': 'no-store' }); response.end(); return }
      if (path.includes('\\') || path.includes('\0') || path.split('/').includes('..')) throw new Error('Invalid path')
      const directory = join(root, 'sites', route.projectId, 'releases', route.releaseId)
      let filename = resolve(directory, `.${path}`)
      if (filename !== directory && !filename.startsWith(`${directory}${sep}`)) throw new Error('Invalid path')
      let info
      try {
        info = await stat(filename)
        if (info.isDirectory()) { filename = join(filename, 'index.html'); info = await stat(filename) }
      } catch { response.writeHead(404, { 'Cache-Control': 'no-store' }); response.end('Page not found'); return }
      if (!info.isFile()) throw new Error('Invalid file')
      response.writeHead(200, { 'Content-Type': types[extname(filename)] ?? 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': 'no-cache, must-revalidate', 'X-Content-Type-Options': 'nosniff', ...(route.preview ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}) })
      if (request.method === 'HEAD') response.end(); else createReadStream(filename).on('error', () => response.destroy()).pipe(response)
    } catch { if (!response.headersSent) response.writeHead(400, { 'Cache-Control': 'no-store' }); response.end('Request unavailable') }
  })
  await new Promise((resolve, reject) => { admin.once('error', reject); admin.listen(adminPort, adminHost, resolve) })
  await new Promise((resolve, reject) => { publicServer.once('error', reject); publicServer.listen(publicPort, publicHost, resolve) })
  return { admin, publicServer, close: async () => { await Promise.all([new Promise((resolve) => admin.close(resolve)), new Promise((resolve) => publicServer.close(resolve))]) } }
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const instance = await createHostingAgent({ root: process.env.HOSTING_DATA_DIR ?? '/srv/webtummy', token: process.env.HOSTING_AGENT_TOKEN, originUrl: process.env.HOSTING_ORIGIN_URL, peers: JSON.parse(process.env.HOSTING_POOL_PEERS_JSON ?? '{}'), adminHost: process.env.HOSTING_ADMIN_BIND ?? '127.0.0.1', adminPort: Number(process.env.HOSTING_ADMIN_PORT ?? 9090), publicHost: process.env.HOSTING_PUBLIC_BIND ?? '127.0.0.1', publicPort: Number(process.env.HOSTING_PUBLIC_PORT ?? 8080) })
  console.log('Webtummy hosting agent started')
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => { await instance.close(); process.exit(0) })
}
