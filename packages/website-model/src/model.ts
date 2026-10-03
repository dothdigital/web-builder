import { z } from 'zod'
import { designDnaSchema, designTokensSchema } from './design-dna'

export const WEBSITE_MODEL_SCHEMA_VERSION = '1.0.0'

export const seoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(400).default(''),
  index: z.boolean().default(true),
  canonical: z.string().optional(),
  ogImageAssetId: z.string().optional(),
})

export const sectionSchema = z.object({
  id: z.string().min(1),
  componentId: z.string().min(1),
  componentVersion: z.string().default('1.0.0'),
  variantOf: z.string().optional(),
  hidden: z.boolean().default(false),
  /// Validated against the component's own prop schema by the registry
  props: z.record(z.string(), z.unknown()).default({}),
})

export const customScriptsSchema = z.object({ head: z.string().max(50000).default(''), bodyEnd: z.string().max(50000).default('') })

export const pageSchema = z.object({
  id: z.string().min(1),
  path: z.string().regex(/^\/[a-z0-9\-\/]*$/, 'path must be a lowercase absolute route'),
  title: z.string().min(1),
  navLabel: z.string().optional(),
  pageType: z.string().default('CUSTOM'),
  contentBrief: z.object({ keyword: z.string(), secondaryKeywords: z.string().default(''), audience: z.string(), goal: z.string(), location: z.string().default(''), details: z.string(), internalPaths: z.array(z.string()).default([]) }).optional(),
  h1: z.string().min(1),
  seo: seoSchema,
  sections: z.array(sectionSchema),
  customScripts: customScriptsSchema.optional(),
})

export const menuItemSchema: z.ZodType<MenuItem> = z.lazy(() =>
  z.object({
    label: z.string().min(1),
    linkType: z.enum(['PAGE', 'URL', 'ANCHOR', 'EMAIL', 'PHONE', 'ACTION']).default('PAGE'),
    pageId: z.string().optional(),
    url: z.string().optional(),
    anchor: z.string().optional(),
    newTab: z.boolean().default(false),
    children: z.array(menuItemSchema).default([]),
  }),
)

export interface MenuItem {
  label: string
  linkType: 'PAGE' | 'URL' | 'ANCHOR' | 'EMAIL' | 'PHONE' | 'ACTION'
  pageId?: string
  url?: string
  anchor?: string
  newTab: boolean
  children: MenuItem[]
}

export const navigationSchema = z.object({
  primaryMenu: z.array(menuItemSchema),
  footerMenu: z.array(menuItemSchema).default([]),
  utilityMenu: z.array(menuItemSchema).default([]),
})

export const globalComponentSchema = z.object({
  componentId: z.string().min(1),
  componentVersion: z.string().default('1.0.0'),
  props: z.record(z.string(), z.unknown()).default({}),
})

export const collectionItemSchema = z.object({
  id: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
})

export const socialLinkSchema = z.object({
  network: z.string().min(1),
  url: z.string().min(1),
  label: z.string().optional(),
})

/// Factual business details the user supplied; never AI-invented.
export const contactSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  hours: z
    .array(z.object({ day: z.string(), opens: z.string(), closes: z.string(), closed: z.boolean().default(false) }))
    .default([]),
})

export const googleSettingsSchema = z.object({
  businessProfileUrl: z.string().optional(),
  mapsUrl: z.string().optional(),
  placeId: z.string().optional(),
  searchConsoleVerification: z.string().optional(),
})

export const websiteModelSchema = z.object({
  schemaVersion: z.literal(WEBSITE_MODEL_SCHEMA_VERSION),
  site: z.object({
    name: z.string().min(1),
    locale: z.string().default('en'),
    primaryDomain: z.string().optional(),
    previewHost: z.string(),
  }),
  businessProfileRef: z.string(),
  designDna: designDnaSchema,
  tokens: designTokensSchema,
  navigation: navigationSchema,
  globalComponents: z.object({
    header: globalComponentSchema,
    footer: globalComponentSchema,
  }),
  pages: z.array(pageSchema).min(1),
  collections: z.record(z.string(), z.array(collectionItemSchema)).default({}),
  socials: z.array(socialLinkSchema).default([]),
  contact: contactSchema.default({ hours: [] }),
  google: googleSettingsSchema.default({}),
  schemaSettings: z
    .object({
      organizationType: z.string().default('Organization'),
      enabledTypes: z.array(z.string()).default([]),
    })
    .default({ organizationType: 'Organization', enabledTypes: [] }),
  customScripts: customScriptsSchema.optional(),
  analyticsSettings: z
    .object({
      ga4MeasurementId: z.string().regex(/^(G-[A-Z0-9]+)?$/, 'Use a GA4 measurement ID starting with G-').optional(),
      gtmContainerId: z.string().optional(),
      conversionEvents: z.array(z.string()).default([]),
    })
    .default({ conversionEvents: [] }),
  publishSettings: z
    .object({
      wwwPreference: z.enum(['www', 'non-www']).default('non-www'),
      robotsAllowIndexing: z.boolean().default(true),
    })
    .default({ wwwPreference: 'non-www', robotsAllowIndexing: true }),
})

export type WebsiteModel = z.infer<typeof websiteModelSchema>
export type WebsitePage = z.infer<typeof pageSchema>
export type WebsiteSection = z.infer<typeof sectionSchema>
export type Seo = z.infer<typeof seoSchema>
export type SocialLinkEntry = z.infer<typeof socialLinkSchema>
export type SiteContact = z.infer<typeof contactSchema>
export type GoogleSettings = z.infer<typeof googleSettingsSchema>
export type AnalyticsSettings = WebsiteModel['analyticsSettings']
