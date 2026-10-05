import { redirect } from 'next/navigation'
import { prisma } from '@awb/database'
import { editingAccess } from '@/lib/billing/access'
import { currentUser, primaryWorkspace } from '@/lib/tenancy'
import { OnboardingWizard } from './onboarding-wizard'
import { AppShell } from '@/components/account/app-shell'

export default async function OnboardingPage() {
  const user = await currentUser()

  if (!user) {
    redirect('/signin')
  }

  const workspace = await primaryWorkspace(user.id)
  if (!workspace || !editingAccess(workspace)) redirect('/billing')
  const membership = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } } })
  if (membership?.role === 'VIEWER') redirect('/dashboard')
  if (!workspace.billingExempt) {
    const plan = workspace.billingPlanId ? await prisma.billingPlan.findUnique({ where: { id: workspace.billingPlanId } }) : null
    if (await prisma.project.count({ where: { workspaceId: workspace.id } }) >= (plan?.websiteLimit ?? 0)) redirect('/billing')
  }
  return <AppShell title="Create a website" active="/dashboard"><OnboardingWizard /></AppShell>
}
