import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from './env'

export interface StoredObject {
  key: string
  url: string
  checksum: string
  bytes: number
  contentType: string
}

export interface Storage {
  readonly driver: 's3' | 'local'
  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>
  /// Browser uploads go straight to storage; the server never proxies bytes.
  presignUpload(key: string, contentType: string): Promise<{ uploadUrl: string; publicUrl: string } | undefined>
  publicUrl(key: string): string
  readUrl(key: string): Promise<string>
}

function checksumOf(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex')
}

class S3Storage implements Storage {
  readonly driver = 's3' as const

  private readonly client: S3Client

  private readonly bucket: string

  constructor(bucket: string) {
    const config = env()
    this.bucket = bucket
    this.client = new S3Client({
      region: config.S3_REGION,
      ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT, forcePathStyle: true } : {}),
      ...(config.S3_ACCESS_KEY_ID && config.S3_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: config.S3_ACCESS_KEY_ID,
              secretAccessKey: config.S3_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    })
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    )

    return { key, url: this.publicUrl(key), checksum: checksumOf(body), bytes: body.byteLength, contentType }
  }

  async presignUpload(key: string, contentType: string) {
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: 900 },
    )

    return { uploadUrl, publicUrl: this.publicUrl(key) }
  }

  async readUrl(key: string): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: 3600 })
  }

  publicUrl(key: string): string {
    const base = env().S3_PUBLIC_BASE_URL
    return base ? `${base.replace(/\/$/, '')}/${key}` : `https://${this.bucket}.s3.amazonaws.com/${key}`
  }
}

/// Used when no bucket is configured so the whole asset pipeline still works
/// locally. Files land under the upload dir and are served by the web app.
class LocalStorage implements Storage {
  readonly driver = 'local' as const

  private readonly root: string

  constructor(root: string) {
    this.root = localUploadRoot(root)
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    const target = path.join(this.root, key)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, body)

    return { key, url: this.publicUrl(key), checksum: checksumOf(body), bytes: body.byteLength, contentType }
  }

  async presignUpload(): Promise<undefined> {
    return undefined
  }

  async readUrl(key: string): Promise<string> {
    return this.publicUrl(key)
  }

  publicUrl(key: string): string {
    return `/uploads/${key}`
  }
}

let storage: Storage | undefined

export function getStorage(): Storage {
  if (!storage) {
    const config = env()
    storage = config.S3_BUCKET ? new S3Storage(config.S3_BUCKET) : new LocalStorage(config.LOCAL_UPLOAD_DIR)
  }

  return storage
}

/// The web app and the worker run from different working directories, so a
/// relative upload dir is anchored to the workspace root they share.
export function localUploadRoot(root: string = env().LOCAL_UPLOAD_DIR): string {
  return path.isAbsolute(root) ? root : path.join(repositoryRoot(), root)
}

function repositoryRoot(): string {
  let current = process.cwd()

  while (current !== path.dirname(current)) {
    if (existsSync(path.join(current, 'turbo.json'))) {
      return current
    }

    current = path.dirname(current)
  }

  return process.cwd()
}

export function assetKey(workspaceId: string, projectId: string, filename: string): string {
  const extension = path.extname(filename) || ''
  const safeName = path.basename(filename, extension).replace(/[^a-z0-9-]+/gi, '-').toLowerCase()

  return `workspaces/${workspaceId}/projects/${projectId}/${randomUUID()}-${safeName}${extension}`
}
