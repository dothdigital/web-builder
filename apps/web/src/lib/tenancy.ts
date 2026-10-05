import { WorkspaceRole, prisma } from '@awb/database'
import { redirect, notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { requirePaidWorkspace } from './billing/access'

export class AuthorizationError extends Error {
  constructor(message = 'Not authorized') {
    super(message)
  }
}

export interface SessionUser {
  id: string
  email: string
  name: string | null
  isPlatformAdmin: boolean
}

export async function currentUser(): Promise<SessionUser | undefined> {
  const session = await auth()
  const id = session?.user?.id

  if (!id) {
    return undefined
  }

  const user = await prisma.user.findUnique({ where: { id } })

  return user && !user.suspendedAt ? { id: user.id, email: user.email, name: user.name, isPlatformAdmin: user.isPlatformAdmin } : undefined
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser()

  if (!user) {
    throw new AuthorizationError('Sign in required')
  }

  return user
}

const roleRank: Record<WorkspaceRole, number> = {
  [WorkspaceRole.VIEWER]: 0,
  [WorkspaceRole.EDITOR]: 1,
  [WorkspaceRole.OWNER]: 2,
}

/// Every protected read and write goes through one of these helpers: tenant
/// isolation is enforced server-side, never by hiding UI.
export async function requireWorkspace(workspaceId: string, minimumRole: WorkspaceRole = WorkspaceRole.VIEWER) {
  const user = await requireUser()
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  })

  if (!membership || roleRank[membership.role] < roleRank[minimumRole]) {
    throw new AuthorizationError('You do not have access to this workspace')
  }

  return { user, membership }
}

export async function requireProject(projectId: string, minimumRole: WorkspaceRole = WorkspaceRole.VIEWER) {
  const user = await requireUser()
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { workspace: { include: { members: { where: { userId: user.id } } } } },
  })

  const membership = project?.workspace.members[0]

  // Platform administrators can support any customer's website without joining
  // their workspace or changing the customer's subscription or membership.
  if (project && user.isPlatformAdmin) {
    return { user, project, role: WorkspaceRole.OWNER }
  }

  if (!project || !membership || roleRank[membership.role] < roleRank[minimumRole]) {
    throw new AuthorizationError('You do not have access to this project')
  }

  if (project.workspace.status !== 'ACTIVE') throw new AuthorizationError('This workspace is suspended')
  if (minimumRole !== WorkspaceRole.VIEWER) await requirePaidWorkspace(project.workspaceId)
  return { user, project, role: membership.role }
}

export async function primaryWorkspace(userId: string) {
  const activeId = (await cookies()).get('awb-workspace')?.value
  if (activeId) {
    const active = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: activeId, userId } }, include: { workspace: true } })
    if (active) return active.workspace
  }
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  })

  return membership?.workspace
}

export async function requirePageUser() {
  const user = await currentUser()
  if (!user) redirect('/signin')
  return user
}

export async function requireAdmin() {
  const user = await requirePageUser()
  if (!user.isPlatformAdmin) notFound()
  return user
}
