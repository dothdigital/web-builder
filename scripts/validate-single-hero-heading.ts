import assert from'node:assert/strict'
import React from'react'
import{renderToStaticMarkup}from'react-dom/server'
import{JSDOM}from'jsdom'
import{getComponent,defaultTokens,normalizeTemplateHeading}from'@awb/component-registry'
Object.assign(globalThis,{React})
const component=getComponent('Tpl_webtummy-business_10_1')!
const props=normalizeTemplateHeading(component.componentId,component.propsSchema.parse({heading:'Physiotherapy and Massage',text2:'Therapy in Mississauga'}))
assert.equal(props.heading,'Physiotherapy and Massage Therapy in Mississauga')
assert.equal(props.text2,'')
assert.deepEqual(normalizeTemplateHeading(component.componentId,props),props,'Heading normalization must be idempotent')
const doc=new JSDOM(renderToStaticMarkup(React.createElement(component.render,{props,context:{tokens:defaultTokens,baseUrl:''}}))).window.document
assert.equal(doc.querySelectorAll('h1').length,1)
assert.equal(doc.querySelector('h1')?.getAttribute('data-awb-element'),'/heading')
assert.equal(doc.querySelector('h1')?.textContent,'Physiotherapy and Massage Therapy in Mississauga')
assert.equal(doc.querySelector('h1')?.children.length,0,'Whole heading must have one text selection')
assert.equal(component.editorFields.filter(field=>field.headingLevel===1).length,1)
const edited=component.propsSchema.parse({...props,heading:'A new complete headline'})
assert.equal(edited.heading,'A new complete headline','Editing must not append an old heading fragment')
console.log('PASS: one H1 selection, full text preserved, no stale fragment after editing')
