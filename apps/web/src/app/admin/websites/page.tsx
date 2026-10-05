import Link from 'next/link'
import { prisma, type Prisma } from '@awb/database'
import { requireAdmin } from '@/lib/tenancy'
import { AppShell } from '@/components/account/app-shell'

export default async function AdminWebsitesPage({ searchParams }: {
  searchParams: Promise<{ q?: string; page?: string; userId?: string }>
}) {
  await requireAdmin()
  const query = await searchParams
  const q = String(query.q ?? '').trim().slice(0, 100)
  const userId = String(query.userId ?? '').slice(0, 100)
  const page = Math.max(1, Math.min(10000, Math.floor(Number(query.page) || 1)))
  const where: Prisma.ProjectWhereInput = {
    ...(userId ? { workspace: { members: { some: { userId } } } } : {}),
    ...(q ? { OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { workspace: { name: { contains: q, mode: 'insensitive' } } },
      { workspace: { members: { some: { user: { OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ] } } } } },
    ] } : {}),
  }
  const [projects, total, selectedUser] = await Promise.all([
    prisma.project.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * 25, take: 25,
      include: { workspace: { include: { members: { include: { user: { select: { name: true, email: true } } } } } } } }),
    prisma.project.count({ where }),
    userId ? prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }) : null,
  ])
  const pageHref = (value: number) => `/admin/websites?${new URLSearchParams({ q, ...(userId ? { userId } : {}), page: String(value) })}`
  return <AppShell title="Website management" active="/admin/websites">
    <div className="wt-heading"><p className="wt-eyebrow">PLATFORM ADMIN</p><h1>Customer websites.</h1>
      <p>{total} websites{userId ? ` · ${selectedUser?.name ?? selectedUser?.email ?? 'Selected user'}` : ' across all workspaces'}</p>
      {userId && <Link href="/admin/websites">View all websites →</Link>}
    </div>
    <form className="wt-search">{userId && <input type="hidden" name="userId" value={userId} />}
      <input name="q" defaultValue={q} placeholder="Search websites, workspaces, names or emails" aria-label="Search websites" />
      <button className="wt-button">Search</button>
    </form>
    <div className="wt-table-wrap"><table className="wt-table">
      <thead><tr><th>Website</th><th>Workspace</th><th>Users</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{projects.map(project => <tr key={project.id}>
        <td><strong>{project.name}</strong></td>
        <td>{project.workspace.name}<small>{project.workspace.status.toLowerCase()}</small></td>
        <td>{project.workspace.members.map(member => <div key={member.id}><strong>{member.user.name ?? 'Unnamed'}</strong><small>{member.user.email} · {member.role.toLowerCase()}</small></div>)}</td>
        <td>{project.status.toLowerCase()}</td>
        <td><Link href={`/projects/${project.id}/editor`}>Edit website →</Link><br /><Link href={`/preview/${project.id}`}>Preview →</Link></td>
      </tr>)}</tbody>
    </table>{!projects.length && <p className="p-4 wt-muted">No websites found.</p>}</div>
    <div className="wt-pagination">{page > 1 && <Link href={pageHref(page - 1)}>← Previous</Link>}<span>Page {page}</span>{page * 25 < total && <Link href={pageHref(page + 1)}>Next →</Link>}</div>
  </AppShell>
}
