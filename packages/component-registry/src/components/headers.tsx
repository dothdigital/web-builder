import type { CSSProperties } from 'react'
import type { DesignTokens } from '@awb/website-model'
import { mobileMenuColors } from '../mobile-menu-colors'
import { elementColor } from '../element-colors'
import { imageSizing } from '../image-sizing'
import { z } from 'zod'
import { defineComponent } from '../types'
import { Container, Cta } from '../primitives'

const navItemSchema = z.object({ label: z.string(), href: z.string() })

const headerPropsSchema = z.object({
  mobileMenuIconColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  logoAlignment: z.enum(['original', 'left', 'center', 'right']).default('original'),
  menuAlignment: z.enum(['original', 'left', 'center', 'right']).default('original'),
  customBackground: z.boolean().default(false),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffffff'),
  logoText: z.string(),
  logoImageUrl: z.string().optional(),
  items: z.array(navItemSchema.extend({ children: z.array(navItemSchema).default([]) })).default([]),
  cta: z.object({ label: z.string(), href: z.string() }).optional(),
  phone: z.string().optional(),
  sticky: z.boolean().default(true),
})

type HeaderProps = z.infer<typeof headerPropsSchema>

const headerEditorFields = [
  { path: '/mobileMenuIconColor', label: 'Hamburger icon colour', type: 'color' as const },
  { path: '/logoAlignment', label: 'Logo position', type: 'select' as const, options: ['original', 'left', 'center', 'right'] },
  { path: '/menuAlignment', label: 'Menu position', type: 'select' as const, options: ['original', 'left', 'center', 'right'] },
  { path: '/customBackground', label: 'Use custom header background', type: 'boolean' as const },
  { path: '/backgroundColor', label: 'Header background colour', type: 'color' as const },
  { path: '/logoText', label: 'Logo text', type: 'text' as const },
  { path: '/logoImageUrl', label: 'Logo image', type: 'image' as const },
  { path: '/items', label: 'Navigation menu (all links)', type: 'list' as const },
  { path: '/cta/label', label: 'CTA label', type: 'text' as const },
  { path: '/cta/href', label: 'CTA link', type: 'link' as const },
  { path: '/phone', label: 'Phone', type: 'text' as const },
  { path: '/sticky', label: 'Sticky header', type: 'boolean' as const },
]

const fixture = {
  logoText: 'MJ Saloon',
  items: [
    { label: 'Services', href: '/services' },
    { label: 'Gallery', href: '/gallery' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ],
  cta: { label: 'Book now', href: '/contact' },
  sticky: true,
}

function BrandLogo({ logoImageUrl, logoText, sizeStyle, textStyle }: Pick<HeaderProps, 'logoImageUrl' | 'logoText'> & { sizeStyle?: CSSProperties; textStyle?: CSSProperties }) {
  return logoImageUrl ? (
    <img data-awb-element="/logoImageUrl"
      src={logoImageUrl}
      alt={logoText}
      style={{ display: 'block', width: 'auto', height: '3.5rem', maxWidth: 'min(220px, 40vw)', objectFit: 'contain', ...sizeStyle }}
    />
  ) : <span data-awb-element="/logoText" style={textStyle}>{logoText}</span>
}

function menuBackground(props: HeaderProps) {
  const menu = elementColor(props, '/items')
  if (menu.backgroundColor) return menu.backgroundColor
  const section = props as HeaderProps & { sectionBackgroundMode?: string; sectionBackgroundColor?: string }
  if (section.sectionBackgroundMode === 'colour' || section.sectionBackgroundMode === 'image') return section.sectionBackgroundColor ?? 'var(--awb-bg)'
  return props.customBackground ? props.backgroundColor : 'var(--awb-bg)'
}

function menuLabelStyle(props: HeaderProps, path: string) {
  const menu = elementColor(props, '/items')
  const shared = Object.fromEntries(Object.entries(menu).filter(([key]) => ['color', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textAlign'].includes(key)))
  return { ...elementColor(props, path), ...shared }
}

function Nav({ items, props, offset = 0, baseUrl = '', alignment = 'left' }: { props: HeaderProps; offset?: number; items: HeaderProps['items']; baseUrl?: string; alignment?: string }) {
  const href = (value: string) => value.startsWith('/') && !value.startsWith('//') ? `${baseUrl}${value}` : value
  return (
    <nav aria-label="Primary" data-awb-element="/items" data-awb-menu="true" style={elementColor(props, '/items')}>
      <ul style={{ display: 'flex', gap: '1.5rem', listStyle: 'none', margin: 0, padding: 0, flexWrap: 'wrap', alignItems: 'center', justifyContent: alignment === 'right' ? 'flex-end' : alignment === 'center' ? 'center' : 'flex-start' }}>
        {items.map((item, index) => (
          <li key={item.href + item.label} style={{ position: 'relative' }}>
            {item.children.length > 0 ? (
              <details>
                <summary style={{ cursor: 'pointer', fontSize: '0.95rem', padding: '0.65rem 0' }}><span data-awb-element={`/items/${index + offset}/label`} style={menuLabelStyle(props, `/items/${index + offset}/label`)}>{item.label}</span></summary>
                <ul style={{ position: 'absolute', top: '100%', ...(alignment === 'right' ? { right: 0 } : { left: 0 }), zIndex: 50, width: 'min(280px, 85vw)', maxHeight: '65vh', overflowY: 'auto', background: menuBackground(props), color: 'var(--awb-fg)', border: '1px solid var(--awb-border)', borderRadius: '8px', padding: '0.65rem', margin: 0, listStyle: 'none', boxShadow: '0 12px 32px rgba(0,0,0,0.14)' }}>
                  {[{ label: `${item.label} overview`, href: item.href }, ...item.children].map((child, childIndex) => <li key={child.href}><a href={href(child.href)} style={{ display: 'block', padding: '0.65rem', color: 'inherit', textDecoration: 'none', fontSize: '0.9rem' }}><span data-awb-element={childIndex === 0 ? `/items/${index + offset}/label` : `/items/${index + offset}/children/${childIndex - 1}/label`} style={menuLabelStyle(props, childIndex === 0 ? `/items/${index + offset}/label` : `/items/${index + offset}/children/${childIndex - 1}/label`)}>{child.label}</span></a></li>)}
                </ul>
              </details>
            ) : <a href={href(item.href)} style={{ color: 'inherit', textDecoration: 'none', fontSize: '0.95rem' }}><span data-awb-element={`/items/${index + offset}/label`} style={menuLabelStyle(props, `/items/${index + offset}/label`)}>{item.label}</span></a>}
          </li>
        ))}
      </ul>
    </nav>
  )
}

function PositionedHeader({ props, baseUrl, tokens, split = false }: { props: HeaderProps; baseUrl: string; tokens: DesignTokens; split?: boolean }) {
  const originalSplit = split && props.logoAlignment === 'original' && props.menuAlignment === 'original'
  const logo = props.logoAlignment === 'original' ? (originalSplit ? 'center' : 'left') : props.logoAlignment
  const menu = props.menuAlignment === 'original' ? 'right' : props.menuAlignment
  const column = { left: 1, center: 2, right: 3 }
  const alignment = { left: 'start', center: 'center', right: 'end' }
  const half = originalSplit ? Math.ceil(props.items.length / 2) : 0
  return <div style={{ containerType: 'inline-size', containerName: 'awb-navigation' }}>
    <style>{`
      .awb-responsive-header{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.25rem;align-items:center}
      .awb-mobile-menu{display:contents}
      .awb-mobile-menu::details-content{display:contents;content-visibility:visible}
      .awb-mobile-menu>summary{display:none}
      .awb-mobile-menu:not([open])>.awb-menu-content,.awb-menu-content{display:contents}
      @container awb-navigation (max-width:767px){
        .awb-responsive-header{grid-template-columns:minmax(0,1fr) auto;gap:1rem}
        .awb-responsive-header>.awb-header-brand{grid-column:1!important;grid-row:1!important;justify-self:start!important}
        .awb-mobile-menu{display:block;grid-column:2;grid-row:1}
        .awb-mobile-menu>summary{display:flex;align-items:center;justify-content:center;width:44px;height:44px;cursor:pointer;list-style:none;border:1px solid currentColor;border-radius:8px}
        .awb-mobile-menu>summary::-webkit-details-marker{display:none}
        .awb-mobile-menu[open]{display:contents}
        .awb-mobile-menu[open]>summary{grid-column:2;grid-row:1}
        .awb-mobile-menu:not([open])>.awb-menu-content{display:none}
        .awb-mobile-menu[open]>.awb-menu-content{display:flex;grid-column:1 / -1;grid-row:2;flex-direction:column;gap:1rem;max-height:70vh;overflow-y:auto;padding:1rem 0}
        .awb-menu-content .awb-menu-group{display:flex!important;flex-direction:column;align-items:stretch!important;gap:1rem!important;width:100%}
        .awb-menu-content nav{width:100%}
        .awb-menu-content nav>ul{flex-direction:column;align-items:stretch!important;gap:0!important}
        .awb-menu-content nav>ul>li>a{display:block;padding:0.75rem 0}
        .awb-menu-content nav details>ul{position:static!important;width:100%!important;box-sizing:border-box;max-height:none!important}
        .awb-mobile-menu .awb-close-icon{display:none}
        .awb-mobile-menu[open] .awb-close-icon{display:block}
        .awb-mobile-menu[open] .awb-open-icon{display:none}
      }
    `}</style>
    <Container style={{ paddingBlock: '1.25rem' }}>
      <div className="awb-responsive-header">
        <a className="awb-header-brand" href={`${baseUrl}/`} style={{ gridColumn: column[logo], gridRow: 1, justifySelf: alignment[logo], color: 'inherit', textDecoration: 'none', fontFamily: 'var(--awb-heading-font)', fontSize: '1.4rem', maxWidth: '100%', overflowWrap: 'anywhere' }}><BrandLogo textStyle={elementColor(props, '/logoText')} sizeStyle={imageSizing(props, '/logoImageUrl')} logoText={props.logoText} logoImageUrl={props.logoImageUrl} /></a>
        <details className="awb-mobile-menu">
          <summary aria-label="Navigation menu" style={mobileMenuColors(props, tokens)}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path className="awb-open-icon" d="M3 6h18M3 12h18M3 18h18"/><path className="awb-close-icon" d="m6 6 12 12M6 18 18 6"/></svg></summary>
          <div className="awb-menu-content">
            {originalSplit && <div className="awb-menu-group" style={{ gridColumn: 1, gridRow: 1 }}><Nav props={props} items={props.items.slice(0, half)} baseUrl={baseUrl} /></div>}
            <div className="awb-menu-group" style={{ gridColumn: originalSplit ? 3 : logo !== menu && logo !== 'center' && menu !== 'center' ? (menu === 'right' ? '2 / 4' : '1 / 3') : column[menu], gridRow: logo === menu ? 2 : 1, justifySelf: 'stretch', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: menu === 'right' ? 'flex-end' : menu === 'center' ? 'center' : 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
              <Nav props={props} offset={half} items={props.items.slice(half)} baseUrl={baseUrl} alignment={menu} />
              {props.cta && <Cta data-awb-element="/cta" style={elementColor(props, '/cta')} {...props.cta} href={props.cta.href.startsWith('/') && !props.cta.href.startsWith('//') ? `${baseUrl}${props.cta.href}` : props.cta.href} />}
            </div>
          </div>
        </details>
      </div>
    </Container>
  </div>
}

export const headerTransparent = defineComponent({
  componentId: 'HeaderTransparent',
  version: '1.0.0',
  family: 'HEADER',
  name: 'Transparent overlay header',
  description: 'Overlays the hero with no background until scrolled.',
  aiGuidance: 'Use with full-bleed image heroes when the hero has a dark or tinted top area.',
  propsSchema: headerPropsSchema,
  editorFields: headerEditorFields,
  tokenDeps: ['palette.foreground', 'typography.bodyFamily'],
  fixture: headerPropsSchema.parse(fixture),
  render: ({ props, context }) => (
    <header
      style={{
        position: props.sticky && !context.editing ? 'sticky' : 'static',
        top: 0,
        zIndex: 20,
        background: props.customBackground ? props.backgroundColor : 'transparent',
        color: 'var(--awb-fg)',
        fontFamily: 'var(--awb-body-font)',
      }}
    >
      <PositionedHeader props={props} baseUrl={context.baseUrl} tokens={context.tokens} />
    </header>
  ),
})

export const headerSplitUtility = defineComponent({
  componentId: 'HeaderSplitUtility',
  version: '1.0.0',
  family: 'HEADER',
  name: 'Split navigation with utility bar',
  description: 'Utility strip with phone and hours above a split navigation row.',
  aiGuidance: 'Use for service businesses where calling or hours matter more than imagery.',
  propsSchema: headerPropsSchema,
  editorFields: headerEditorFields,
  tokenDeps: ['palette.surface', 'palette.border'],
  fixture: headerPropsSchema.parse(fixture),
  render: ({ props, context }) => {

    return (
      <header style={{ fontFamily: 'var(--awb-body-font)', borderTop: '4px solid var(--awb-accent)', borderBottom: '1px solid var(--awb-border)', background: props.customBackground ? props.backgroundColor : 'color-mix(in srgb, var(--awb-primary) 6%, var(--awb-bg))' }}>
        {props.phone && (
          <div style={{ background: 'var(--awb-surface)', fontSize: '0.8rem' }}>
            <Container style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.5rem', padding: '0.5rem 1.5rem' }}>
              <a href={`tel:${props.phone}`} style={{ color: 'inherit' }}>
                <span data-awb-element="/phone" style={elementColor(props, '/phone')}>{props.phone}</span>
              </a>
            </Container>
          </div>
        )}
        <PositionedHeader props={props} baseUrl={context.baseUrl} tokens={context.tokens} split />
      </header>
    )
  },
})
