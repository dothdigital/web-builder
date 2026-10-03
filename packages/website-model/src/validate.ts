import { websiteModelSchema, type WebsiteModel } from './model'

export interface ValidationIssue {
  level: 'error' | 'warning'
  code: string
  message: string
  pagePath?: string
  sectionId?: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

/// Structural validation (Zod) plus the SOW's cross-page publish rules.
export function validateWebsiteModel(input: unknown): ValidationResult & { model?: WebsiteModel } {
  const parsed = websiteModelSchema.safeParse(input)

  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map((issue) => ({
        level: 'error' as const,
        code: 'schema',
        message: `${issue.path.join('.')}: ${issue.message}`,
      })),
    }
  }

  const model = parsed.data
  const issues: ValidationIssue[] = []
  const paths = new Set<string>()
  const pageIds = new Set(model.pages.map((page) => page.id))

  for (const page of model.pages) {
    if (paths.has(page.path)) {
      issues.push({ level: 'error', code: 'duplicate-route', message: `Duplicate route ${page.path}`, pagePath: page.path })
    }
    paths.add(page.path)

    if (page.seo.index && page.seo.description.trim().length === 0) {
      issues.push({ level: 'warning', code: 'missing-meta-description', message: 'Indexable page has no meta description', pagePath: page.path })
    }

    if (page.seo.title.length > 60) {
      issues.push({ level: 'warning', code: 'seo-title-length', message: `SEO title is ${page.seo.title.length} characters (advisory limit 60)`, pagePath: page.path })
    }

    if (page.seo.description.length > 160) {
      issues.push({ level: 'warning', code: 'meta-description-length', message: `Meta description is ${page.seo.description.length} characters (advisory limit 160)`, pagePath: page.path })
    }

    if (page.sections.length === 0) {
      issues.push({ level: 'error', code: 'empty-page', message: 'Page has no sections', pagePath: page.path })
    }
  }

  const duplicateTitles = findDuplicates(model.pages.filter((p) => p.seo.index).map((p) => p.seo.title.trim().toLowerCase()))
  for (const title of duplicateTitles) {
    issues.push({ level: 'warning', code: 'duplicate-seo-title', message: `Duplicate SEO title: "${title}"` })
  }

  const duplicateH1s = findDuplicates(model.pages.map((p) => p.h1.trim().toLowerCase()))
  for (const h1 of duplicateH1s) {
    issues.push({ level: 'warning', code: 'duplicate-h1', message: `Duplicate H1: "${h1}"` })
  }

  for (const item of flattenMenu(model.navigation.primaryMenu).concat(flattenMenu(model.navigation.footerMenu))) {
    if (item.linkType === 'PAGE' && (!item.pageId || !pageIds.has(item.pageId))) {
      issues.push({ level: 'error', code: 'broken-menu-link', message: `Menu item "${item.label}" points at an unknown page` })
    }
  }

  const linkedPageIds = new Set(
    flattenMenu(model.navigation.primaryMenu)
      .concat(flattenMenu(model.navigation.footerMenu))
      .map((item) => item.pageId)
      .filter((id): id is string => Boolean(id)),
  )

  for (const page of model.pages) {
    if (page.path !== '/' && !linkedPageIds.has(page.id)) {
      issues.push({ level: 'warning', code: 'orphan-page', message: 'Page is not reachable from any menu', pagePath: page.path })
    }
  }

  return { valid: !issues.some((issue) => issue.level === 'error'), issues, model }
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
    }
    seen.add(value)
  }

  return [...duplicates]
}

function flattenMenu<T extends { children: T[] }>(items: T[]): T[] {
  return items.flatMap((item) => [item, ...flattenMenu(item.children)])
}
