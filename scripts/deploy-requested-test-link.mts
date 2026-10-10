import React from 'react'
import dotenv from 'dotenv'
dotenv.config({ path: '.env', quiet: true })
;(globalThis as any).React = React
const { prisma } = await import('@awb/database')
const { billingLifecycle } = await import('@awb/database/billing-policy')
try {
  const { deployPreview } = await import('../apps/web/src/lib/hosting/preview')
  const { withHostingLock } = await import('../apps/web/src/lib/hosting/service')
  const id = 'cmv16xtt2000715nrx0e817em'
  const project = await prisma.project.findUniqueOrThrow({ where: { id }, include: { workspace: true } })
  if (!billingLifecycle(project.workspace).hosting) throw new Error('This workspace does not currently have hosting access.')
  const owner = await prisma.workspaceMember.findFirstOrThrow({ where: { workspaceId: project.workspaceId, role: 'OWNER' } })
  console.log(JSON.stringify(await withHostingLock(id, () => deployPreview(id, owner.userId))))
} finally { await prisma.$disconnect() }
