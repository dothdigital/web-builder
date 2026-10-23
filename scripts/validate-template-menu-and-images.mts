import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { HEADER_MENU_SCRIPT } from '../apps/web/src/lib/header-menu-script.ts'
import { planningKey } from '../packages/pipeline/src/planning-key.ts'
import type { GenerationBrief } from '../packages/ai/src/provider.ts'
const css = readFileSync('apps/web/public/template-library/webtummy-business/editable.css','utf8')
const closed = css.match(/\.wt-layout-webtummy-business\[data-layout-family="HEADER"\] \.wt-layout-dropdown:not\(\[open\]\)>\.wt-layout-submenu\{display:none!important\}/)?.[0]
assert.ok(closed)
const dom = new JSDOM(`<style>.wt-layout-submenu{display:grid!important}${closed}</style><div class="wt-layout-webtummy-business" data-layout-family="HEADER"><details class="wt-layout-dropdown"><summary>Insurance</summary><ul class="wt-layout-submenu"><li><a href="/life">Life</a></li></ul></details><details class="wt-layout-dropdown"><summary>Investments</summary><ul class="wt-layout-submenu"><li>RRSP</li></ul></details></div><button id="outside">Outside</button>`,{runScripts:'outside-only'})
const {document}=dom.window
const menus=[...document.querySelectorAll('details')]
assert.equal(dom.window.getComputedStyle(menus[0]!.querySelector('ul')!).display,'none')
dom.window.eval(HEADER_MENU_SCRIPT)
menus[0]!.open=true;menus[1]!.open=true;menus[1]!.dispatchEvent(new dom.window.Event('toggle'))
assert.equal(menus[0]!.open,false);assert.equal(menus[1]!.open,true)
document.getElementById('outside')!.dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true}))
assert.equal(menus[1]!.open,false)
menus[0]!.open=true;menus[0]!.querySelector('summary')!.focus()
document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}))
assert.equal(menus[0]!.open,false)
menus[0]!.open=true;menus[0]!.querySelector('a')!.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true}))
assert.equal(menus[0]!.open,false)
const brief={businessName:'Example',description:'Insurance',services:['Life','RRSP'],goals:[],answers:{a:'1',b:'2'},tonePreferences:[],hasLogo:false,logoColors:[],uploadedImageUrls:[],testimonials:[]} as GenerationBrief
assert.equal(planningKey(brief),planningKey({...brief,templateId:'finbiz-1',uploadedImageUrls:['portrait.png'],logoColors:['#ff0000'],answers:{b:'2',a:'1'}}))
assert.notEqual(planningKey(brief),planningKey({...brief,services:['Life']}))
assert.match(css,/max-height:480px/)
console.log('PASS: closed dropdown CSS, exclusive open, outside click, Escape, navigation close; matching intake planning keys ignore theme/assets and change with service facts')
dom.window.close()
