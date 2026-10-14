const assert = require('node:assert/strict')
const path = require('node:path')
const mock = (file, exports) => { const id = require.resolve(file); require.cache[id] = { id, filename: id, loaded: true, exports } }
const { JSDOM } = require('jsdom')
const React = require('react'); global.React = React
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' })
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator; global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require('react-dom/client'); const { act } = React
const router = { refresh() {} }; let publishes = 0, primaryCalls = 0
let dnsResult = { ok: true, message: 'Ownership pending · DNS routing verified · Cloudflare HTTPS pending.' }
mock('next/navigation', { useRouter: () => router })
mock(path.resolve('apps/web/src/app/actions/hosting.ts'), Object.fromEntries(['addHostingDomain','choosePrimaryDomain','removePendingDomain','prepareHosting','checkHosting','publishHosting'].map(name => [name, async () => { if(name === 'publishHosting') publishes++; if(name === 'choosePrimaryDomain') primaryCalls++; return name === 'checkHosting' ? dnsResult : {ok:true,message:'Updated'} }])))
const { PublishingControls } = require('../apps/web/src/app/projects/[id]/publishing/controls.tsx')
const root = createRoot(document.getElementById('root'))
const props = { projectId:'test', canEdit:true, configured:true, prepared:true, deploying:false, previewDeploying:false, domains:[{id:'a',hostname:'example.com',isPrimary:true,removable:true,ready:false}], children:React.createElement('p',null,'TXT record instructions') }
const render = async () => act(async()=>root.render(React.createElement(PublishingControls,props)))
const click = async text => { const button = [...document.querySelectorAll('button')].find(b=>b.textContent===text); assert.ok(button,text); await act(async()=>button.click()); return button }
;(async()=>{
 await render(); assert.match(document.body.textContent,/Primary domain: example.com/); assert.ok(!document.body.textContent.includes('TXT record instructions'))
 await click('No, continue to DNS'); assert.match(document.body.textContent,/TXT record instructions/); assert.equal(primaryCalls,0)
 await click('Check DNS records'); assert.match(document.querySelector('[aria-live="polite"]').textContent,/Ownership pending/,'DNS result appears beside the check button')
 dnsResult = { ok: false, message: 'Hosting domain activation is unavailable.' }; await click('Check DNS records'); assert.match(document.querySelector('[aria-live="polite"]').textContent,/Hosting domain activation is unavailable/)
 dnsResult = { ok: true, message: 'Ownership verified · DNS routing verified · Cloudflare HTTPS active. Domain verified and ready to publish.' }; await click('Check DNS records'); assert.match(document.querySelector('[aria-live="polite"]').textContent,/Domain verified and ready to publish/)
 props.domains[0].ready=true; await render(); assert.ok(![...document.querySelectorAll('button')].some(b=>/Check DNS records|Recheck DNS records/.test(b.textContent)), 'Verified domains hide the DNS check button'); assert.ok(document.querySelector('details summary').textContent.includes('View DNS records')); assert.ok(document.querySelector('[role="status"] h4').textContent.includes('Domain verified and ready to publish')); props.domains[0].ready=false; await render(); assert.ok([...document.querySelectorAll('button')].some(b=>b.textContent==='Check DNS records'), 'Pending verification restores the check button')

 await click('Continue to deployment'); assert.ok(![...document.querySelectorAll('button')].some(b=>b.textContent==='Continue to publish'), 'Pending readiness hides continuation'); assert.equal(publishes,0); assert.ok([...document.querySelectorAll('button')].some(b=>b.textContent==='Check readiness')); await click('Check readiness'); assert.match(document.querySelector('[aria-live="polite"]').textContent,/Ownership verified/)
 props.domains[0].ready=true; await render(); assert.match(document.body.textContent,/Everything is ready/); assert.ok(![...document.querySelectorAll('button')].some(b=>/Prepare hosting|Check readiness|Check deployment status/.test(b.textContent)), 'Ready state hides redundant readiness checks'); await click('Continue to publish'); assert.equal(publishes,0,'Navigation cannot publish'); assert.ok(![...document.querySelectorAll('button')].some(b=>b.textContent==='Check deployment status'), 'Status check is hidden before deployment'); await click('Publish saved website'); assert.equal(publishes,1)
 props.deploying=true; await render(); assert.ok(![...document.querySelectorAll('button')].some(b=>b.textContent==='Publish saved website'), 'Deployment prevents duplicate publish'); assert.ok([...document.querySelectorAll('button')].some(b=>b.textContent==='Check deployment status')); props.deploying=false; props.domains[0].ready=false; await render(); assert.ok([...document.querySelectorAll('button')].find(b=>b.textContent==='Publish saved website').disabled,'Readiness regression blocks publishing')
 await act(async()=>root.unmount()); dom.window.close(); console.log('Publishing wizard: optional extra domain, DNS instructions, readiness gate and explicit publishing and inline DNS feedback passed.')
})().catch(error=>{console.error(error);process.exit(1)})
