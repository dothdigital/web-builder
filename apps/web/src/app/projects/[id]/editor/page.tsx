import Link from 'next/link'
import { redirect } from 'next/navigation'
import { editingAccess } from '@/lib/billing/access'
import { prisma, WorkspaceRole } from '@awb/database'
import { requireProject } from '@/lib/tenancy'
import { loadDraftModel } from '@/lib/website'
import { EditorShell } from './editor-shell'

export const dynamic = 'force-dynamic'

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { project, role } = await requireProject(id)
  if (role === WorkspaceRole.VIEWER || !editingAccess(project.workspace)) redirect('/billing?reason=trial-ended')
  await requireProject(id, WorkspaceRole.EDITOR)

  const model = await loadDraftModel(id)

  if (!model) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-xl font-semibold">Nothing to edit yet</h1>
        <p className="mt-2 text-sm text-neutral-600">
          This project has no generated website. Start a generation run and the editor opens automatically when it
          finishes.
        </p>
        <Link href="/dashboard" className="mt-6 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm text-white">
          Back to websites
        </Link>
      </main>
    )
  }

  const assets = await prisma.asset.findMany({ where: { projectId: id }, select: { url: true } })
  const imageUrls = Object.fromEntries(assets.map(({ url }) => [url, `/api/projects/${id}/editor-image?url=${encodeURIComponent(url)}`]))
  return <EditorShell projectId={id} initialModel={model} imageUrls={imageUrls} />
}
