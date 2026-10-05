import { prisma } from '@awb/database'

export async function generationProgressHref(projectId: string): Promise<string> {
  const [content, stage] = await Promise.all([
    prisma.contentJob.findFirst({ where: { projectId, kind: 'WEBSITE' }, orderBy: { createdAt: 'desc' }, select: { id: true, createdAt: true } }),
    prisma.generationJob.findFirst({ where: { projectId }, orderBy: { createdAt: 'desc' }, select: { correlationId: true, createdAt: true } }),
  ])
  const correlationId = content && (!stage || content.createdAt >= stage.createdAt) ? content.id : stage?.correlationId
  return correlationId ? `/projects/${projectId}/progress?correlationId=${encodeURIComponent(correlationId)}` : '/dashboard'
}
