import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import JSZip from 'jszip'
import { assertHostingConfigured } from './config'
export function websiteStoragePrefix(slug: string, projectId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error('Invalid project identifier')
  const name = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'website'
  return `webtummy-website/${name}-${projectId}`
}
const types: Record<string, string> = { html: 'text/html; charset=utf-8', css: 'text/css', js: 'application/javascript', json: 'application/json', xml: 'application/xml', txt: 'text/plain', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', gif: 'image/gif', ico: 'image/x-icon', woff2: 'font/woff2' }
export async function storeRelease(prefix: string, releaseId: string, archive: Buffer) {
  const config = assertHostingConfigured()
  if (!/^webtummy-website\/[a-zA-Z0-9_-]+$/.test(prefix) || !/^[a-zA-Z0-9_-]+$/.test(releaseId)) throw new Error('Invalid release storage path')
  const accessKeyId = process.env.HOSTING_S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.HOSTING_S3_SECRET_ACCESS_KEY
  const client = new S3Client({ region: config.region, ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}) })
  const base = `${prefix}/releases/${releaseId}`
  const zip = await JSZip.loadAsync(archive)
  const files = Object.values(zip.files).filter((file) => !file.dir)
  if (!zip.file('index.html') || files.length > 10000) throw new Error('Invalid website release')
  for (let i = 0; i < files.length; i += 8) await Promise.all(files.slice(i, i + 8).map(async (file) => {
    if (file.name.startsWith('/') || file.name.includes('\\') || file.name.split('/').some((part) => part === '..' || part === '.')) throw new Error('Invalid release file')
    await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: `${base}/${file.name}`, Body: await file.async('nodebuffer'), ContentType: types[file.name.split('.').pop() ?? ''] ?? 'application/octet-stream' }))
  }))
  // Internal deployment archive for restoration/migration; never exposed as a customer export.
  await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: `${base}/_deployment/site.zip`, Body: archive, ContentType: 'application/zip' }))
  return base
}
