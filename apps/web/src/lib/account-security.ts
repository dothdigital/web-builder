import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { prisma } from '@awb/database'
const derive = promisify(scrypt)
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex')
export const newToken = () => randomBytes(32).toString('hex')
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const key = await derive(password, salt, 64) as Buffer
  return `scrypt:${salt}:${key.toString('hex')}`
}
export async function verifyPassword(password: string, stored: string | null) {
  const [, salt, hex] = (stored ?? '').split(':')
  const key = await derive(password, salt || 'webtummy-dummy-salt', 64) as Buffer
  const expected = Buffer.from(hex || '00'.repeat(64), 'hex')
  return !!stored && expected.length === key.length && timingSafeEqual(key, expected)
}
export async function rateLimit(identity: string, limit = 10, windowMinutes = 15) {
  const window = Math.floor(Date.now() / (windowMinutes * 60000))
  const key = tokenHash(`${identity}:${window}`)
  const result = await prisma.authRateLimit.upsert({ where: { key }, create: { key, expiresAt: new Date((window + 2) * windowMinutes * 60000) }, update: { count: { increment: 1 } } })
  if (result.count > limit) throw new Error('Too many attempts. Please try again later.')
  // Opportunistically prune expired buckets; never log identities or tokens.
  if (result.count === 1) await prisma.authRateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } })
}
export function appUrl() {
  const raw = process.env.PUBLIC_APP_URL || process.env.AUTH_URL || (process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : '')
  if (!raw) throw new Error('The application URL is not configured.')
  const url = new URL(raw)
  if (url.username || url.password || !['http:', 'https:'].includes(url.protocol) || process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('A secure application URL is required.')
  return url.origin
}
