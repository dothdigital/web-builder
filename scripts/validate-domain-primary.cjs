// Mock database and hosting only; no customer domains or external services are changed.
const assert = require('node:assert/strict'), path = require('node:path')
const mock = (file,exports) => { const id=require.resolve(file);require.cache[id]={id,filename:id,loaded:true,exports} }
let rows=[], pending=false
const domain={
 count:async({where})=>rows.filter(r=>r.projectId===where.projectId).length,
 findUnique:async({where})=>rows.find(r=>r.hostname===where.hostname),
 findFirst:async({where})=>rows.find(r=>Object.entries(where).every(([k,v])=>r[k]===v)),
 create:async({data})=>{const row={id:String(rows.length+1),...data};rows.push(row);return row},
 update:async({where,data})=>Object.assign(rows.find(r=>r.id===where.id),data),
 delete:async({where})=>{rows=rows.filter(r=>r.id!==where.id)},
 updateMany:async({where,data})=>rows.filter(r=>r.projectId===where.projectId).forEach(r=>Object.assign(r,data)),
}
const prisma={domain,hostingSite:{findUnique:async()=>({pendingReleaseId:pending?'release':null})},$transaction:async fn=>fn(prisma)}
mock('@awb/database',{prisma,WorkspaceRole:{EDITOR:'EDITOR'}})
mock('next/cache',{revalidatePath(){}});mock('next/navigation',{redirect(){throw Error('Unexpected redirect')}})
mock(path.resolve('apps/web/src/lib/tenancy.ts'),{requireProject:async()=>({user:{id:'owner'},project:{workspace:{}}})})
mock(path.resolve('apps/web/src/lib/billing/access.ts'),{paidAccess:()=>true})
mock(path.resolve('apps/web/src/lib/hosting/config.ts'),{normalizeHostname:s=>s,assertCustomerHostname(){},hostingConfig:()=>({configured:true})})
mock(path.resolve('apps/web/src/lib/hosting/service.ts'),{withHostingLock:async(id,fn)=>fn()})
mock(path.resolve('apps/web/src/lib/hosting/preview.ts'),{})
const {addHostingDomain,removePendingDomain}=require('../apps/web/src/app/actions/hosting.ts')
;(async()=>{
 assert.ok((await addHostingDomain('a','example.com')).ok);assert.equal(rows[0].isPrimary,true)
 assert.ok((await addHostingDomain('a','www.example.com')).ok);assert.equal(rows[1].isPrimary,false)
 assert.equal((await addHostingDomain('b','example.com')).ok,false,'Cannot take another project domain')
 assert.equal((await removePendingDomain('b',rows[0].id)).ok,false,'Cannot remove another project domain')
 pending=true;assert.equal((await addHostingDomain('a','new.example.com')).ok,false);pending=false
 assert.ok((await removePendingDomain('a',rows[0].id)).ok);assert.equal(rows[0].isPrimary,true,'Promote remaining domain')
 rows[0].verifiedAt=new Date();assert.equal((await removePendingDomain('a',rows[0].id)).ok,false)
 console.log('Domain primary: first automatic, aliases preserved, ownership guards, deployment guard and removal promotion passed.')
})().catch(e=>{console.error(e);process.exit(1)})
