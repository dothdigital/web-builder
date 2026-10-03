import { z } from 'zod'

export const designDirections = [
  'editorial-luxury',
  'boutique',
  'organic',
  'architectural',
  'bold-contemporary',
  'modern-minimal',
  'playful',
  'corporate',
  'fashion',
  'tech',
] as const

export const designDnaSchema = z.object({
  direction: z.enum(designDirections),
  composition: z.object({
    symmetry: z.enum(['symmetric', 'mostly-asymmetric', 'asymmetric']),
    density: z.enum(['airy', 'balanced', 'dense']),
    width: z.enum(['contained', 'wide', 'full-bleed']),
    rhythm: z.enum(['alternating', 'cinematic', 'modular', 'story-led', 'conversion-led']),
  }),
  typography: z.object({
    headingStyle: z.enum([
      'editorial-serif',
      'oversized-serif',
      'geometric-sans',
      'condensed-display',
      'mixed-serif-sans',
    ]),
    bodyStyle: z.enum(['clean-sans', 'humanist-sans', 'readable-serif']),
    scale: z.enum(['restrained', 'standard', 'dramatic']),
  }),
  imagery: z.object({
    style: z.enum([
      'documentary',
      'studio',
      'high-fashion',
      'fashion-editorial',
      'warm-lifestyle',
      'product-focused',
      'illustration-led',
    ]),
    dominance: z.enum(['low', 'medium', 'high']),
    treatment: z.enum(['natural', 'duotone', 'high-contrast', 'soft-grain']),
  }),
  navigation: z.enum([
    'transparent-overlay',
    'centered-logo',
    'split-nav',
    'compact-sticky',
    'utility-plus-primary',
  ]),
  motion: z.enum(['none', 'subtle', 'expressive']),
  corners: z.enum(['sharp', 'soft', 'pill', 'framed', 'borderless']),
  ctaStyle: z.enum(['solid', 'outline', 'text-link', 'floating-booking', 'sticky-mobile']),
  colorBehavior: z.enum(['monochrome', 'high-contrast', 'tonal', 'accent-led', 'editorial-neutrals']),
})

export type DesignDna = z.infer<typeof designDnaSchema>

export const designTokensSchema = z.object({
  buttons: z.object({ background: z.string().regex(/^#[0-9a-fA-F]{6}$/), text: z.string().regex(/^#[0-9a-fA-F]{6}$/), outline: z.string().regex(/^#[0-9a-fA-F]{6}$/) }).optional(),
  palette: z.object({
    background: z.string(),
    surface: z.string(),
    foreground: z.string(),
    muted: z.string(),
    primary: z.string(),
    primaryForeground: z.string(),
    accent: z.string(),
    border: z.string(),
  }),
  typography: z.object({
    headingFamily: z.string(),
    bodyFamily: z.string(),
    baseSize: z.number().min(12).max(22),
    scaleRatio: z.number().min(1.05).max(1.6),
  }),
  radius: z.enum(['none', 'sm', 'md', 'lg', 'full']),
  spacing: z.enum(['tight', 'normal', 'roomy']),
  maxWidth: z.number().min(960).max(1800),
})

export type DesignTokens = z.infer<typeof designTokensSchema>
