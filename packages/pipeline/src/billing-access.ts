import { prisma } from '@awb/database'
import { billingLifecycle } from '@awb/database/billing-policy'
export async function canGenerate(projectId: string, contentJobId?: string) {
  if (contentJobId) {
    const job = await prisma.contentJob.findFirst({ where: { id: contentJobId, projectId }, select: { requestedBy: true } })
    const actor = job && await prisma.user.findUnique({ where: { id: job.requestedBy }, select: { isPlatformAdmin: true, isPlatformSupport: true, suspendedAt: true } })
    if (actor && !actor.suspendedAt && (actor.isPlatformAdmin || actor.isPlatformSupport)) return true
  }
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { workspace: true } })
  return billingLifecycle(project.workspace).editing
}
