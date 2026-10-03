import { imageSizing } from '../image-sizing'
import { elementColor } from '../element-colors'
import { z } from 'zod'
import { defineComponent } from '../types'
import { Container, Cta, Heading, Media, Prose, Section } from '../primitives'

const ctaSchema = z.object({ label: z.string(), href: z.string() })

const heroPropsSchema = z.object({
  imageLayout: z.enum(['split', 'background']).default('split'),
  overlayColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#102a43'),
  overlayOpacity: z.number().min(0).max(100).default(60),
  imageOpacity: z.number().min(0).max(100).default(100),
  overlayStyle: z.enum(['solid', 'gradient']).default('gradient'),
  imageBlend: z.enum(['normal', 'multiply', 'screen', 'overlay', 'luminosity']).default('normal'),
  imagePosition: z.enum(['center', 'top', 'bottom', 'left', 'right']).default('center'),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffffff'),
  textAlignment: z.enum(['left', 'center', 'right']).default('left'),
  eyebrow: z.string().optional(),
  heading: z.string(),
  body: z.string().optional(),
  primaryCta: ctaSchema.optional(),
  secondaryCta: ctaSchema.optional(),
  imageUrl: z.string().optional(),
  imageAlt: z.string().default(''),
})

const heroEditorFields = [
  { path: '/imageLayout', label: 'Image layout', type: 'select' as const, options: ['split', 'background'] },
  { path: '/overlayColor', label: 'Background overlay colour', type: 'color' as const },
  { path: '/overlayOpacity', label: 'Overlay opacity (%)', type: 'range' as const, min: 0, max: 100, step: 1 },
  { path: '/imageOpacity', label: 'Image opacity (%)', type: 'range' as const, min: 0, max: 100, step: 1 },
  { path: '/overlayStyle', label: 'Overlay treatment', type: 'select' as const, options: ['gradient', 'solid'] },
  { path: '/imageBlend', label: 'Image blending', type: 'select' as const, options: ['normal', 'multiply', 'screen', 'overlay', 'luminosity'] },
  { path: '/imagePosition', label: 'Image focal position', type: 'select' as const, options: ['center', 'top', 'bottom', 'left', 'right'] },
  { path: '/textColor', label: 'Background hero text colour', type: 'color' as const },
  { path: '/textAlignment', label: 'Background hero text alignment', type: 'select' as const, options: ['left', 'center', 'right'] },
  { path: '/eyebrow', label: 'Eyebrow', type: 'text' as const },
  { path: '/heading', label: 'Heading (H1)', type: 'text' as const, headingLevel: 1 as const },
  { path: '/body', label: 'Intro copy', type: 'textarea' as const },
  { path: '/primaryCta/label', label: 'Primary CTA label', type: 'text' as const },
  { path: '/primaryCta/href', label: 'Primary CTA link', type: 'link' as const },
  { path: '/secondaryCta/label', label: 'Secondary CTA label', type: 'text' as const },
  { path: '/secondaryCta/href', label: 'Secondary CTA link', type: 'link' as const },
  { path: '/imageUrl', label: 'Hero image', type: 'image' as const },
  { path: '/imageAlt', label: 'Hero image alt text', type: 'text' as const },
]

function BackgroundHero({ props }: { props: z.infer<typeof heroPropsSchema> & { panelTitle?: string; panelLines?: string[]; keywords?: string[] } }) {
  const direction = props.textAlignment === 'right' ? 'to left' : 'to right'
  const overlay = props.overlayStyle === 'solid' ? props.overlayColor : props.textAlignment === 'center'
    ? `radial-gradient(ellipse at center, ${props.overlayColor} 15%, transparent 130%)`
    : `linear-gradient(${direction}, ${props.overlayColor} 15%, transparent 130%)`
  return (
    <Section style={{ position: 'relative', isolation: 'isolate', overflow: 'hidden', background: props.overlayColor, color: props.textColor, minHeight: 'min(720px, 80svh)', display: 'grid', alignItems: 'center', paddingBlock: 'clamp(4rem, 9vw, 9rem)' }}>
      {props.imageUrl && <img data-awb-element="/imageUrl" className="awb-native-background" src={props.imageUrl} alt={props.imageAlt} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: props.imagePosition, opacity: props.imageOpacity / 100, mixBlendMode: props.imageBlend, zIndex: -2, ...imageSizing(props, '/imageUrl', true) }} />}
      <div className="awb-native-background" aria-hidden="true" style={{ position: 'absolute', inset: 0, background: overlay, opacity: props.overlayOpacity / 100, zIndex: -1, pointerEvents: 'none' }} />
      <Container style={{ width: '100%', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '780px', marginLeft: props.textAlignment === 'left' ? 0 : 'auto', marginRight: props.textAlignment === 'right' ? 0 : 'auto', textAlign: props.textAlignment, display: 'grid', gap: '1.5rem', overflowWrap: 'break-word' }}>
          {props.eyebrow && <p style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: '0.8rem' , ...elementColor(props, '/eyebrow')}} data-awb-element={'/eyebrow'}>{props.eyebrow}</p>}
          <Heading level={1} style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5.5rem)' , ...elementColor(props, '/heading')}} data-awb-element={'/heading'}>{props.heading}</Heading>
          {props.body && <Prose style={{ color: 'inherit', margin: 0, maxWidth: 'none' , ...elementColor(props, '/body')}} data-awb-element={'/body'}>{props.body}</Prose>}
          {props.panelTitle && <div style={{ borderTop: '1px solid currentColor', paddingTop: '1rem' }}><p>{props.panelTitle}</p>{props.panelLines?.map((line) => <p key={line}>{line}</p>)}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: props.textAlignment === 'center' ? 'center' : props.textAlignment === 'right' ? 'flex-end' : 'flex-start' }}>
            {props.primaryCta && <Cta data-awb-element="/primaryCta" style={elementColor(props, '/primaryCta')} {...props.primaryCta} />}
            {props.secondaryCta && <Cta data-awb-element="/secondaryCta" style={elementColor(props, '/secondaryCta')} {...props.secondaryCta} variant="outline" />}
          </div>
          {!!props.keywords?.length && <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>{props.keywords.map((keyword, index) => <span key={`${keyword}-${index}`} style={{ padding: '0.35rem 0.75rem', border: '1px solid currentColor', borderRadius: '999px', ...elementColor(props, `/keywords/${index}`) }} data-awb-element={`/keywords/${index}`}>{keyword}</span>)}</div>}
        </div>
      </Container>
    </Section>
  )
}

const fixture = heroPropsSchema.parse({
  eyebrow: 'Mississauga',
  heading: 'Style, refined.',
  body: 'A salon built around precision cutting, considered colour and unhurried service.',
  primaryCta: { label: 'Book an appointment', href: '/contact' },
  imageAlt: 'Stylist finishing a cut',
})

export const heroEditorial = defineComponent({
  componentId: 'HeroEditorial',
  version: '1.0.0',
  family: 'HERO',
  name: 'Editorial hero',
  description: 'Responsive editorial split with readable heading, copy and actions beside a large image.',
  aiGuidance: 'Strong choice for premium, image-led brands with a single dominant photograph.',
  propsSchema: heroPropsSchema,
  editorFields: heroEditorFields,
  tokenDeps: ['typography.headingFamily', 'palette.foreground'],
  fixture,
  render: ({ props }) => props.imageLayout === 'background' ? <BackgroundHero props={props} /> : (
    <Section style={{ paddingTop: 'clamp(2.5rem, 5vw, 5rem)', paddingBottom: 'clamp(2.5rem, 5vw, 5rem)' }}>
      <Container style={{ display: 'grid', gridTemplateColumns: props.imageUrl ? 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))' : '1fr', alignItems: 'center', gap: 'clamp(2rem, 4vw, 4rem)' }}>
        <div style={{ display: 'grid', gap: '1.5rem', minWidth: 0 }}>
          {props.eyebrow && <p style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: '0.8rem', color: 'var(--awb-primary)', fontWeight: 600 , ...elementColor(props, '/eyebrow')}} data-awb-element={'/eyebrow'}>{props.eyebrow}</p>}
          <Heading level={1} style={{ fontSize: 'clamp(2.4rem, 4.3vw, 4.5rem)', maxWidth: '18ch', overflowWrap: 'break-word' , ...elementColor(props, '/heading')}} data-awb-element={'/heading'}>{props.heading}</Heading>
          {props.body && <Prose style={{ margin: 0, maxWidth: '52ch' , ...elementColor(props, '/body')}} data-awb-element={'/body'}>{props.body}</Prose>}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {props.primaryCta && <Cta data-awb-element="/primaryCta" style={elementColor(props, '/primaryCta')} {...props.primaryCta} />}
            {props.secondaryCta && <Cta data-awb-element="/secondaryCta" style={elementColor(props, '/secondaryCta')} {...props.secondaryCta} variant="text-link" />}
          </div>
        </div>
        {props.imageUrl && <div style={{ minWidth: 0, overflow: 'hidden', borderRadius: 'max(var(--awb-radius), 18px)', boxShadow: '0 18px 45px rgba(0,0,0,0.1)' }}><Media sizeStyle={imageSizing(props, '/imageUrl')} data-awb-element="/imageUrl" src={props.imageUrl} alt={props.imageAlt || props.heading} ratio="6 / 5" /></div>}
      </Container>
    </Section>
  ),
})

export const heroSplitBooking = defineComponent({
  componentId: 'HeroSplitBooking',
  version: '1.0.0',
  family: 'HERO',
  name: 'Split hero with booking panel',
  description: 'Half image, half conversion panel with the primary action above the fold.',
  aiGuidance: 'Use when booking or calling is the dominant conversion goal.',
  propsSchema: heroPropsSchema.extend({
    panelTitle: z.string().default('Book a visit'),
    panelLines: z.array(z.string()).default([]),
  }),
  editorFields: [
    ...heroEditorFields,
    { path: '/panelTitle', label: 'Panel title', type: 'text' as const, headingLevel: 2 as const },
    { path: '/panelLines', label: 'Panel details', type: 'list' as const },
  ],
  tokenDeps: ['palette.surface', 'palette.primary'],
  fixture: { ...fixture, panelTitle: 'Book a visit', panelLines: ['Tue – Sat, 9am – 7pm', '2450 Hurontario St'] },
  render: ({ props }) => props.imageLayout === 'background' ? <BackgroundHero props={props} /> : (
    <Section style={{ paddingTop: 0, paddingBottom: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', minHeight: '70vh' }}>
        <Media sizeStyle={imageSizing(props, '/imageUrl')} data-awb-element="/imageUrl" src={props.imageUrl} alt={props.imageAlt} ratio="auto" style={{ height: '100%', minHeight: '60vh' }} />
        <div style={{ background: 'var(--awb-surface)', display: 'grid', alignContent: 'center', gap: '1.5rem', padding: 'clamp(2rem, 5vw, 5rem)' }}>
          {props.eyebrow && (
            <p style={{ textTransform: 'uppercase', letterSpacing: '0.24em', fontSize: '0.75rem', color: 'var(--awb-muted)', margin: 0 , ...elementColor(props, '/eyebrow')}} data-awb-element={'/eyebrow'}>{props.eyebrow}</p>
          )}
          <Heading level={1} style={elementColor(props, '/heading')} data-awb-element={'/heading'}>{props.heading}</Heading>
          {props.body && <Prose style={elementColor(props, '/body')} data-awb-element={'/body'}>{props.body}</Prose>}
          <div style={{ borderTop: '1px solid var(--awb-border)', paddingTop: '1.5rem', display: 'grid', gap: '0.5rem' }}>
            <p style={{ fontFamily: 'var(--awb-heading-font)', fontSize: '1.1rem', margin: 0 }}>{props.panelTitle}</p>
            {props.panelLines.map((line) => (
              <p key={line} style={{ margin: 0, color: 'var(--awb-muted)', fontSize: '0.95rem' }}>
                {line}
              </p>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {props.primaryCta && <Cta data-awb-element="/primaryCta" style={elementColor(props, '/primaryCta')} {...props.primaryCta} />}
            {props.secondaryCta && <Cta data-awb-element="/secondaryCta" style={elementColor(props, '/secondaryCta')} {...props.secondaryCta} variant="outline" />}
          </div>
        </div>
      </div>
    </Section>
  ),
})

export const heroTypographic = defineComponent({
  componentId: 'HeroTypographic',
  version: '1.0.0',
  family: 'HERO',
  name: 'Typography-led hero',
  description: 'Two-column hero with prominent copy and actions beside a large brand image.',
  aiGuidance: 'Use for a strong headline and supporting image. Text and image sit side by side on desktop and stack on mobile.',
  propsSchema: heroPropsSchema.extend({ keywords: z.array(z.string()).default([]) }),
  editorFields: [...heroEditorFields, { path: '/keywords', label: 'Keyword strip', type: 'list' as const }],
  tokenDeps: ['typography.headingFamily', 'palette.border'],
  fixture: { ...fixture, keywords: ['Cutting', 'Colour', 'Brows', 'Facials'] },
  render: ({ props }) => props.imageLayout === 'background' ? <BackgroundHero props={props} /> : (
    <Section background="inverted" style={{ paddingTop: 'clamp(2.5rem, 5vw, 5rem)', paddingBottom: 'clamp(2.5rem, 5vw, 5rem)' }}>
      <Container style={{ display: 'grid', gridTemplateColumns: props.imageUrl ? 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))' : '1fr', gap: 'clamp(2rem, 4vw, 4rem)', alignItems: 'center' }}>
        <div style={{ display: 'grid', gap: '1.5rem', minWidth: 0 }}>
          {props.eyebrow && <p style={{ margin: 0, fontSize: '0.8rem', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.9 , ...elementColor(props, '/eyebrow')}} data-awb-element={'/eyebrow'}>{props.eyebrow}</p>}
          <Heading level={1} style={{ maxWidth: '17ch', fontSize: 'clamp(2.4rem, 4.7vw, 5rem)', lineHeight: 1.1 , ...elementColor(props, '/heading')}} data-awb-element={'/heading'}>
            {props.heading}
          </Heading>
          {props.body && <Prose style={{ margin: 0, color: 'inherit', maxWidth: '48ch', opacity: 0.95 , ...elementColor(props, '/body')}} data-awb-element={'/body'}>{props.body}</Prose>}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {props.primaryCta && <Cta data-awb-element="/primaryCta" style={elementColor(props, '/primaryCta')} {...props.primaryCta} variant="outline" />}
            {props.secondaryCta && <Cta data-awb-element="/secondaryCta" style={elementColor(props, '/secondaryCta')} {...props.secondaryCta} variant="text-link" />}
          </div>
          {props.keywords.length > 0 && (
            <ul style={{ display: 'flex', gap: '0.65rem', listStyle: 'none', padding: '1.25rem 0 0', margin: 0, flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>
              {props.keywords.map((keyword, index) => <li key={`${keyword}-${index}`} style={{ padding: '0.35rem 0.75rem', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '999px', ...elementColor(props, `/keywords/${index}`) }} data-awb-element={`/keywords/${index}`}>{keyword}</li>)}
            </ul>
          )}
        </div>
        {props.imageUrl && <div style={{ minWidth: 0, overflow: 'hidden', borderRadius: 'max(var(--awb-radius), 16px)', boxShadow: '0 20px 50px rgba(0,0,0,0.16)', border: '1px solid rgba(255,255,255,0.2)' }}><Media sizeStyle={imageSizing(props, '/imageUrl')} data-awb-element="/imageUrl" src={props.imageUrl} alt={props.imageAlt || props.heading} ratio="6 / 5" style={{ display: 'block' }} /></div>}
      </Container>
    </Section>
  ),
})
