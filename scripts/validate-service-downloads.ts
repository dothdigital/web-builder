import assert from 'node:assert/strict'
import React from 'react'
import{renderToStaticMarkup}from'react-dom/server'
import{JSDOM}from'jsdom'
import{getComponent,defaultTokens}from'@awb/component-registry'
Object.assign(globalThis,{React})
const component=getComponent('Tpl_webtummy-business_service_2')!
function render(props:Record<string,unknown>){return new JSDOM(renderToStaticMarkup(React.createElement(component.render,{props:component.propsSchema.parse(props),context:{tokens:defaultTokens,baseUrl:'/preview/test'}}))).window.document}
assert.equal(render({text36:'Downloads',text37:'PDF',link5:'#',text39:'Word',link6:'/services'}).querySelectorAll('.download.service').length,0)
const files=render({text36:'Patient resources',text37:'Exercise guide',link5:'/uploads/guide.pdf',text39:'Word',link6:'#'})
assert.equal(files.querySelectorAll('.single-download-area').length,1)
assert.equal(files.querySelector('.single-download-area a')?.getAttribute('href'),'/uploads/guide.pdf')
assert.equal(render({link5:'https://example.com/guide.docx?signature=test'}).querySelectorAll('.single-download-area').length,1)
console.log('PASS: empty download widgets hidden; real PDF/Word documents retained')
