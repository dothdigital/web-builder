import { notFound } from 'next/navigation'
import { requireProject } from '@/lib/tenancy'
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

  await requireProject(id)

  if (!correlationId) {
    notFound()
  }

  return <ProgressView key={`${id}:${correlationId}`} projectId={id} correlationId={correlationId} />
}
