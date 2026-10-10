import type { ComponentType } from 'react'
import type { z } from 'zod'
import type { DesignTokens } from '@awb/website-model'

export type ComponentFamily =
  | 'HEADER'
  | 'HERO'
  | 'SERVICES'
  | 'ABOUT'
  | 'GALLERY'
  | 'PORTFOLIO'
  | 'CREDENTIALS'
  | 'REVIEWS'
  | 'TEAM'
  | 'PRICING'
  | 'FAQ'
  | 'CONTACT'
  | 'CTA'
  | 'FOOTER'

export type EditorFieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'image'
  | 'link'
  | 'select'
  | 'boolean'
  | 'number'
  | 'range'
  | 'color'
  | 'collection'
  | 'list'

export interface EditorField {
  path: string
  label: string
  type: EditorFieldType
  options?: string[]
  help?: string
  min?: number
  max?: number
  step?: number
  /// Heading level rendered for this field, so the editor can enforce semantics
  headingLevel?: 1 | 2 | 3
}

export interface RenderContext {
  /** Stable instance scope for standalone rendering without React hooks. */
  staticRenderScope?: string
  forms?: { projectId: string; action: string; recaptchaSiteKey?: string }
  serviceLinks?: Array<{ label:string;href:string }>
  templateTheme?: string

  tokens: DesignTokens
  /// Absolute base URL of the rendered site, used for canonical/OG links
  baseUrl: string
  /// True while rendering inside the editor preview
  editing?: boolean
}

export interface SectionComponentProps<P> {
  props: P
  context: RenderContext
}

export interface ComponentDefinition<S extends z.ZodTypeAny = z.ZodTypeAny> {
  componentId: string
  version: string
  family: ComponentFamily
  name: string
  description: string
  /// Guidance handed to the AI composer when it picks components
  aiGuidance: string
  propsSchema: S
  editorFields: EditorField[]
  tokenDeps: string[]
  /// Sample props used for QA fixtures and editor previews
  fixture: z.infer<S>
  render: ComponentType<SectionComponentProps<z.infer<S>>>
}

export function defineComponent<S extends z.ZodTypeAny>(
  definition: ComponentDefinition<S>,
): ComponentDefinition<S> {
  return definition
}
