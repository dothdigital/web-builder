import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

function key(purpose = 'recaptcha') {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret === 'development-secret-change-me') throw new Error('A private AUTH_SECRET is required before saving integration credentials.')
  return createHash('sha256').update(`awb-${purpose}:${secret}`).digest()
}
export function encryptRecaptchaSecret(value: string, purpose = 'recaptcha') {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(purpose), iv)
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64')).join('.')
}
export function decryptRecaptchaSecret(value: string, purpose = 'recaptcha') {
  const [iv, tag, data] = value.split('.').map((part) => Buffer.from(part, 'base64'))
  const decipher = createDecipheriv('aes-256-gcm', key(purpose), iv!)
  decipher.setAuthTag(tag!)
  return Buffer.concat([decipher.update(data!), decipher.final()]).toString('utf8')
}
export async function verifyRecaptcha(secret: string, token: string, hostnames: string[]) {
  if (!token || !hostnames.length) return false
  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST', body: new URLSearchParams({ secret, response: token }), signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return false
    const result = await response.json() as { success?: boolean; hostname?: string }
    return result.success === true && !!result.hostname && hostnames.includes(result.hostname.toLowerCase())
  } catch { return false }
}
