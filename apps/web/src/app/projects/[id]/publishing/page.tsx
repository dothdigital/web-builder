import { ErrorNotice } from '@/components/error-notice'
import Link from 'next/link'
import { paidAccess } from '@/lib/billing/access'
import { redirect, notFound } from 'next/navigation'
import { prisma, WorkspaceRole } from '@awb/database'
import { requireProjectOnPage, AuthorizationError } from '@/lib/tenancy'
import { hostingConfig } from '@/lib/hosting/config'
import { PublishingControls, CopyDns } from './controls'
export const dynamic = 'force-dynamic'

export default async function PublishingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, project, role } = await requireProjectOnPage(id).catch((error: unknown) => {
    if (error instanceof AuthorizationError) { if (error.message === 'Sign in required') redirect('/signin'); notFound() }
    throw error
  })
  if (user.isPlatformSupport && !user.isPlatformAdmin) redirect(`/projects/${id}/editor`)
  if (!paidAccess(project.workspace)) redirect('/billing?reason=live-domain')
  const config = hostingConfig()
  const [site, domains, releases] = await Promise.all([
    prisma.hostingSite.findUnique({ where: { projectId: id } }),
    prisma.domain.findMany({ where: { projectId: id }, orderBy: { createdAt: 'asc' } }),
    prisma.publishRelease.findMany({ where: { projectId: id, isPreview: false }, orderBy: { releaseNumber: 'desc' }, take: 10, select: { id: true, releaseNumber: true, status: true, createdAt: true, publishedAt: true } }),
  ])
  return <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
    <Link href="/dashboard" className="text-sm text-sky-700">← Websites</Link>
    <header><h1 className="text-2xl font-semibold">{project.name} · Domains & Publishing</h1><p className="mt-2 text-sm text-neutral-600">Publish your website through Webtummy. You only need access to your domain provider’s DNS settings.</p></header>
    {!config.configured && <div className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold">Hosting setup pending</h2><p className="mt-1 text-sm">You can add domains now. Publishing and automatic verification become available when the platform administrator connects Cloudflare and hosting. No hosting account or server access is required for customers.</p></div>}
    <section className="rounded-xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-sm text-neutral-500">Hosting status</p><p className="font-semibold">{!config.configured ? 'Not configured' : site?.status === 'LIVE' ? 'Live' : site?.status === 'PROVISIONING' ? 'Preparing hosting' : site?.status === 'DEPLOYING' ? 'Deploying website' : site?.serverId ? 'Ready to publish' : 'Not prepared'}</p></div><div className="flex gap-2"><Link href={`/projects/${id}/editor`} className="rounded border px-3 py-2 text-sm">Edit website</Link></div></div>
      {site?.publicHost && <p className="mt-3 break-all text-sm">Temporary address: {site.deployedReleaseId ? <a className="text-sky-700 underline" href={`https://${site.publicHost}`} target="_blank" rel="noreferrer">{site.publicHost}</a> : `${site.publicHost} (available after publishing)`}</p>}
      {site?.lastError && <ErrorNotice code="WT-PUBLISH-001" message={site.lastError} className="mt-3 text-sm text-red-700" />}
    </section>
    {role !== WorkspaceRole.VIEWER && <PublishingControls projectId={id} configured={config.configured} prepared={!!site?.serverId} deploying={!!site?.pendingReleaseId || site?.status === 'PROVISIONING'} previewDeploying={!!site?.previewPendingReleaseId} domains={domains.map((domain) => ({ id: domain.id, hostname: domain.hostname, isPrimary: domain.isPrimary, removable: !domain.verifiedAt && domain.status !== 'ACTIVE' }))} />}
    <section className="space-y-4"><h2 className="text-lg font-semibold">Connect your domains</h2><p className="text-sm text-neutral-600">Add the records below at your DNS provider. Keep existing MX, email TXT and other email records. Use DNS-only mode for the customer CNAME while connecting. Record names below are fully qualified; some providers automatically append your domain.</p>
      {!domains.length && <p className="rounded border border-dashed p-6 text-sm text-neutral-500">Add a domain to get its ownership-verification record.</p>}
      {domains.map((domain) => <article key={domain.id} className="rounded-xl border bg-white p-5"><h3 className="font-semibold">{domain.hostname}{domain.isPrimary ? ' · Primary after publish' : ''}</h3><p className="mt-1 text-sm text-neutral-500">{domain.status === 'ACTIVE' ? 'Connected · HTTPS active' : !domain.verifiedAt ? 'Waiting for ownership verification' : !domain.dnsReady ? 'Waiting for routing DNS' : domain.sslStatus === 'active' ? 'Certificate ready · publish to connect' : 'Setting up HTTPS'}</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Type</th><th className="p-2">Name</th><th className="p-2">Value</th></tr></thead><tbody>
          <tr className="border-t"><td className="p-2">TXT</td><td className="break-all p-2">_awb-verification.{domain.hostname}</td><td className="break-all p-2"><code>{domain.verificationToken}</code>{domain.verificationToken && <CopyDns value={domain.verificationToken} />}</td></tr>
          <tr className="border-t"><td className="p-2">CNAME / ALIAS</td><td className="break-all p-2">{domain.hostname}</td><td className="break-all p-2">{config.cnameTarget || 'Available after hosting setup'}{config.cnameTarget && <CopyDns value={config.cnameTarget} />}</td></tr>
        </tbody></table></div>
        <p className="mt-2 text-xs text-neutral-500">Use CNAME for a subdomain such as www. Root domains require your DNS provider’s ALIAS/ANAME or CNAME flattening support. If unsupported, connect www and use HTTPS-capable root-domain forwarding. Do not point customer domains directly to a hosting server IP.</p>
        {Array.isArray(domain.cloudflareValidation) && domain.cloudflareValidation.length > 0 && <div className="mt-4 space-y-2"><p className="text-sm font-medium">Additional HTTPS verification records</p><p className="text-xs text-neutral-500">Add these TXT records and keep them for verification and certificate renewal.</p>{(domain.cloudflareValidation as Array<{ name: string; value: string }>).map((record, index) => <div key={index} className="rounded bg-neutral-50 p-3 text-xs"><p>TXT name: <code className="break-all">{record.name}</code><CopyDns value={record.name} /></p><p>Value: <code className="break-all">{record.value}</code><CopyDns value={record.value} /></p></div>)}</div>}
        {domain.lastError && <ErrorNotice code="WT-PUBLISH-001" message={domain.lastError} className="mt-2 text-xs text-neutral-600" />}
      </article>)}
    </section>
    <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Recent releases</h2>{!releases.length ? <p className="mt-3 text-sm text-neutral-500">Nothing published yet.</p> : <ul className="mt-3 divide-y">{releases.map((release) => <li key={release.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>Release {release.releaseNumber}</span><span>{release.status === 'LIVE' && site?.deployedReleaseId !== release.id ? 'Previous release' : release.status}</span><time>{release.createdAt.toISOString().replace('T', ' ').slice(0, 16)} UTC</time></li>)}</ul>}</section>
  </main>
}
