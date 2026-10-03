import { prisma } from '@awb/database'
import { currentUser } from '@/lib/tenancy'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const user = await currentUser()
  if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 })
  const projectId = new URL(request.url).searchParams.get('projectId')
  const jobs = await prisma.contentJob.findMany({ where: { ...(projectId ? { projectId } : {}), status: { in: ['QUEUED', 'RUNNING', 'READY', 'FAILED'] }, project: { workspace: { members: { some: { userId: user.id } } } } }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, projectId: true, title: true, kind: true, status: true, error: true, createdAt: true, emailStatus: true } })
  return Response.json({ jobs }, { headers: { 'Cache-Control': 'private, no-store' } })
}
