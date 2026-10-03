import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@awb/database'
import { currentUser, primaryWorkspace } from '@/lib/tenancy'
import { logoutAccount } from '@/app/actions/account'
import { switchWorkspace } from '@/app/actions/team'
export async function AppShell({ children, title, active }: { children: React.ReactNode; title: string; active: string }) {
  const user = await currentUser(); if (!user) redirect('/signin')
  const workspace = await primaryWorkspace(user.id)
  const memberships = await prisma.workspaceMember.findMany({ where: { userId: user.id }, include: { workspace: { select: { id: true, name: true } } } })
  const links = [['/dashboard', '◫', 'Websites'], ['/billing', '◇', 'Plans & billing'], ['/team', '♧', 'Team'], ['/account', '◎', 'My account']]
  return <div className="wt-shell"><aside className="wt-sidebar"><Link href="/dashboard" className="wt-brand"><span>W</span> webtummy</Link><p className="wt-eyebrow">WORKSPACE</p><nav>{links.map(([href, icon, label]) => <Link key={href} href={href!} className={active === href ? 'active' : ''}><span aria-hidden>{icon}</span>{label}</Link>)}</nav>{user.isPlatformAdmin && <><p className="wt-eyebrow">PLATFORM ADMIN</p><nav>{[['/admin', 'Overview'], ['/admin/users', 'Users'], ['/admin/plans', 'Packages'], ['/admin/emails', 'Emails']].map(([href, label]) => <Link key={href} href={href!} className={active === href ? 'active' : ''}>{label}</Link>)}</nav></>}<div className="wt-sidebar-bottom"><strong>{user.name ?? 'Your account'}</strong><small>{user.email}</small><form action={logoutAccount}><button>Sign out ↗</button></form></div></aside><div className="wt-main"><header className="wt-topbar"><span>{title}</span>{memberships.length > 1 ? <form action={switchWorkspace} className="flex items-center gap-2"><select name="workspaceId" defaultValue={workspace?.id} aria-label="Current workspace">{memberships.map(m => <option key={m.workspaceId} value={m.workspaceId}>{m.workspace.name}</option>)}</select><button className="wt-button secondary">Switch</button></form> : <span className="wt-muted">{workspace?.name}</span>}<Link href="/account" className="wt-avatar" aria-label="My account">{(user.name ?? user.email).slice(0, 1).toUpperCase()}</Link></header><main className="wt-content">{children}</main></div></div>
}
