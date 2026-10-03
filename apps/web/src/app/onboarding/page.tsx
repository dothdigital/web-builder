import { redirect } from 'next/navigation'
import { prisma } from '@awb/database'
import { paidAccess, editingAccess } from '@/lib/billing/access'
import { currentUser, primaryWorkspace } from '@/lib/tenancy'
import { OnboardingWizard } from './onboarding-wizard'

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
    if (await prisma.project.count({ where: { workspaceId: workspace.id } }) >= (paidAccess(workspace) ? plan?.websiteLimit ?? 0 : workspace.trialWebsiteLimit)) redirect('/billing')
  }
  return <OnboardingWizard />
}
