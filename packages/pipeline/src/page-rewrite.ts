import { getComponent } from '@awb/component-registry'
import { pageSchema, type AiPatch, type WebsitePage } from '@awb/website-model'
import { getAtPointer, setAtPointer } from './json-pointer'

export function applyPageRewrite(page: WebsitePage, operations: AiPatch['operations']): WebsitePage {
  let next = page
  for (const operation of operations) {
    const path = operation.path
    let allowed = ['/title', '/h1', '/seo/title', '/seo/description'].includes(path)
    const match = path.match(/^\/sections\/(\d+)\/props\/(.+)$/)
    if (match) {
      const section = page.sections[Number(match[1])]
      const definition = section && getComponent(section.componentId)
      const keys = match[2]!.split('/')
      const field = definition?.editorFields.find((entry) => entry.path === `/${keys[0]}`)
      const exactField = definition?.editorFields.find((entry) => entry.path === `/${keys.join('/')}`)
      allowed = definition?.family !== 'REVIEWS' && !keys.some((key) => /^(phone|email|address|hours|stats|price|rating|author|source|quote)$/i.test(key)) && Boolean((exactField?.type === 'text' && keys.at(-1) === 'label') || (field && (
        (keys.length === 1 && ['text', 'textarea', 'richtext'].includes(field.type) && !/alt/i.test(keys[0]!)) ||
        (['list', 'collection'].includes(field.type) && ['title', 'heading', 'body', 'description', 'question', 'answer'].includes(keys.at(-1)!)) ||
        (keys.length === 2 && keys[1] === 'label' && definition?.editorFields.some((entry) => entry.path === `/${keys.join('/')}`))
      )))
    }
    if (!allowed || operation.op !== 'replace' || typeof operation.value !== 'string' || typeof getAtPointer(page, path) !== 'string') throw new Error('AI attempted to change more than page copy or SEO. Please try again.')
    next = setAtPointer(next, path, operation.value)
  }
  const heroIndex = next.sections.findIndex((section) => getComponent(section.componentId)?.family === 'HERO')
  if (heroIndex >= 0) {
    const headingPath = `/sections/${heroIndex}/props/heading`
    if (operations.some((operation) => operation.path === headingPath)) next = { ...next, h1: String(getAtPointer(next, headingPath)) }
    else if (next.h1 !== page.h1) next = setAtPointer(next, headingPath, next.h1)
  }
  const parsed = pageSchema.parse(next)
  for (const section of parsed.sections) {
    const result = getComponent(section.componentId)?.propsSchema.safeParse(section.props)
    if (!result?.success) throw new Error('The rewritten page has invalid section content. Please try again.')
  }
  return parsed
}
