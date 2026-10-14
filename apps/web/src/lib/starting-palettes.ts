import { defaultTokens } from '@awb/component-registry'
import type { DesignTokens } from '@awb/website-model'

export const startingPalettes: Array<{ id: string; label: string; rationale: string; tokens: DesignTokens }> = [
  { id: 'ocean', label: 'Ocean blue', rationale: 'Blue and teal on a light background.', primary: '#1d4ed8', accent: '#0f766e', surface: '#eff6ff', border: '#cbd5e1' },
  { id: 'forest', label: 'Forest green', rationale: 'Deep green and warm gold with soft neutral surfaces.', primary: '#166534', accent: '#a16207', surface: '#f0fdf4', border: '#cbd5c0' },
  { id: 'plum', label: 'Plum and rose', rationale: 'Rich purple and rose on a soft cream background.', primary: '#6b21a8', accent: '#be123c', surface: '#faf5ff', border: '#e9d5ff' },
  { id: 'terracotta', label: 'Warm terracotta', rationale: 'Earthy orange and deep teal with warm neutrals.', primary: '#9a3412', accent: '#115e59', surface: '#fff7ed', border: '#fed7aa' },
  { id: 'neutral', label: 'Classic neutral', rationale: 'Charcoal and warm gold for a simple, understated style.', primary: '#14110f', accent: '#8a682f', surface: '#f5f4f2', border: '#e3ded8' },
].map(({ id, label, rationale, primary, accent, surface, border }) => ({
  id, label, rationale,
  tokens: { ...defaultTokens, palette: { ...defaultTokens.palette, primary, accent, surface, border } },
}))
