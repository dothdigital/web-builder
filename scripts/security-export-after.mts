import 'dotenv/config'
import React from 'react'
import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { prisma } from '@awb/database'
import { websiteModelSchema } from '@awb/website-model'
import { buildStaticExport } from '../apps/web/src/lib/static-export'
Object.assign(globalThis,{React})
const fixtures=JSON.parse(await readFile('/home/ubuntu/webtummy-security-20261005/fixtures.json','utf8'))
let hits=0
const server=createServer((_req,res)=>{hits++;res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>')})
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
try {
  const version=await prisma.websiteVersion.findFirstOrThrow({where:{projectId:fixtures.projects[0]}})
  const model=websiteModelSchema.parse(version.model)
  const address=server.address() as {port:number}
  model.pages[0]!.sections[0]!.props.items=[{id:'canary',kind:'image',imageUrl:`http://127.0.0.1:${address.port}/security-canary.svg`,imageAlt:'Private network canary'}]
  let blocked=false
  try {await buildStaticExport(model,{siteUrl:'https://security-test.invalid'})} catch {blocked=true}
  if(!blocked || hits!==0) throw new Error('Private-network export request was not blocked')
  await writeFile('/home/ubuntu/webtummy-security-20261005/export-ssrf-after.json',JSON.stringify({loopbackCanaryRequests:hits,blocked},null,2))
  console.log('PASS: Export private-network canary blocked, zero requests reached localhost.')
} finally {server.close();await prisma.$disconnect()}
