export const BILLING_DAY = 86400000
export const GRACE_DAYS = 7
export const HOSTING_GRACE_DAYS = 30
export const RETENTION_DAYS = 90
export type BillingAccess = {
  status: string; billingExempt: boolean; billingStatus: string; billingPlanId: string | null;
  billingPaidThrough?: Date | null; billingPeriodEnd: Date | null; billingDelinquentSince?: Date | null;
  billingSubscriptionEndedAt?: Date | null; billingSuspendedAt?: Date | null; billingRetentionEndsAt?: Date | null;
  billingCancellationReason?: string | null; billingLegalHold?: boolean
}
export function billingLifecycle(workspace: BillingAccess, now = new Date()) {
  const result = (phase: 'ACTIVE' | 'GRACE' | 'PAST_DUE' | 'SUSPENDED' | 'PAYMENT_REQUIRED', editing: boolean, hosting: boolean, suspendAt: Date | null = null) => {
    const retentionEndsAt = suspendAt ? workspace.billingRetentionEndsAt ?? new Date(suspendAt.getTime() + RETENTION_DAYS * BILLING_DAY) : null
    return { phase, editing, hosting, suspendAt, retentionEndsAt, deletionEligible: !!retentionEndsAt && now >= retentionEndsAt && !workspace.billingLegalHold }
  }
  if (workspace.status !== 'ACTIVE') return result('SUSPENDED', false, false)
  if (workspace.billingExempt) return result('ACTIVE', true, true)
  const paidThrough = workspace.billingPaidThrough
  if (workspace.billingPlanId && workspace.billingStatus === 'active' && paidThrough && paidThrough > now) return result('ACTIVE', true, true)
  if (!paidThrough || !workspace.billingPlanId) return result('PAYMENT_REQUIRED', false, false)
  if (['past_due', 'unpaid', 'active'].includes(workspace.billingStatus) || workspace.billingStatus === 'canceled' && workspace.billingCancellationReason === 'payment_failed') {
    const since = workspace.billingDelinquentSince ?? paidThrough
    const age = now.getTime() - since.getTime()
    if (age < GRACE_DAYS * BILLING_DAY) return result('GRACE', true, true)
    if (age < HOSTING_GRACE_DAYS * BILLING_DAY) return result('PAST_DUE', false, true)
    return result('SUSPENDED', false, false, new Date(since.getTime() + HOSTING_GRACE_DAYS * BILLING_DAY))
  }
  return result('SUSPENDED', false, false, workspace.billingSubscriptionEndedAt ?? workspace.billingSuspendedAt ?? now)
}
