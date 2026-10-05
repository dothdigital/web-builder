import { z } from 'zod'
import { getComponent, elementColorsSchema, imageSizesSchema, type EditorField } from '@awb/component-registry'
import { websiteModelSchema, type WebsiteModel, type WebsiteSection } from '@awb/website-model'
import { assistantPlanSchema, readAssistantValue, type AssistantPlan, type AssistantSelector } from '@awb/ai/editor-command'
import { sectionElementTree, type ElementNode } from './element-tree'
import { getAtPointer, setAtPointer } from './json-pointer'
import { editObjectProps, objectScope } from './object-editing'
import { duplicateElement } from './duplicate-element'
import { addManualObject, objectChoices, type ManualObjectKind } from './add-manual-object'

export type AssistantTarget = { id: string; scope: 'page' | 'header' | 'footer'; sectionId: string; section: string; path: string; kind: AssistantSelector['kind']; label: string; componentId?: string; editableFields?: EditorField[] }
export type AssistantSelection = { sectionId: string; paths: string[]; scope: 'page' | 'header' | 'footer' }
export function themeButtonColors(model: WebsiteModel) {
  const backgroundColor = model.tokens.buttons?.background ?? model.tokens.palette.primary
  return { backgroundColor, color: model.tokens.buttons?.text ?? model.tokens.palette.primaryForeground, borderColor: backgroundColor }
}
// Keep the wire format compatible with editor tabs opened before themeButton
// was introduced. Resolve the semantic command using this job's theme snapshot.
export function editorCompatiblePlan(plan: AssistantPlan, model: WebsiteModel): AssistantPlan {
  return { ...plan, operations: plan.operations.map(operation => operation.action === 'themeButton'
    ? { ...operation, action: 'style', valueJson: JSON.stringify(themeButtonColors(model)) }
    : operation) }
}
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const safePath = (path: string) => /^\/[a-zA-Z0-9_/-]+$/.test(path) && !path.split('/').some(part => ['__proto__', 'constructor', 'prototype'].includes(part))
const forbidden = /(?:^|\/)(?:html|css|javascript|customScripts|submissionUrl|elementOffsets|freeElements|flowSlots|removedElements|id|componentId|componentVersion)(?:\/|$)/i
function classify(path: string, props: Record<string, unknown>): AssistantTarget['kind'] {
  const scope = objectScope(props, path)
  const value = getAtPointer(scope.props, scope.path) as Record<string, unknown> | string | undefined
  if (/imageUrl$|\/images\/\d+\/url$|logoImageUrl$/.test(path)) return 'image'
  if (value && typeof value === 'object') {
    // Manual objects share optional/default fields. Their explicit kind wins:
    // an empty formFields array does not turn a button into a form.
    if (value.kind === 'form') return 'form'
    if (value.kind === 'button') return 'button'
    if (value.kind === 'image') return 'image'
    if (['text', 'heading', 'quote', 'bullets', 'numbered'].includes(String(value.kind))) return 'text'
    if (value.kind) return 'element'
    if (typeof value.label === 'string' && typeof value.href === 'string') return /\/items\//.test(path) ? 'link' : 'button'
    if (Array.isArray(value.formFields)) return 'form'
  }
  if (path.endsWith('/form')) return 'form'
  if (path.endsWith('/submitLabel')) return 'button'
  if (path.endsWith('/href')) return 'link'
  if (typeof value === 'string' && !/\/label$/.test(path.replace(/\/formFields\/\d+\/label$/, ''))) return 'text'
  if (typeof value === 'string' && !/\/(?:cta|primaryCta|secondaryCta)\/label$/.test(path)) return 'text'
  return 'element'
}
export function assistantTargets(model: WebsiteModel, pageId: string): AssistantTarget[] {
  const page = model.pages.find(page => page.id === pageId)
  if (!page) throw new Error('Current page no longer exists.')
  const targets: AssistantTarget[] = []
  const addSection = (section: WebsiteSection, scope: AssistantTarget['scope'], index: number) => {
    const manualHeading = section.componentId === 'ManualSection' && Array.isArray(section.props.items) ? section.props.items.find((item: { kind?: string }) => item.kind === 'heading')?.text : undefined
    const title = String(section.props.heading ?? section.props.title ?? manualHeading ?? getComponent(section.componentId)?.name ?? section.componentId)
    const name = `${index + 1}. ${getComponent(section.componentId)?.family ?? section.componentId} — ${title}`
    const base = { scope, sectionId: section.id, section: name }
    targets.push({ ...base, id: `${scope}:${section.id}:`, kind: 'section', path: '', label: name, componentId: section.componentId, editableFields: getComponent(section.componentId)?.editorFields })
    const walk = (nodes: ElementNode[]) => nodes.forEach(node => {
      const scoped = objectScope(section.props, node.path)
      const value = getAtPointer(scoped.props, scoped.path)
      const content = typeof value === 'string' ? value : value && typeof value === 'object' ? String((value as Record<string, unknown>).label ?? (value as Record<string, unknown>).text ?? '') : ''
      targets.push({ ...base, id: `${scope}:${section.id}:${node.path}`, path: node.path, kind: classify(node.path, section.props), label: `${node.label}${content ? ` — ${content.slice(0, 150)}` : ''}` })
      walk(node.children)
    })
    walk(sectionElementTree(section.componentId, section.props))
  }
  page.sections.filter(section => !section.hidden).forEach((section, index) => addSection(section, 'page', index))
  for (const slot of ['header', 'footer'] as const) {
    const entry = model.globalComponents[slot]
    if (entry) addSection({ ...entry, id: slot, hidden: false }, slot, 0)
  }
  return targets.filter((target, i) => targets.findIndex(other => other.id === target.id) === i)
}
export function matchAssistantTargets(targets: AssistantTarget[], selector: AssistantSelector, selection?: AssistantSelection) {
  let matches = targets.filter(target => target.scope === selector.scope)
  if (selector.section) {
    const query = normalize(selector.section)
    const sections = [...new Set(matches.map(target => target.sectionId))]
    matches = matches.filter(target => target.sectionId === selector.section || normalize(target.section).includes(query) || /^\d+$/.test(query) && target.section.startsWith(`${query}.`) || /^(last|last section)$/.test(query) && target.sectionId === sections.at(-1) || /^(first|first section)$/.test(query) && target.sectionId === sections[0])
  }
  if (selector.kind !== 'element') matches = matches.filter(target => target.kind === selector.kind)
  else matches = matches.filter(target => target.kind !== 'section')
  if (selector.text) matches = matches.filter(target => normalize(target.label).includes(normalize(selector.text)))
  if (selector.useSelection && selection?.scope === selector.scope) {
    const selected = matches.filter(target => target.sectionId === selection.sectionId && (selector.kind === 'section' ? target.kind === 'section' : selection.paths.length ? selection.paths.some(path => target.path === path) : target.kind === 'section'))
    // Never substitute another object when the selected one has a different kind.
    return selected
  }
  // A link item and its href field describe the same link. Keep child menu
  // links independent, but don't ask twice for one item's object and href.
  return matches.filter(target => !(target.kind === 'text' && targets.some(other => other.scope === target.scope && other.sectionId === target.sectionId && other.kind === 'button' && target.path.startsWith(other.path + '/')))
    && !(target.kind === 'link' && target.path.endsWith('/href') && matches.some(other => other.scope === target.scope && other.sectionId === target.sectionId && other.kind === 'link' && other.path === target.path.slice(0, -5))))
}
export type AssistantResolution = { operations: Array<{ index: number; targets: AssistantTarget[] }>; question?: { index: number; text: string; choices: AssistantTarget[] }; shared: boolean; destructive: boolean }
export function resolveAssistantPlan(model: WebsiteModel, pageId: string, plan: AssistantPlan, selection?: AssistantSelection, choices: Record<number, string[]> = {}): AssistantResolution {
  const targets = assistantTargets(model, pageId)
  const operations: AssistantResolution['operations'] = []
  for (const [index, operation] of plan.operations.entries()) {
    let matches = matchAssistantTargets(targets, operation.target, selection)
    if (choices[index]) matches = matches.filter(target => choices[index]!.includes(target.id))
    if (!matches.length && operation.action === 'addObject' && !model.pages.find(page => page.id === pageId)?.sections.length && operation.target.scope === 'page') matches = [{ id: 'new-section', scope: 'page', sectionId: '', section: 'New blank section', path: '', kind: 'section', label: 'New blank section' }]
    if (!matches.length) throw new Error('I could not find that object on this page. Select it on the canvas or use its visible text.')
    if (matches.length > 1 && !operation.target.all && !choices[index]) return { operations: [], question: { index, text: 'Which one should I change?', choices: matches.slice(0, 60) }, shared: false, destructive: false }
    operations.push({ index, targets: matches })
  }
  return { operations, shared: operations.some(op => op.targets.some(target => target.scope !== 'page')), destructive: operations.some(op => plan.operations[op.index]!.action === 'delete' && op.targets.some(target => target.kind === 'section')) || operations.filter(op => plan.operations[op.index]!.action === 'delete').reduce((n, op) => n + op.targets.length, 0) > 3 }
}
function validValue(value: unknown): void {
  if (Array.isArray(value)) { value.forEach(validValue); return }
  if (value && typeof value === 'object') for (const [key, entry] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype', 'html', 'javascript', 'css', 'submissionUrl', 'customScripts', 'elementOffsets', 'freeElements', 'flowSlots', 'removedElements'].includes(key)) throw new Error('This change is outside the assistant’s editing tools.')
    if (/href|url$/i.test(key) && typeof entry === 'string' && entry && (!/^(https?:\/\/|\/(?!\/)|#|mailto:|tel:|asset:)/i.test(entry) || /[\\\r\n]/.test(entry))) throw new Error('Use a valid image or page link.')
    validValue(entry)
  }
}
function textPath(props: Record<string, unknown>, path: string) {
  const value = getAtPointer(props, path)
  if (typeof value === 'string') return path
  for (const key of ['label', 'text', 'heading', 'title', 'body']) if (value && typeof value === 'object' && typeof (value as Record<string, unknown>)[key] === 'string') return `${path}/${key}`
  throw new Error('Select a text object or specify its text property.')
}
export function applyAssistantPlan(model: WebsiteModel, pageId: string, raw: AssistantPlan, selection?: AssistantSelection, choices: Record<number, string[]> = {}, confirmed = false, sectionWidths: Record<string, number> = {}): WebsiteModel {
  const plan = assistantPlanSchema.parse(raw)
  if (plan.kind !== 'edit' || !plan.operations.length) throw new Error('No editor changes were requested.')
  const resolution = resolveAssistantPlan(model, pageId, plan, selection, choices)
  if (resolution.question) throw new Error(resolution.question.text)
  if ((resolution.shared || resolution.destructive) && !confirmed) throw new Error('Please confirm this shared or section deletion change first.')
  const next = structuredClone(model)
  const page = next.pages.find(page => page.id === pageId)!
  for (const { index, targets } of resolution.operations) {
    const operation = plan.operations[index]!
    const value = readAssistantValue(operation)
    validValue(value)
    if (operation.action === 'link') validValue({ url: value })
    for (const target of targets) {
      let section = target.scope === 'page' ? page.sections.find(section => section.id === target.sectionId) : next.globalComponents[target.scope]
      if (!section && operation.action === 'addObject' && !target.sectionId) {
        const created: WebsiteSection = { id: crypto.randomUUID(), componentId: 'ManualSection', componentVersion: '1.0.0', hidden: false, props: { items: [] } }
        page.sections.push(created); section = created
      }
      if (!section) throw new Error('The target changed while I was working. Please send the request again.')
      const path = target.path
      const scope = objectScope(section.props, path)
      if (operation.action === 'delete') {
        if (!path) { if (target.scope !== 'page') throw new Error('Shared header/footer removal is not supported.'); page.sections = page.sections.filter(section => section.id !== target.sectionId) }
        else section.props = editObjectProps(section.props, path, { type: 'delete' })
      } else if (operation.action === 'reorder') {
        if (target.scope !== 'page' || path || typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value >= page.sections.length) throw new Error('Choose a valid section position.')
        const source = page.sections.findIndex(entry => entry.id === target.sectionId)
        const [moved] = page.sections.splice(source, 1); page.sections.splice(value, 0, moved!)
      } else if (operation.action === 'themeButton') {
        if (target.kind !== 'button') throw new Error('Select a button to apply the theme button colours.')
        section.props = editObjectProps(section.props, path, { type: 'style', value: themeButtonColors(model) })
      } else if (operation.action === 'style' || operation.action === 'imageSize') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Appearance settings must contain named properties. No changes were applied.')
        const key = path || '/layout/0'
        const schema = operation.action === 'style' ? elementColorsSchema : imageSizesSchema
        const parsed = schema.parse({ [scope.path || key]: value })[scope.path || key]!
        if (Object.keys(parsed).length !== Object.keys(value).length) throw new Error('One of those appearance settings is not supported.')
        // Header links render their label node, not the backing menu item object.
        const stylePath = operation.action === 'style' && section.componentId.startsWith('Header') && /^\/items\/\d+(?:\/children\/\d+)*$/.test(key) ? `${key}/label` : key
        if (operation.action === 'style' && section.componentId.startsWith('Header') && key === '/layout/0' && 'backgroundColor' in parsed && typeof parsed.backgroundColor === 'string') {
          const { backgroundColor, ...rest } = parsed
          section.props = { ...section.props, customBackground: true, backgroundColor }
          if (Object.keys(rest).length) section.props = editObjectProps(section.props, key, { type: 'style', value: rest })
        } else section.props = editObjectProps(section.props, stylePath, { type: operation.action === 'style' ? 'style' : 'imageSize', value: parsed })
        if (scope.root && (typeof parsed.width === 'number' || typeof parsed.height === 'number')) section.props = editObjectProps(section.props, key, { type: 'placement', value: { ...(typeof parsed.width === 'number' ? { width: parsed.width } : {}), ...(typeof parsed.height === 'number' ? { height: parsed.height } : {}) } })
      } else if (operation.action === 'move') {
        if (!path) throw new Error('Use section reordering to move a whole section.')
        const delta = z.object({ x: z.number().min(-2000).max(2000), y: z.number().min(-2000).max(2000) }).strict().parse(value)
        if (scope.root && delta.x !== 0 && !(sectionWidths[target.sectionId] > 0)) throw new Error('Open this page in the editor before moving this floating object horizontally.')
        if (scope.root) section.props = editObjectProps(section.props, path, { type: 'placement', value: { y: scope.entry!.y + delta.y, x: scope.entry!.x + (delta.x ? delta.x / sectionWidths[target.sectionId]! * 100 : 0) } })
        else {
          const offsets = (scope.props.elementOffsets ?? {}) as Record<string, { x: number; y: number }>
          const previous = offsets[scope.path] ?? { x: 0, y: 0 }
          section.props = setAtPointer(section.props, `${scope.prefix}/elementOffsets`, { ...offsets, [scope.path]: { ...previous, x: previous.x + delta.x, y: previous.y + delta.y } })
        }
      } else if (operation.action === 'duplicate') {
        if (!path) { if (target.scope !== 'page') throw new Error('Cannot duplicate the global header or footer.'); const i = page.sections.findIndex(entry => entry.id === target.sectionId); page.sections.splice(i + 1, 0, { ...structuredClone(page.sections[i]!), id: crypto.randomUUID() }) }
        else {
          const copied = duplicateElement(scope.props, scope.path)
          if (!copied) throw new Error('This object cannot be duplicated through chat yet. Use its editor duplicate control.')
          section.props = scope.prefix ? setAtPointer(section.props, scope.prefix, copied.props) : copied.props
        }
      } else if (operation.action === 'addObject') {
        if (path || target.scope !== 'page') throw new Error('Choose a page section for the new object.')
        const input = z.object({ kind: z.enum(objectChoices.map(([kind]) => kind) as [ManualObjectKind, ...ManualObjectKind[]]), props: z.record(z.string(), z.unknown()).default({}) }).parse(value)
        if (input.kind === 'embed') throw new Error('Scripts and HTML must be added manually.')
        const added = addManualObject(section as WebsiteSection, input.kind, crypto.randomUUID(), 500)
        const addedScope = objectScope(added.section.props, added.path)
        const itemPath = addedScope.prefix ? `${addedScope.prefix}${addedScope.path}` : added.path
        const original = getAtPointer(added.section.props, itemPath) as Record<string, unknown>
        section.props = setAtPointer(added.section.props, itemPath, { ...original, ...input.props, id: original.id, kind: input.kind })
      } else {
        const contentPath = scope.path === '/form' && (scope.entry?.componentId ?? section.componentId) === 'ContactSplit' ? '' : scope.path
        let pointer = operation.property ? `${contentPath}${operation.property}` : contentPath
        if (!path) pointer = operation.property
        if (operation.action === 'text') pointer = operation.property ? pointer : textPath(scope.props, scope.path)
        if (operation.action === 'link') pointer = scope.path.endsWith('/href') ? scope.path : `${scope.path}/href`
        // AI may name the field already selected by the target. A scalar cannot
        // contain another field: /heading + /heading must remain /heading.
        if (typeof getAtPointer(scope.props, contentPath) === 'string' && operation.property) {
          const leaf = '/' + contentPath.split('/').at(-1)
          if (operation.property === contentPath || operation.property === leaf) pointer = contentPath
          else throw new Error('The selected text does not contain that property. Select the object you want to change.')
        }
        if (!safePath(pointer) || forbidden.test(pointer)) throw new Error('That property is outside the assistant’s scope.')
        const editable = getComponent(scope.entry?.componentId ?? section.componentId)?.editorFields.some(field => pointer === field.path || pointer.startsWith(`${field.path}/`))
        if (!editable) throw new Error('That property is not an editable website field.')
        if (['text', 'link'].includes(operation.action) && typeof value !== 'string') throw new Error('Expected text for this change.')
        if (/href|url$/i.test(pointer)) validValue({ url: value })
        section.props = setAtPointer(section.props, `${scope.prefix}${pointer}`, value)
        if (section.componentId.startsWith('Header') && !scope.prefix && pointer === '/backgroundColor') section.props = { ...section.props, customBackground: true }
        const checked = getComponent(section.componentId)!.propsSchema.safeParse(section.props)
        if (!checked.success) throw new Error('The proposed edit does not fit this component. No changes were applied. Please send the request again.')
        if (getAtPointer(checked.data, `${scope.prefix}${pointer}`) === undefined) throw new Error('That property is not supported by this component.')
      }
      const definition = getComponent(section.componentId)
      if (!definition?.propsSchema.safeParse(section.props).success) throw new Error('The proposed edit does not fit this component. No changes were applied.')
    }
  }
  // Parse only as validation: returning parsed defaults would modify unrelated pages.
  websiteModelSchema.parse(next)
  return next
}
