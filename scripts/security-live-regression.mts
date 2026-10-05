import 'dotenv/config'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { prisma } from '@awb/database'
import { hashPassword, tokenHash } from '../apps/web/src/lib/account-security'
const require = createRequire(import.meta.url)
const { encodeReply } = require('next/dist/compiled/react-server-dom-webpack/client.node.js')
const dir='/home/ubuntu/webtummy-security-20261005'
const fixtureFile=`${dir}/fixtures.json`
const f=JSON.parse(await readFile(fixtureFile,'utf8'))
const manifest=JSON.parse(await readFile((process.env.SECURITY_BUILD_ROOT || '.')+'/apps/web/.next/server/server-reference-manifest.json','utf8'))
const base=process.env.SECURITY_BASE_URL || 'https://webtummy.com'
const evidence: unknown[]=[]
async function save(){await writeFile(fixtureFile,JSON.stringify(f),{mode:0o600})}
class Client {
  cookies=new Map<string,string>()
  async request(path:string, options:RequestInit={}) {
    const response=await fetch(base+path,{...options,redirect:'manual',headers:{Cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; '),...options.headers}})
    for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0]!;const index=pair.indexOf('=');this.cookies.set(pair.slice(0,index),pair.slice(index+1))}
    const bytes=Buffer.from(await response.arrayBuffer())
    return {status:response.status,headers:response.headers,bytes,text:bytes.toString()}
  }
  async login(user:any){const csrf=JSON.parse((await this.request('/api/auth/csrf')).text).csrfToken;await this.request('/api/auth/callback/password',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Origin:base},body:new URLSearchParams({csrfToken:csrf,email:user.email,password:user.password,callbackUrl:base+'/dashboard'})});assert.ok(JSON.parse((await this.request('/api/auth/session')).text)?.user?.id)}
  async action(name:string,args:unknown[],origin=base){const entry=Object.entries(manifest.node).find(([,value]:any)=>value.exportedName===name);assert.ok(entry,`Action ${name} exists`);return this.request(name==='saveModel'?`/projects/${f.projects[0]}/editor`:name==='finishAccountToken'?'/reset-password':name==='prepareHosting'?`/projects/${f.projects[0]}/publishing`:'/admin/users',{method:'POST',headers:{'Next-Action':entry[0],Origin:origin},body:await encodeReply(args)})}
}
try {
  let admin=f.users.find((u:any)=>u.role==='admin')
  if(!admin){const password=randomBytes(24).toString('base64url');const user=await prisma.user.create({data:{email:`${f.marker}-admin@security-test.invalid`,name:'Security fixture admin',emailVerified:new Date(),passwordHash:await hashPassword(password),isPlatformAdmin:true}});admin={...user,password,role:'admin'};delete admin.passwordHash;f.users.push(admin);await save()}
  const adminClient=new Client();await adminClient.login(admin)
  const supportEmail=`${f.marker}-support@security-test.invalid`,supportPassword=randomBytes(24).toString('base64url')
  const supportForm=new FormData();supportForm.set('name','Security fixture support');supportForm.set('email',supportEmail);supportForm.set('password',supportPassword)
  const owner=new Client();await owner.login(f.users[0])
  const denied=await owner.action('createSupportAccount',[{message:''},supportForm]);assert.equal(await prisma.user.count({where:{email:supportEmail}}),0);evidence.push({test:'customer cannot create support',status:denied.status,passed:true})
  await adminClient.action('createSupportAccount',[{message:''},supportForm])
  const support=await prisma.user.findUniqueOrThrow({where:{email:supportEmail}});assert.equal(support.isPlatformSupport,true);assert.equal(support.isPlatformAdmin,false)
  f.users.push({id:support.id,email:supportEmail,password:supportPassword,role:'support'});await save()
  const supportClient=new Client();await supportClient.login(f.users.at(-1))
  for(const project of f.projects){assert.equal((await supportClient.request(`/preview/${project}`)).status,200);assert.equal((await supportClient.request(`/projects/${project}/editor`)).status,200);assert.equal((await adminClient.request(`/preview/${project}`)).status,200)}
  for(const path of ['/admin','/admin/users','/admin/plans','/admin/emails'])assert.equal((await supportClient.request(path)).status,404,`Support denied ${path}`)
  assert.equal((await supportClient.request(`/admin/websites?q=${encodeURIComponent(f.marker)}`)).status,200)
  evidence.push({test:'admin creates support; support edits across tenants but cannot access administration',passed:true})
  const version=await prisma.websiteVersion.findFirstOrThrow({where:{projectId:f.projects[0]},orderBy:{version:'desc'}})
  const before=await prisma.websiteVersion.count({where:{projectId:f.projects[0]}})
  const crossOrigin=await supportClient.action('saveModel',[f.projects[0],version.model,'Security fixture cross-origin'],'https://security-test.invalid');assert.equal(await prisma.websiteVersion.count({where:{projectId:f.projects[0]}}),before)
  evidence.push({test:'cross-origin server action rejected',status:crossOrigin.status,passed:true})
  await supportClient.action('saveModel',[f.projects[0],version.model,'Security fixture support save'])
  assert.equal(await prisma.websiteVersion.count({where:{projectId:f.projects[0]}}),before+1)
  assert.ok(await prisma.auditEvent.findFirst({where:{actorId:support.id,projectId:f.projects[0],action:'staff.website.save'}}))
  evidence.push({test:'support saves are audited',passed:true})
  const publish=await supportClient.action('prepareHosting',[f.projects[0]]);assert.equal(await prisma.hostingSite.count({where:{projectId:f.projects[0]}}),0)
  evidence.push({test:'support cannot provision customer hosting',status:publish.status,passed:true})
  const roles=new FormData();roles.set('id',support.id);roles.set('operation','grant-admin')
  await supportClient.action('manageUser',[{message:''},roles]);assert.equal((await prisma.user.findUniqueOrThrow({where:{id:support.id}})).isPlatformAdmin,false)
  evidence.push({test:'support cannot grant admin',passed:true})
  roles.set('operation','remove-support');await adminClient.action('manageUser',[{message:''},roles]);assert.equal((await supportClient.request(`/api/projects/${f.projects[0]}/editor-image?url=missing`)).status,401)
  evidence.push({test:'removing support invalidates existing sessions',passed:true})
  const token=randomBytes(32).toString('hex'),password=randomBytes(24).toString('base64url')
  await prisma.verificationToken.create({data:{identifier:`reset:${f.users[0].email}`,token:tokenHash(token),expires:new Date(Date.now()+60000)}})
  const reset=new FormData();reset.set('purpose','reset');reset.set('token',token);reset.set('password',password)
  const previousVersion=(await prisma.user.findUniqueOrThrow({where:{id:f.users[0].id}})).sessionVersion
  await owner.action('finishAccountToken',[{message:''},reset])
  assert.equal((await prisma.user.findUniqueOrThrow({where:{id:f.users[0].id}})).sessionVersion,previousVersion+1)
  assert.equal((await owner.request(`/api/projects/${f.projects[0]}/editor-image?url=missing`)).status,401)
  await owner.action('finishAccountToken',[{message:''},reset]);assert.equal((await prisma.user.findUniqueOrThrow({where:{id:f.users[0].id}})).sessionVersion,previousVersion+1)
  f.users[0].password=password;await save();evidence.push({test:'password reset invalidates sessions and token replay is rejected',passed:true})
  const anonymous=new Client();assert.equal((await anonymous.request('/team')).status,307);assert.equal((await anonymous.request('/invite?token=invalid')).status,307)
  const pricing=await anonymous.request('/pricing');assert.equal(pricing.status,200);assert.ok(pricing.text.includes('US$29'));assert.ok(pricing.text.includes('Individual'));assert.ok(!pricing.text.includes('Team collaboration'))
  const plans=await prisma.billingPlan.findMany({where:{active:true}});assert.equal(plans.length,1);assert.equal(plans[0]!.slug,'individual')
  evidence.push({test:'Team routes disabled; only Individual US$29/month offered',passed:true})
  await writeFile(`${dir}/regression-results.json`,JSON.stringify(evidence,null,2))
  console.log('PASS:',evidence.length,'authenticated security, support, reset, team and pricing regression checks.')
} finally {
  // Track workspaces created automatically when fixture staff sign in.
  const memberships=await prisma.workspaceMember.findMany({where:{userId:{in:f.users.map((u:any)=>u.id)}},select:{workspaceId:true}})
  f.workspaces=[...new Set([...f.workspaces,...memberships.map(m=>m.workspaceId)])];await save();await prisma.$disconnect()
}
