import { prisma } from '@awb/database'
import { newToken } from './account-security'
export function socialAvailability() {
  return { google: !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET), microsoft: !!(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) }
}
export async function ensureAccountWorkspace(userId: string) {
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } })
    if (user.suspendedAt) throw new Error('Account suspended')
    if (user.isPlatformAdmin || user.isPlatformSupport) await tx.workspace.updateMany({ where: { billingExempt: false, members: { some: { userId, role: 'OWNER' } } }, data: { billingExempt: true, billingExemptionReason: 'staff' } })
    if (await tx.workspaceMember.findFirst({ where: { userId } })) return
    await tx.workspace.create({ data: { name: `${user.name ?? 'My'} workspace`, slug: `workspace-${newToken().slice(0, 16)}`, ...((user.isPlatformAdmin || user.isPlatformSupport) ? { billingExempt: true, billingExemptionReason: 'staff' } : {}), members: { create: { userId, role: 'OWNER' } } } })
  })
}
