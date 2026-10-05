import { WorkspaceRole, prisma } from '@awb/database'
import { redirect, notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { requirePaidWorkspace, BillingAccessError } from './billing/access'

export class AuthorizationError extends Error {
  constructor(message = 'Not authorized', public readonly status = 403) {
    super(message)
  }
}

export interface SessionUser {
  id: string
  email: string
  name: string | null
  isPlatformAdmin: boolean
  isPlatformSupport: boolean
}

export async function currentUser(): Promise<SessionUser | undefined> {
  const session = await auth()
  const id = session?.user?.id

  if (!id) {
    return undefined
  }

  const user = await prisma.user.findUnique({ where: { id } })

  return user && !user.suspendedAt ? { id: user.id, email: user.email, name: user.name, isPlatformAdmin: user.isPlatformAdmin, isPlatformSupport: user.isPlatformSupport } : undefined
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser()

  if (!user) {
    throw new AuthorizationError('Sign in required', 401)
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
    include: { workspace: { select: { status: true } } },
  })

  if (!membership || membership.workspace.status !== 'ACTIVE' || roleRank[membership.role] < roleRank[minimumRole]) {
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
  if (project && (user.isPlatformAdmin || user.isPlatformSupport)) {
    return { user, project, role: user.isPlatformAdmin ? WorkspaceRole.OWNER : WorkspaceRole.EDITOR }
  }

  if (!project || !membership || roleRank[membership.role] < roleRank[minimumRole]) {
    throw new AuthorizationError('You do not have access to this project')
  }

  if (project.workspace.status !== 'ACTIVE') throw new AuthorizationError('This workspace is suspended')
  if (minimumRole !== WorkspaceRole.VIEWER) await requirePaidWorkspace(project.workspaceId)
  return { user, project, role: membership.role }
}

export async function primaryWorkspace(userId: string) {
  const staff = await prisma.user.findUnique({ where: { id: userId }, select: { isPlatformAdmin: true, isPlatformSupport: true, suspendedAt: true } })
  if (staff && !staff.suspendedAt && (staff.isPlatformAdmin || staff.isPlatformSupport)) await prisma.workspace.updateMany({ where: { billingExempt: false, members: { some: { userId, role: 'OWNER' } } }, data: { billingExempt: true, billingExemptionReason: 'staff' } })
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

export async function requireProjectOnPage(projectId: string, minimumRole: WorkspaceRole = WorkspaceRole.VIEWER) {
  try { return await requireProject(projectId, minimumRole) }
  catch (error) {
    if (error instanceof BillingAccessError) redirect('/billing?reason=payment-required')
    if (error instanceof AuthorizationError) {
      if (error.status === 401) redirect('/signin')
      notFound()
    }
    throw error
  }
}

export async function requireSupport() {
  const user = await requirePageUser()
  if (!user.isPlatformAdmin && !user.isPlatformSupport) notFound()
  return user
}

export function withApiAuthorization<T extends unknown[]>(handler: (...args: T) => Promise<Response>) {
  return async (...args: T): Promise<Response> => {
    try { return await handler(...args) }
    catch (error) {
      if (error instanceof BillingAccessError) return Response.json({ error: error.message, code: 'WT-BILLING-001', billingUrl: '/billing' }, { status: 402, headers: { 'Cache-Control': 'no-store' } })
      if (error instanceof AuthorizationError) return Response.json({ error: error.status === 401 ? 'Sign in required' : 'Access denied' }, { status: error.status, headers: { 'Cache-Control': 'no-store' } })
      throw error
    }
  }
}
