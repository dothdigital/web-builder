import { prisma } from '@awb/database'
import { currentUser, requireProject, withApiAuthorization } from '@/lib/tenancy'
export const dynamic = 'force-dynamic'
async function handleGET(request: Request) {
  const user = await currentUser()
  if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 })
  const projectId = new URL(request.url).searchParams.get('projectId')
  if (projectId) await requireProject(projectId)
  const jobs = await prisma.contentJob.findMany({ where: { ...(projectId ? { projectId } : {}), status: { in: ['QUEUED', 'RUNNING', 'READY', 'FAILED'] }, ...(projectId ? {} : { project: { workspace: { status: 'ACTIVE', members: { some: { userId: user.id } } } } }) }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, projectId: true, title: true, kind: true, status: true, error: true, createdAt: true, emailStatus: true } })
  return Response.json({ jobs }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export const GET = withApiAuthorization(handleGET)
