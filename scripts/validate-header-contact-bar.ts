import assert from 'node:assert/strict'
import React from 'react'
import{renderToStaticMarkup}from'react-dom/server'
import{JSDOM}from'jsdom'
import{getComponent,defaultTokens}from'@awb/component-registry'
Object.assign(globalThis,{React})
const header=getComponent('Tpl_webtummy-business_10_0')!
function render(props:Record<string,unknown>){return new JSDOM(renderToStaticMarkup(React.createElement(header.render,{props:header.propsSchema.parse(props),context:{tokens:defaultTokens,baseUrl:'/preview/test'}}))).window.document}
const actual=render({email:'clinic@example.com',phone:'(905) 555-0123',items:[]})
assert.ok(actual.querySelector('.awb-header-contact-bar a[href="mailto:clinic@example.com"]'))
assert.ok(actual.querySelector('.awb-header-contact-bar a[href="tel:9055550123"]'))
assert.equal(actual.querySelectorAll('.working-time,.call-area,.visit-us,.fa-clock').length,0)
assert.equal(render({items:[]}).querySelectorAll('.awb-header-contact-bar').length,0,'Do not show empty demo contact data')
console.log('PASS: real email/phone top bar, no timer/social/empty phone placeholders')
