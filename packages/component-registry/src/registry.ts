import { portfolioShowcase, credentialsShowcase } from './components/showcase'
import { importedLayoutDefinitions } from './imported-layouts'
import { inlineLinksSchema, applyInlineLinks } from './inline-links'
import { manualSection } from './components/manual-section'
import { elementOffsetsSchema, applyElementOffsets } from './element-offsets'
import { blogArticle, blogListing } from './components/blog'
import { ResponsiveEdits, hasLayoutEdits } from './responsive-edits'
import { flowSlotsSchema, applyFlowSlots } from './flow-slots'
import { annotateLayout, layoutNodes } from './layout-elements'
import { defaultTokens } from './tokens'
import { freeElementsSchema, FreeLayout, findElement } from './free-elements'
import { extraElementsSchema, insertExtraElements } from './extra-elements'
import { RemovedElements, removedElementsSchema } from './removed-elements'
import { elementColorsSchema } from './element-colors'
import { z } from 'zod'
import { normalizeHeroSettings } from './hero-settings'
import { createElement } from 'react'
import { SectionBackground, sectionBackgroundFields, sectionBackgroundSchema } from './section-background'
import type { ComponentDefinition, ComponentFamily } from './types'
import { headerSplitUtility, headerTransparent } from './components/headers'
import { heroEditorial, heroSplitBooking, heroTypographic } from './components/heroes'
import { servicesAlternatingShowcase, servicesImageRail, servicesLargeNumbers } from './components/services'
import { aboutSplitOverlap, galleryAsymmetric, reviewsEditorialQuote, reviewsTrustStrip } from './components/editorial'
import { contactSplit, ctaCinematic, faqAccordion } from './components/conversion'
import { footerCompact, footerEditorial } from './components/footers'

// Next.js substitutes this public flag in browser bundles; workers read it
// from their environment. Keep this browser package free of Node imports.
declare const process: { env: { NEXT_PUBLIC_ENABLE_LAYOUT_TEMPLATES?: string } }

const definitions = [
  ...importedLayoutDefinitions,
  manualSection,
  portfolioShowcase,
  credentialsShowcase,
  blogArticle,
  blogListing,
  headerTransparent,
  headerSplitUtility,
  heroEditorial,
  heroSplitBooking,
  heroTypographic,
  servicesLargeNumbers,
  servicesImageRail,
  servicesAlternatingShowcase,
  aboutSplitOverlap,
  galleryAsymmetric,
  reviewsEditorialQuote,
  reviewsTrustStrip,
  contactSplit,
  ctaCinematic,
  faqAccordion,
  footerEditorial,
  footerCompact,
] as unknown as ComponentDefinition[]

export const componentRegistry: ReadonlyMap<string, ComponentDefinition> = new Map(
  definitions.map((definition) => {
    const Original = definition.render
    const propsSchema = (definition.propsSchema as z.ZodObject).extend({ ...sectionBackgroundSchema.shape, inlineLinks: inlineLinksSchema, elementColors: elementColorsSchema, removedElements: removedElementsSchema, extraElements: extraElementsSchema, flowSlots: flowSlotsSchema, elementOffsets: elementOffsetsSchema, freeElements: freeElementsSchema, elementGroups: z.array(z.object({ id: z.string().max(100), paths: z.array(z.string().regex(/^\/[a-zA-Z0-9_/-]+$/)).min(2).max(100) })).max(100).default([]), freeLayoutMinHeight: z.number().min(0).max(20000).default(0) }).superRefine((props, ctx) => {
      for (const [index, entry] of freeElementsSchema.parse(props.freeElements).entries()) {
        const source = definitions.find((candidate) => candidate.componentId === entry.componentId)
        if (!source || !(source.propsSchema as z.ZodObject).extend({ ...sectionBackgroundSchema.shape, inlineLinks: inlineLinksSchema, elementColors: elementColorsSchema, extraElements: extraElementsSchema, flowSlots: flowSlotsSchema, elementOffsets: elementOffsetsSchema, removedElements: removedElementsSchema }).safeParse(entry.content).success || Array.isArray(entry.content.freeElements) && entry.content.freeElements.length) ctx.addIssue({ code: "custom", path: ["freeElements", index], message: "Invalid moved object content" })
      }
    })
    const enhanced: ComponentDefinition = {
      ...definition,
      propsSchema,
      editorFields: [...definition.editorFields, ...sectionBackgroundFields],
      render: ({ props, context }) => {
        const values = props as Record<string, unknown>
        const renderOriginal = (input: Record<string, unknown>) => applyInlineLinks(applyElementOffsets(applyFlowSlots(insertExtraElements(annotateLayout((Original as (input: { props: unknown; context: import('./types').RenderContext }) => import('react').ReactNode)({ props: input, context }), input), input), input), input), input)
        const wrap = (children: import('react').ReactNode) => {
          const result = createElement(RemovedElements, { scope: context.staticRenderScope, paths: removedElementsSchema.parse(values.removedElements), children: createElement(FreeLayout, { children, minimumHeight: Number(values.freeLayoutMinHeight ?? 0), removed: removedElementsSchema.parse(values.removedElements), elements: freeElementsSchema.parse(values.freeElements), render: (entry) => {
          const source = definitions.find((candidate) => candidate.componentId === entry.componentId)
          if (!source) return null
          const parsed = (source.propsSchema as z.ZodObject).extend({ ...sectionBackgroundSchema.shape, inlineLinks: inlineLinksSchema, elementColors: elementColorsSchema, extraElements: extraElementsSchema, flowSlots: flowSlotsSchema, elementOffsets: elementOffsetsSchema, removedElements: removedElementsSchema }).safeParse(entry.content)
          if (!parsed.success) return null
          const content = parsed.data as Record<string, unknown>
          const tree = insertExtraElements(annotateLayout((source.render as (input: { props: unknown; context: import('./types').RenderContext }) => import('react').ReactNode)({ props: content, context }), content), content)
          return findElement(applyInlineLinks(applyElementOffsets(applyFlowSlots(tree, { ...content, removedElements: entry.content.removedElements }), content), content), entry.source) ?? null
        } }) })
          const sectionWidths = (input: Record<string, unknown>) => Object.values((input.elementColors ?? {}) as Record<string, { widthBasis?: string }>).some((style) => style.widthBasis === 'section')
          const bounded = sectionWidths(values) || freeElementsSchema.parse(values.freeElements).some((entry) => sectionWidths(entry.content))
            ? createElement('div', { 'data-awb-width-boundary': 'section', style: { position: 'relative', containerType: 'inline-size', width: '100%', minWidth: 0 } }, result)
            : result
          return definition.family !== 'HEADER' && definition.family !== 'FOOTER' && hasLayoutEdits(values) ? createElement(ResponsiveEdits, { children: bounded, background: values.sectionBackgroundMode !== 'original' ? String(values.sectionBackgroundColor ?? 'var(--awb-bg)') : undefined }) : bounded
        }
        // Heroes own their full-bleed layout. A generic wrapper must not hide it.
        if (definition.family === 'HERO' && definition.editorFields.some(field => field.path === '/imageLayout') && (values.imageLayout === 'background' || values.sectionBackgroundMode === 'image')) {
          const heroProps = normalizeHeroSettings(values)
          return wrap(renderOriginal(heroProps))
        }
        return wrap(createElement(SectionBackground, { props: sectionBackgroundSchema.parse(props), children: renderOriginal(values) }))
      },
    }
    return [definition.componentId, enhanced]
  }),
)

export function getComponent(componentId: string): ComponentDefinition | undefined {
  return componentRegistry.get(componentId)
}

export function componentLayoutNodes(componentId: string, props: Record<string, unknown>) {
  const source = definitions.find((candidate) => candidate.componentId === componentId)
  const parsed = source?.propsSchema.safeParse(props)
  if (!source || !parsed?.success) return []
  const tree = (source.render as (args: { props: unknown; context: import('./types').RenderContext }) => import('react').ReactNode)({ props: parsed.data, context: { tokens: defaultTokens, baseUrl: '', editing: true } })
  return layoutNodes(annotateLayout(tree, props))
}

export function listComponents(family?: ComponentFamily): ComponentDefinition[] {
  const all = [...componentRegistry.values()].filter(definition => process.env.NEXT_PUBLIC_ENABLE_LAYOUT_TEMPLATES === 'true' || !definition.componentId.startsWith('Tpl_'))
  return family ? all.filter((definition) => definition.family === family) : all
}

export interface CatalogueEntry {
  componentId: string
  family: ComponentFamily
  version: string
  description: string
  aiGuidance: string
  /// Prop contract the composer must satisfy; props are rejected otherwise.
  propsSchema: unknown
  exampleProps: unknown
}

/// Compact catalogue handed to the AI composer: it may only choose from these
/// ids, and the prop schema travels with each entry so generated sections
/// survive registry validation.
export function registryCatalogue(family?: ComponentFamily): CatalogueEntry[] {
  return listComponents(family).filter(definition => !definition.componentId.startsWith('Tpl_')).map((definition) => ({
    componentId: definition.componentId,
    family: definition.family,
    version: definition.version,
    description: definition.description,
    aiGuidance: definition.aiGuidance,
    propsSchema: z.toJSONSchema(definition.propsSchema, { io: 'input', unrepresentable: 'any' }),
    exampleProps: definition.fixture,
  }))
}

function isEmptyImageValue(value: unknown): boolean {
  return typeof value !== 'string' || value.trim().length === 0
}

/// JSON pointers inside a section's props that still need artwork, derived from
/// the component's editor fields so image planning never depends on the AI
/// inventing slot names.
export function emptyImagePointers(componentId: string, props: unknown): string[] {
  // Real work and credentials must use user-provided imagery, never invented evidence.
  if (componentId === 'PortfolioShowcase' || componentId === 'CredentialsShowcase') return []

  const definition = componentRegistry.get(componentId)

  if (!definition || typeof props !== 'object' || props === null) {
    return []
  }

  const record = props as Record<string, unknown>
  const pointers: string[] = []

  for (const field of definition.editorFields) {
    const key = field.path.replace(/^\//, '')

    // Optional decorative backgrounds are editor choices, not required AI image slots.
    if (field.path === '/sectionBackgroundImageUrl') continue

    if (field.type === 'image') {
      if (isEmptyImageValue(record[key])) {
        pointers.push(field.path)
      }

      continue
    }

    if (field.type !== 'list') {
      continue
    }

    const items = record[key]

    if (!Array.isArray(items)) {
      continue
    }

    items.forEach((item, index) => {
      if (typeof item !== 'object' || item === null) {
        return
      }

      const entry = item as Record<string, unknown>

      if (('url' in entry || 'alt' in entry) && isEmptyImageValue(entry['url'])) {
        pointers.push(`${field.path}/${index}/url`)
      }
    })
  }

  return pointers
}

export interface SectionValidationError {
  sectionId: string
  componentId: string
  message: string
}

/// Rejects unknown components and prop payloads that fail the component schema.
export function validateSectionProps(
  sectionId: string,
  componentId: string,
  props: unknown,
): { ok: true; props: unknown } | { ok: false; error: SectionValidationError } {
  const definition = componentRegistry.get(componentId)

  if (!definition) {
    return { ok: false, error: { sectionId, componentId, message: `Unknown component "${componentId}"` } }
  }

  const parsed = definition.propsSchema.safeParse(props)

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        sectionId,
        componentId,
        message: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'props'}: ${issue.message}`).join('; '),
      },
    }
  }

  return { ok: true, props: parsed.data }
}
