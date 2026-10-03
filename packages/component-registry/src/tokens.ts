import type { DesignTokens } from '@awb/website-model'
import type { CSSProperties } from 'react'

const radiusScale: Record<DesignTokens['radius'], string> = {
  none: '0px',
  sm: '4px',
  md: '10px',
  lg: '20px',
  full: '9999px',
}

const spacingScale: Record<DesignTokens['spacing'], string> = {
  tight: '3rem',
  normal: '5rem',
  roomy: '8rem',
}

/// Tokens are exposed as CSS custom properties so every component styles itself
/// from the same global source and section-level overrides stay possible.
export function tokensToCssVars(tokens: DesignTokens): CSSProperties {
  return {
    '--awb-bg': tokens.palette.background,
    '--awb-surface': tokens.palette.surface,
    '--awb-fg': tokens.palette.foreground,
    '--awb-muted': tokens.palette.muted,
    '--awb-primary': tokens.palette.primary,
    '--awb-card-fg': tokens.palette.foreground,
    '--awb-card-muted': tokens.palette.muted,
    '--awb-primary-fg': tokens.palette.primaryForeground,
    '--awb-button-bg': tokens.buttons?.background ?? tokens.palette.primary,
    '--awb-button-fg': tokens.buttons?.text ?? tokens.palette.primaryForeground,
    '--awb-button-outline': tokens.buttons?.outline ?? 'currentColor',
    '--awb-accent': tokens.palette.accent,
    '--awb-border': tokens.palette.border,
    '--awb-heading-font': tokens.typography.headingFamily,
    '--awb-body-font': tokens.typography.bodyFamily,
    '--awb-base-size': `${tokens.typography.baseSize}px`,
    '--awb-scale': String(tokens.typography.scaleRatio),
    '--awb-radius': radiusScale[tokens.radius],
    '--awb-section-space': `clamp(3rem, 6vw, ${spacingScale[tokens.spacing]})`,
    '--awb-max-width': `${tokens.maxWidth}px`,
  } as CSSProperties
}

export const defaultTokens: DesignTokens = {
  palette: {
    background: '#ffffff',
    surface: '#f5f4f2',
    foreground: '#14110f',
    muted: '#6b6560',
    primary: '#14110f',
    primaryForeground: '#ffffff',
    accent: '#b08d57',
    border: '#e3ded8',
  },
  typography: {
    headingFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    bodyFamily: 'Inter, system-ui, sans-serif',
    baseSize: 16,
    scaleRatio: 1.25,
  },
  radius: 'lg',
  spacing: 'normal',
  maxWidth: 1520,
}
