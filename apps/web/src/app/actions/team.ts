'use server'
import { CUSTOMER_TEAMS_ENABLED } from '@/lib/features'
import { requirePaidWorkspace } from '@/lib/billing/access'
import { prisma, WorkspaceRole } from '@awb/database'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireUser, requireWorkspace, primaryWorkspace } from '@/lib/tenancy'
import { newToken, tokenHash, rateLimit, appUrl } from '@/lib/account-security'
import { sendAccountEmail } from '@/lib/account-email'
export async function switchWorkspace(form: FormData) {
  const id = z.string().min(1).parse(form.get('workspaceId')); await requireWorkspace(id)
  ;(await cookies()).set('awb-workspace', id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' })
  redirect('/dashboard')
}
export async function inviteMember(_previous: { message: string }, form: FormData) {
  if (!CUSTOMER_TEAMS_ENABLED) return { message: 'Customer accounts are individual. Team access is currently unavailable.' }
  try {
    const user = await requireUser(); const workspace = await primaryWorkspace(user.id); if (!workspace) throw new Error()
    await requireWorkspace(workspace.id, WorkspaceRole.OWNER); await requirePaidWorkspace(workspace.id); await rateLimit(`invite:${user.id}`, 15, 60)
    const email = z.string().trim().toLowerCase().email().max(254).parse(form.get('email'))
    const role = z.enum(['EDITOR', 'VIEWER']).parse(form.get('role'))
    const token = newToken(), hashed = tokenHash(token)
    await prisma.workspaceInvitation.upsert({ where: { workspaceId_email: { workspaceId: workspace.id, email } }, create: { workspaceId: workspace.id, email, role, tokenHash: hashed, expiresAt: new Date(Date.now() + 7 * 86400000) }, update: { role, tokenHash: hashed, expiresAt: new Date(Date.now() + 7 * 86400000) } })
    try { await sendAccountEmail(email, `Invitation to ${workspace.name}`, `${user.name ?? user.email} invited you to join ${workspace.name} as ${role.toLowerCase()}. Sign in with ${email} to accept:\n${appUrl()}/invite?token=${token}\n\nThis invitation expires in seven days.`) }
    catch (error) { await prisma.workspaceInvitation.deleteMany({ where: { tokenHash: hashed } }); throw error }
    revalidatePath('/team'); return { message: 'Invitation sent.' }
  } catch { return { message: 'Unable to send the invitation. Check your access and email delivery settings.' } }
}
export async function acceptInvitation(_previous: { message: string }, form: FormData) {
  if (!CUSTOMER_TEAMS_ENABLED) return { message: 'Customer accounts are individual. Team access is currently unavailable.' }
  try {
    const user = await requireUser(); const token = z.string().regex(/^[a-f0-9]{64}$/).parse(form.get('token'))
    const workspaceId = await prisma.$transaction(async tx => {
      const invitation = await tx.workspaceInvitation.findUnique({ where: { tokenHash: tokenHash(token) } })
      if (!invitation || invitation.email !== user.email || invitation.expiresAt < new Date()) throw new Error()
      const consumed = await tx.workspaceInvitation.deleteMany({ where: { id: invitation.id } }); if (!consumed.count) throw new Error()
      await tx.workspaceMember.upsert({ where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } }, create: { workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role }, update: {} })
      return invitation.workspaceId
    })
    ;(await cookies()).set('awb-workspace', workspaceId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' })
  } catch { return { message: 'Invitation expired, already used, or belongs to a different email address.' } }
  redirect('/dashboard')
}
export async function changeMember(_previous: { message: string }, form: FormData) {
  if (!CUSTOMER_TEAMS_ENABLED) return { message: 'Customer accounts are individual. Team access is currently unavailable.' }
  try {
    const user = await requireUser(); const workspace = await primaryWorkspace(user.id); if (!workspace) throw new Error()
    await requireWorkspace(workspace.id, WorkspaceRole.OWNER)
    await requirePaidWorkspace(workspace.id)
    const id = z.string().min(1).parse(form.get('id')); const role = z.enum(['EDITOR', 'VIEWER', 'REMOVE']).parse(form.get('role'))
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${workspace.id} FOR UPDATE`
      const member = await tx.workspaceMember.findUniqueOrThrow({ where: { id } })
      if (member.workspaceId !== workspace.id || member.role === 'OWNER' || member.userId === user.id) throw new Error()
      if (role === 'REMOVE') await tx.workspaceMember.delete({ where: { id } })
      else await tx.workspaceMember.update({ where: { id }, data: { role } })
      await tx.auditEvent.create({ data: { actorId: user.id, workspaceId: workspace.id, action: 'team.member.update', targetId: member.userId, metadata: { role } } })
    })
    revalidatePath('/team'); return { message: 'Team updated.' }
  } catch { return { message: 'Unable to change this member. Workspace owners cannot be removed here.' } }
}
export async function revokeInvitation(_previous: { message: string }, form: FormData) {
  if (!CUSTOMER_TEAMS_ENABLED) return { message: 'Customer accounts are individual. Team access is currently unavailable.' }
  const user = await requireUser(); const workspace = await primaryWorkspace(user.id); if (!workspace) return { message: 'Workspace not found.' }
  await requireWorkspace(workspace.id, WorkspaceRole.OWNER)
  await prisma.workspaceInvitation.deleteMany({ where: { id: String(form.get('id')), workspaceId: workspace.id } }); revalidatePath('/team'); return { message: 'Invitation revoked.' }
}
