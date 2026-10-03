import { getComponent } from '@awb/component-registry'
import type { AiPatch } from '@awb/website-model'
import { setAtPointer } from './json-pointer'

export function validateGeneratedSection(componentId: string, operations: AiPatch['operations']) {
  const automatic = componentId === 'auto'
  let definition = getComponent(componentId)
  let props: Record<string, unknown> = {}
  for (const operation of operations) {
    if (!['add', 'replace', 'remove'].includes(operation.op) || operation.path.split('/').some((part) => ['__proto__', 'constructor', 'prototype'].includes(part))) throw new Error('AI returned an unsupported edit. Please try again.')
    props = setAtPointer(props, operation.path, operation.op === 'remove' ? undefined : operation.value)
  }
  if (automatic) {
    definition = typeof props.componentId === 'string' ? getComponent(props.componentId) : undefined
    if (!definition || ['HEADER', 'FOOTER', 'HERO'].includes(definition.family)) throw new Error('AI could not select a supported section layout. Please try again.')
    props = props.props as Record<string, unknown>
  }
  if (!definition) throw new Error('Unknown section layout')
  const parsed = definition.propsSchema.safeParse(props)
  if (!parsed.success) throw new Error('AI returned incomplete section content. Please try again or choose another layout.')
  return { componentId: definition.componentId, componentVersion: definition.version, props: parsed.data as Record<string, unknown> }
}
