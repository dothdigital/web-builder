import type { CSSProperties } from 'react'
import type { DesignTokens } from '@awb/website-model'
import colors from './imported/brand-colors.json'
import { tokensToCssVars } from './tokens'

const roles:Record<string,string>=colors
const names:Record<string,string>={foreground:'fg',background:'bg'}
export function templateBrandColor(value:string):string {
  return value.replace(/#[0-9a-f]{3,8}\b/gi,color=>{
    const role=roles[color.toLowerCase()]
    return role?`var(--awb-${names[role]||role},${color})`:color
  })
}

export function templateColorVars(tokens:DesignTokens):CSSProperties {
  const values:Record<string,string>={
    '--color-primary':tokens.palette.primary,'--color-secondary':tokens.palette.accent,'--color-terciary':tokens.palette.accent,
    '--color-primary-alta':tokens.palette.surface,'--color-gray':tokens.palette.surface,'--color-gray-2':tokens.palette.surface,
    '--color-body':tokens.palette.muted,'--color-body-2':tokens.palette.muted,'--color-heading-1':tokens.palette.foreground,'--color-light-heading':tokens.palette.foreground,'--color-light-body':tokens.palette.muted,
    '--color-subtitle':tokens.palette.primary,'--background-color-1':tokens.palette.foreground,
    '--font-primary':tokens.typography.bodyFamily,'--font-primary-two':tokens.typography.bodyFamily,'--font-secondary':tokens.typography.headingFamily,'--font-secondary-two':tokens.typography.headingFamily,
  }
  for(let index=2;index<=11;index++) values[`--color-primary-${index}`]=index===11?tokens.palette.accent:tokens.palette.primary
  return {...tokensToCssVars(tokens),...values,fontFamily:tokens.typography.bodyFamily} as CSSProperties
}
