'use server'
import { z } from 'zod'
import { AuthError } from 'next-auth'
import { headers } from 'next/headers'
import { prisma, WorkspaceRole } from '@awb/database'
import { signIn, signOut } from '@/auth'
import { appUrl, hashPassword, newToken, rateLimit, tokenHash } from '@/lib/account-security'
import { sendAccountEmail } from '@/lib/account-email'
import { requireUser } from '@/lib/tenancy'
import { revalidatePath } from 'next/cache'

export type AccountResult = { ok?: boolean; message: string }
const emailSchema = z.string().trim().toLowerCase().email().max(254)
const passwordSchema = z.string().min(12, 'Use at least 12 characters for your password.').max(128)
const genericEmailMessage = 'If this address is eligible, an email is on its way. Check your inbox and spam folder.'
async function limit(email: string) {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  await rateLimit(`account-ip:${ip}`, 30)
  await rateLimit(`account-email:${email}`, 5)
}
async function mailToken(email: string, purpose: 'verify' | 'reset') {
  const token = newToken()
  const hashed = tokenHash(token)
  await prisma.verificationToken.create({ data: { identifier: `${purpose}:${email}`, token: hashed, expires: new Date(Date.now() + 60 * 60000) } })
  try { await sendAccountEmail(email, purpose === 'verify' ? 'Verify your Webtummy account' : 'Set your Webtummy password', `${purpose === 'verify' ? 'Confirm your email address' : 'Set a new password'} using this link. It expires in one hour:\n${appUrl()}/${purpose === 'verify' ? 'verify-email' : 'reset-password'}?token=${token}\n\nIf you did not request this, you can ignore this email.`) }
  catch (error) { await prisma.verificationToken.deleteMany({ where: { token: hashed } }); throw error }
}
function message(error: unknown): AccountResult {
  if (error instanceof z.ZodError) return { message: error.issues[0]?.message ?? 'Check your details.' }
  if (error instanceof Error && /^(Too many|Account email|We could not)/.test(error.message)) return { message: error.message }
  return { message: 'Unable to complete this request. Please try again.' }
}
export async function registerAccount(_previous: AccountResult, form: FormData): Promise<AccountResult> {
  try {
    const email = emailSchema.parse(form.get('email'))
    const name = z.string().trim().min(2).max(100).parse(form.get('name'))
    const password = passwordSchema.parse(form.get('password'))
    await limit(email)
    const existing = await prisma.user.findUnique({ where: { email } })
    if (!existing) {
      const passwordHash = await hashPassword(password)
      await prisma.user.create({ data: { email, name, passwordHash, emailContact: { create: { optedIn: form.get('marketingConsent') === 'on', consentAt: form.get('marketingConsent') === 'on' ? new Date() : null } }, memberships: { create: { role: WorkspaceRole.OWNER, workspace: { create: { name: `${name}'s workspace`, slug: `workspace-${newToken().slice(0, 16)}` } } } } } })
      await mailToken(email, 'verify')
    } else if (!existing.emailVerified && !existing.suspendedAt) await mailToken(email, 'verify')
    return { ok: true, message: genericEmailMessage }
  } catch (error) { return message(error) }
}
export async function loginAccount(_previous: AccountResult, form: FormData): Promise<AccountResult> {
  try { await signIn('password', { email: form.get('email'), password: form.get('password'), redirectTo: '/dashboard' }); return { message: '' } }
  catch (error) { if (error instanceof AuthError) return { message: 'Unable to sign in. Check your email and password, verify your email, or use password recovery.' }; throw error }
}
export async function requestPasswordReset(_previous: AccountResult, form: FormData): Promise<AccountResult> {
  try {
    const email = emailSchema.parse(form.get('email')); await limit(email)
    const user = await prisma.user.findUnique({ where: { email } })
    if (user && !user.suspendedAt) await mailToken(email, 'reset')
    return { ok: true, message: genericEmailMessage }
  } catch (error) { return message(error) }
}
export async function finishAccountToken(_previous: AccountResult, form: FormData): Promise<AccountResult> {
  try {
    const purpose = z.enum(['verify', 'reset']).parse(form.get('purpose'))
    const token = z.string().regex(/^[a-f0-9]{64}$/).parse(form.get('token'))
    const passwordHash = purpose === 'reset' ? await hashPassword(passwordSchema.parse(form.get('password'))) : undefined
    await prisma.$transaction(async tx => {
      const record = await tx.verificationToken.findUnique({ where: { token: tokenHash(token) } })
      if (!record || record.expires < new Date() || !record.identifier.startsWith(`${purpose}:`)) throw new Error('Expired token')
      const consumed = await tx.verificationToken.deleteMany({ where: { token: record.token, expires: { gt: new Date() } } })
      if (consumed.count !== 1) throw new Error('Used token')
      await tx.user.update({ where: { email: record.identifier.slice(purpose.length + 1), suspendedAt: null }, data: { emailVerified: new Date(), ...(passwordHash ? { passwordHash, sessionVersion: { increment: 1 } } : {}) } })
      if (passwordHash) await tx.verificationToken.deleteMany({ where: { identifier: record.identifier } })
    })
    return { ok: true, message: purpose === 'verify' ? 'Email verified. You can now sign in and choose a plan.' : 'Password updated. Sign in with your new password.' }
  } catch { return { message: 'This link has expired or was already used. Request a new link, and use a password with 12–128 characters.' } }
}
export async function updateProfile(_previous: AccountResult, form: FormData): Promise<AccountResult> {
  try { const user = await requireUser(); const name = z.string().trim().min(2).max(100).parse(form.get('name')); await prisma.user.update({ where: { id: user.id }, data: { name } }); revalidatePath('/account'); return { ok: true, message: 'Profile updated.' } }
  catch (error) { return message(error) }
}
export async function logoutAccount() { await signOut({ redirectTo: '/signin' }) }

export async function socialSignIn(_previous: AccountResult, form: FormData): Promise<AccountResult> {
  const provider = z.enum(['google', 'microsoft-entra-id']).safeParse(form.get('provider'))
  if (!provider.success) return { message: 'Choose a supported sign-in provider.' }
  const available = provider.data === 'google' ? !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) : !!(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET)
  if (!available) return { message: 'This sign-in option is not configured yet.' }
  try { await signIn(provider.data, { redirectTo: '/dashboard' }); return { message: '' } }
  catch (error) { if (error instanceof AuthError) return { message: 'Could not start social sign-in. Please try again.' }; throw error }
}
