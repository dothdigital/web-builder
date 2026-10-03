/// Model selection is configuration, never hard-coded call sites (SOW 7.1).
/// Every AI call resolves its model through a task alias so the platform admin
/// can re-point a task at a different model without a deploy.
export const aiTasks = [
  'understand_brief',
  'sitemap_plan',
  'design_dna',
  'layout_selection',
  'website_copy',
  'seo_strategy',
  'website_json',
  'final_review',
  'image_plan',
  'content_rewrite',
  'editor_command',
  'image_generate',
  'image_edit',
] as const

export type AiTask = (typeof aiTasks)[number]

export interface ModelRouting {
  model: string
  /// Tried in order when the primary model is unavailable on the account.
  fallbacks: string[]
  maxOutputTokens?: number
}

/// Defaults requested by the client. These are seeded into the database and
/// edited from admin; nothing in the pipeline reads them directly at runtime.
export const defaultModelRouting: Record<AiTask, ModelRouting> = {
  understand_brief: { model: 'gpt-5.6-sol', fallbacks: ['gpt-5.6-terra', 'gpt-4.1'] },
  sitemap_plan: { model: 'gpt-5.6-sol', fallbacks: ['gpt-5.6-terra', 'gpt-4.1'] },
  design_dna: { model: 'gpt-5.6-sol', fallbacks: ['gpt-5.6-terra', 'gpt-4.1'] },
  layout_selection: { model: 'gpt-5.6-sol', fallbacks: ['gpt-5.6-terra', 'gpt-4.1'] },
  website_copy: { model: 'gpt-5.6-sol', fallbacks: ['gpt-5.6-terra', 'gpt-4.1'] },
  seo_strategy: { model: 'gpt-5.6-sol', fallbacks: ['gpt-5.6-terra', 'gpt-4.1'] },
  website_json: { model: 'gpt-5.6-sol', fallbacks: ['gpt-5.6-terra', 'gpt-4.1'] },
  final_review: { model: 'gpt-5.6-sol', fallbacks: ['gpt-5.6-terra', 'gpt-4.1'] },
  /// Planning which slots need artwork is a text task; only the two image_*
  /// tasks below are routed to an image model.
  image_plan: { model: 'gpt-5.6-sol', fallbacks: ['gpt-5.6-terra', 'gpt-4.1'] },
  content_rewrite: { model: 'gpt-5.6-terra', fallbacks: ['gpt-5.6-luna', 'gpt-4.1-mini'] },
  editor_command: { model: 'gpt-5.6-terra', fallbacks: ['gpt-5.6-luna', 'gpt-4.1-mini'] },
  image_generate: { model: 'gpt-image-2', fallbacks: ['gpt-image-1'] },
  image_edit: { model: 'gpt-image-2', fallbacks: ['gpt-image-1'] },
}

export function resolveRouting(
  task: AiTask,
  overrides?: Partial<Record<AiTask, ModelRouting>>,
): ModelRouting {
  return overrides?.[task] ?? defaultModelRouting[task]
}
