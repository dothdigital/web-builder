import { notFound } from 'next/navigation'
import { requireProjectOnPage } from '@/lib/tenancy'
import { AppShell } from '@/components/account/app-shell'
import { ProgressView } from './progress-view'

export default async function ProgressPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ correlationId?: string }>
}) {
  const { id } = await params
  const { correlationId } = await searchParams

  await requireProjectOnPage(id)

  if (!correlationId) {
    notFound()
  }

  return (
    <AppShell title="Website generation" active="/dashboard">
      <ProgressView key={`${id}:${correlationId}`} projectId={id} correlationId={correlationId} />
    </AppShell>
  )
}
