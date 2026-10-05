const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

let user, project, paidChecks = 0
const roles = { VIEWER: 'VIEWER', EDITOR: 'EDITOR', OWNER: 'OWNER' }
const dependencies = {
  '@awb/database': { WorkspaceRole: roles, prisma: {
    user: { findUnique: async () => user },
    project: { findUnique: async () => project },
  } },
  'next/navigation': { redirect: () => { throw Error('redirect') }, notFound: () => { throw Error('notFound') } },
  'next/headers': { cookies: async () => ({ get: () => undefined }) },
  '@/auth': { auth: async () => ({ user: { id: 'actor' } }) },
  './billing/access': { requirePaidWorkspace: async () => { paidChecks++; throw Error('plan expired') } },
}
const source = fs.readFileSync('apps/web/src/lib/tenancy.ts', 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const context = { exports: {}, require: name => {
  if (!(name in dependencies)) throw Error(`Unexpected dependency: ${name}`)
  return dependencies[name]
} }
vm.runInNewContext(compiled, context)
const { requireProject } = context.exports

async function main() {
  user = { id: 'actor', email: 'admin@example.test', isPlatformAdmin: true }
  project = { id: 'customer-site', workspaceId: 'customer-workspace', workspace: { status: 'SUSPENDED', members: [] } }
  assert.equal((await requireProject(project.id, roles.EDITOR)).role, roles.OWNER)
  assert.equal(paidChecks, 0, 'Admin editing does not depend on customer billing')
  project = null
  await assert.rejects(requireProject('missing', roles.EDITOR), /access to this project/)
  project = { id: 'customer-site', workspaceId: 'customer-workspace', workspace: { status: 'ACTIVE', members: [] } }
  user.isPlatformAdmin = false
  await assert.rejects(requireProject(project.id), /access to this project/)
  project.workspace.members = [{ role: roles.VIEWER }]
  assert.equal((await requireProject(project.id)).role, roles.VIEWER)
  await assert.rejects(requireProject(project.id, roles.EDITOR), /access to this project/)
  project.workspace.members = [{ role: roles.EDITOR }]
  await assert.rejects(requireProject(project.id, roles.EDITOR), /plan expired/)
  assert.equal(paidChecks, 1, 'Customer editing still requires billing access')
  project.workspace.status = 'SUSPENDED'
  await assert.rejects(requireProject(project.id), /workspace is suspended/)
  user.isPlatformAdmin = true
  user.suspendedAt = new Date()
  await assert.rejects(requireProject(project.id, roles.EDITOR), /Sign in required/)
  console.log('PASS: admin cross-workspace editing, missing-project denial, customer isolation, viewer permissions, billing restrictions, workspace suspension and suspended-admin denial')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
