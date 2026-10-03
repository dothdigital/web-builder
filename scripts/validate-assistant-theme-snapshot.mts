import { config } from 'dotenv'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { getComponent } from '@awb/component-registry'
import { websiteModelSchema } from '@awb/website-model'
import { assistantTargets, applyAssistantPlan, themeButtonColors } from '../apps/web/src/lib/page-assistant'
config({ path: '.env', override: true, quiet: true })
Object.assign(globalThis, { React })
const { prisma } = await import('@awb/database')
const { assistantPlanSchema } = await import('@awb/ai/editor-command')
try {
  const job = await prisma.contentJob.findFirstOrThrow({ where: { projectId: 'cmubp1pkj000akpuj3wg26x7d', input: { path: ['mode'], equals: 'PAGE_ASSISTANT' } }, orderBy: { createdAt: 'desc' }, select: { input: true, result: true } })
  const input = job.input as any
  const model = websiteModelSchema.parse(input.model)
  const page = model.pages.find(p => p.id === input.pageId)!
  const section = page.sections.at(-1)!
  const targets = assistantTargets(model, page.id)
  const buttonTarget = targets.find(target => target.sectionId === section.id && target.path === '/items/3')!
  assert.equal(buttonTarget.kind, 'button')
  assert.ok(buttonTarget.label.includes('Discuss your goals'))
  const response = { data: assistantPlanSchema.parse((job.result as any)?.plan) }
  const next = applyAssistantPlan(model, page.id, response.data, input.selection)
  const changed = next.pages.find(p => p.id === page.id)!.sections.at(-1)!
  assert.deepEqual((changed.props.elementColors as any)['/items/3'], themeButtonColors(model))
  assert.deepEqual(changed.props.freeElements, section.props.freeElements, 'Moved image must remain untouched')
  for (const other of page.sections.slice(0, -1)) assert.deepEqual(next.pages.find(p => p.id === page.id)!.sections.find(s => s.id === other.id), other)
  const definition = getComponent(changed.componentId)!
  const html = renderToStaticMarkup(React.createElement(definition.render, { props: definition.propsSchema.parse(changed.props), context: { tokens: model.tokens, baseUrl: '' } }))
  const dom = new JSDOM(html)
  const button = dom.window.document.querySelector<HTMLElement>('[data-awb-element="/items/3"]')!
  assert.equal(button.textContent, 'Discuss your goals')
  assert.ok(button.style.backgroundColor && button.style.color)
  assert.equal(button.getAttribute('href'), '#enquire')
  dom.window.close()
  console.log('PASS: saved snapshot identifies the actual selected manual button, uses exact theme colours and renders its background/text; all other objects preserved. No database writes or publishing.')
} finally { await prisma.$disconnect() }
