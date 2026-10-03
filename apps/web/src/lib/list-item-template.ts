import { z } from 'zod'
import { getComponent } from '@awb/component-registry'

type JsonSchema = { type?: string; default?: unknown; enum?: unknown[]; properties?: Record<string, JsonSchema>; items?: JsonSchema }
function blank(schema: JsonSchema): unknown {
  if (schema.default !== undefined) return structuredClone(schema.default)
  if (schema.enum?.length) return schema.enum[0]
  if (schema.type === 'object') return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, value]) => [key, blank(value)]))
  if (schema.type === 'array') return []
  if (schema.type === 'number' || schema.type === 'integer') return 0
  if (schema.type === 'boolean') return false
  return ''
}
export function listItemTemplate(componentId: string, pointer: string): unknown {
  const definition = getComponent(componentId)
  if (!definition) return ''
  let schema = z.toJSONSchema(definition.propsSchema, { io: 'input', unrepresentable: 'any' }) as JsonSchema | undefined
  for (const key of pointer.split('/').slice(1)) schema = /^\d+$/.test(key) ? schema?.items : schema?.properties?.[key]
  return schema?.items ? blank(schema.items) : ''
}
