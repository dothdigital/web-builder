import 'dotenv/config'
import { prisma } from '@awb/database'
import { defaultTokens } from '@awb/component-registry'
import { websiteModelSchema } from '@awb/website-model'
import { hashPassword } from '../apps/web/src/lib/account-security'
import { randomBytes } from 'node:crypto'
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { env, localUploadRoot } from '@awb/shared'
import path from 'node:path'
import { writeFile, readFile, unlink } from 'node:fs/promises'
const file='/home/ubuntu/webtummy-security-20261005/fixtures.json'
const mode=process.argv[2]
try {
  if (mode==='create') {
    const marker=`security-${Date.now()}`
    const fixtures: any={marker,users:[],workspaces:[],projects:[]}
    await writeFile(file, JSON.stringify(fixtures), {mode:0o600})
    for (const role of ['owner-a','owner-b','viewer','unverified']) {
      const password=randomBytes(24).toString('base64url')
      const user=await prisma.user.create({data:{email:`${marker}-${role}@security-test.invalid`, name:`Security fixture ${role}`,passwordHash:await hashPassword(password), emailVerified:role==='unverified'?null:new Date()}})
      fixtures.users.push({id:user.id,email:user.email,password,role})
      await writeFile(file, JSON.stringify(fixtures), {mode:0o600})
    }
    for (const [index, owner] of fixtures.users.slice(0,2).entries()) {
      const workspace=await prisma.workspace.create({data:{name:`Security fixture ${index}`,slug:`${marker}-${index}`,members:{create:[{userId:owner.id,role:'OWNER'},...(index===0?[{userId:fixtures.users[2].id,role:'VIEWER'}]:[])]}}})
      fixtures.workspaces.push(workspace.id)
      await writeFile(file, JSON.stringify(fixtures), {mode:0o600})
      const project=await prisma.project.create({data:{workspaceId:workspace.id,name:`Security fixture ${index}`,slug:`${marker}-${index}`,previewHost:`${marker}-${index}.security-test.invalid`}})
      fixtures.projects.push(project.id)
      await writeFile(file, JSON.stringify(fixtures), {mode:0o600})
      const model=websiteModelSchema.parse({schemaVersion:'1.0.0',site:{name:project.name,previewHost:project.previewHost},businessProfileRef:project.id,designDna:{direction:'modern-minimal',composition:{symmetry:'symmetric',density:'balanced',width:'contained',rhythm:'modular'},typography:{headingStyle:'geometric-sans',bodyStyle:'clean-sans',scale:'standard'},imagery:{style:'documentary',dominance:'low',treatment:'natural'},navigation:'compact-sticky',motion:'none',corners:'soft',ctaStyle:'solid',colorBehavior:'tonal'},tokens:defaultTokens,navigation:{primaryMenu:[]},globalComponents:{header:{componentId:'HeaderSplitUtility',props:{logoText:'Security canary'}},footer:{componentId:'FooterMinimal',props:{}}},pages:[{id:'test-page',path:'/',title:'Security canary',h1:'Security canary',seo:{title:'Security canary',index:false},sections:[{id:'test-section',componentId:'ManualSection',props:{items:[{id:'test-text',kind:'heading',text:'Security canary'}]}}]}]})
      await prisma.websiteVersion.create({data:{projectId:project.id,version:1,kind:'DRAFT',model:JSON.parse(JSON.stringify(model)),schemaVersion:'1.0.0',note:'Disposable security fixture'}})
    }
    console.log('Created four disposable users and two isolated workspaces/projects; no emails, AI jobs or publishing.')
  } else {
    const fixtures=JSON.parse(await readFile(file,'utf8'))
    if (mode==='revoke') await prisma.user.update({where:{id:fixtures.users[0].id},data:{sessionVersion:{increment:1}}})
    else if (mode==='cleanup') {
      const assets = await prisma.asset.findMany({ where: { projectId: { in: fixtures.projects } }, select: { url: true, storageKey: true } })
      const config = env()
      const remote = assets.filter(asset => !asset.url.startsWith('/uploads/'))
      if (remote.length && config.S3_BUCKET) {
        const client = new S3Client({ region: config.S3_REGION, ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT, forcePathStyle: true } : {}), ...(config.S3_ACCESS_KEY_ID && config.S3_SECRET_ACCESS_KEY ? { credentials: { accessKeyId: config.S3_ACCESS_KEY_ID, secretAccessKey: config.S3_SECRET_ACCESS_KEY } } : {}) })
        const result = await client.send(new DeleteObjectsCommand({ Bucket: config.S3_BUCKET, Delete: { Objects: remote.map(asset => ({ Key: asset.storageKey })) } }))
        if (result.Errors?.length) throw new Error('Could not remove all test objects')
      }
      for (const asset of assets.filter(asset => asset.url.startsWith('/uploads/'))) { const root = path.resolve(localUploadRoot()); const target = path.resolve(root, asset.storageKey); if (target.startsWith(root + path.sep)) await unlink(target).catch(() => {}) }
      await prisma.verificationToken.deleteMany({ where: { identifier: { in: fixtures.users.flatMap((user:any) => [`reset:${user.email}`, `verify:${user.email}`]) } } })
      await prisma.auditEvent.deleteMany({ where: { actorId: { in: fixtures.users.map((user:any) => user.id) } } })
      await prisma.workspace.deleteMany({where:{id:{in:fixtures.workspaces}}})
      await prisma.user.deleteMany({where:{id:{in:fixtures.users.map((u:any)=>u.id)}}})
      await writeFile(file, JSON.stringify({ marker: fixtures.marker, cleanedUp: true }), { mode: 0o600 })
      console.log('Deleted fixture users, workspaces, projects, audit events, tokens and uploaded test objects; discarded test credentials.')
    }
  }
} finally {await prisma.$disconnect()}
