import { imageSizing } from '../image-sizing'
import { elementColor, cardColor } from '../element-colors'
import { z } from 'zod'
import { defineComponent } from '../types'
import { Container, Cta, Heading, Media, Prose, Section } from '../primitives'

const serviceSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  price: z.string().optional(),
  href: z.string().optional(),
  imageUrl: z.string().optional(),
  imageAlt: z.string().default(''),
})

const servicesPropsSchema = z.object({
  heading: z.string(),
  intro: z.string().optional(),
  items: z.array(serviceSchema).min(1),
  cta: z.object({ label: z.string(), href: z.string() }).optional(),
})

const servicesEditorFields = [
  { path: '/heading', label: 'Heading (H2)', type: 'text' as const, headingLevel: 2 as const },
  { path: '/intro', label: 'Intro copy', type: 'textarea' as const },
  { path: '/items', label: 'Services', type: 'collection' as const, help: 'Bound to the Services collection' },
  { path: '/cta/label', label: 'CTA label', type: 'text' as const },
  { path: '/cta/href', label: 'CTA link', type: 'link' as const },
]

const fixture = {
  heading: 'Services',
  intro: 'Cutting, colour and beauty treatments delivered by senior stylists.',
  items: [
    { title: "Women's cutting", description: 'Consultation, wash, precision cut and finish.', price: 'from $65', imageAlt: '' },
    { title: "Men's grooming", description: 'Scissor or clipper cut with beard tidy.', price: 'from $40', imageAlt: '' },
    { title: 'Brows and facials', description: 'Shaping, tinting and skin treatments.', price: 'from $25', imageAlt: '' },
  ],
}

export const servicesLargeNumbers = defineComponent({
  componentId: 'ServicesLargeNumbers',
  version: '1.0.0',
  family: 'SERVICES',
  name: 'Large-number service list',
  description: 'Responsive service cards with photography, clear numbering and detail-page links.',
  aiGuidance: 'Use for 3-6 services when the brand is editorial and copy matters more than imagery.',
  propsSchema: servicesPropsSchema,
  editorFields: servicesEditorFields,
  tokenDeps: ['palette.border', 'typography.headingFamily'],
  fixture,
  render: ({ props }) => (
    <Section style={{ paddingTop: 'clamp(3rem, 6vw, 6rem)', paddingBottom: 'clamp(3rem, 6vw, 6rem)' }}>
      <Container style={{ display: 'grid', gap: '2.5rem' }}>
        <div style={{ display: 'grid', gap: '0.8rem', maxWidth: '65ch' }}>
          <Heading level={2} style={elementColor(props, '/heading')} data-awb-element={'/heading'}>{props.heading}</Heading>
          {props.intro && <Prose style={{ margin: 0 , ...elementColor(props, '/intro')}} data-awb-element={'/intro'}>{props.intro}</Prose>}
        </div>
        <ol style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '1.5rem', listStyle: 'none', margin: 0, padding: 0 }}>
          {props.items.map((item, index) => (
            <li key={item.title} style={{ overflow: 'hidden', borderRadius: '16px', border: '1px solid var(--awb-border)', background: 'var(--awb-bg)', boxShadow: '0 8px 26px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', ...cardColor(props, `/items/${index}`) }} data-awb-element={`/items/${index}`}>
              {item.imageUrl && <Media sizeStyle={imageSizing(props, `/items/${index}/imageUrl`)} data-awb-element={`/items/${index}/imageUrl`} src={item.imageUrl} alt={item.imageAlt || item.title} ratio="16 / 10" style={{ display: 'block' }} />}
              <div style={{ padding: '1.5rem', display: 'grid', gap: '0.85rem', flex: 1 }}>
                <span style={{ color: 'var(--awb-primary)', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.15em' }}>{String(index + 1).padStart(2, '0')}</span>
                <Heading level={3} style={elementColor(props, `/items/${index}/title`)} data-awb-element={`/items/${index}/title`}>{item.title}</Heading>
                {item.description && <Prose style={{ margin: 0, fontSize: '0.95rem' , ...elementColor(props, `/items/${index}/description`)}} data-awb-element={`/items/${index}/description`}>{item.description}</Prose>}
                {item.price && <span style={{ color: 'var(--awb-muted)' }}>{item.price}</span>}
                {item.href && <a href={item.href} style={{ color: 'var(--awb-primary)', fontWeight: 600, textUnderlineOffset: '4px', marginTop: '0.5rem' }}>Explore {item.title} <span aria-hidden="true">→</span></a>}
              </div>
            </li>
          ))}
        </ol>
        {props.cta && <div><Cta data-awb-element="/cta" style={elementColor(props, '/cta')} {...props.cta} variant="outline" /></div>}
      </Container>
    </Section>
  ),
})

export const servicesImageRail = defineComponent({
  componentId: 'ServicesImageRail',
  version: '1.0.0',
  family: 'SERVICES',
  name: 'Horizontal image rail',
  description: 'Scrollable rail of tall service cards with imagery.',
  aiGuidance: 'Use when there are many services and photography is strong.',
  propsSchema: servicesPropsSchema,
  editorFields: servicesEditorFields,
  tokenDeps: ['palette.surface', 'radius'],
  fixture,
  render: ({ props }) => (
    <Section background="surface">
      <Container style={{ display: 'grid', gap: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '2rem', flexWrap: 'wrap' }}>
          <Heading level={2} style={elementColor(props, '/heading')} data-awb-element={'/heading'}>{props.heading}</Heading>
          {props.cta && <Cta data-awb-element="/cta" style={elementColor(props, '/cta')} {...props.cta} variant="text-link" />}
        </div>
        <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(260px, 1fr)', gap: '1.5rem', overflowX: 'auto', paddingBottom: '1rem' }}>
          {props.items.map((item, index) => (
            <article key={item.title} style={{ display: 'grid', gap: '1rem', ...cardColor(props, `/items/${index}`) }} data-awb-element={`/items/${index}`}>
              <Media sizeStyle={imageSizing(props, `/items/${index}/imageUrl`)} data-awb-element={`/items/${index}/imageUrl`} src={item.imageUrl} alt={item.imageAlt || item.title} ratio="3 / 4" style={{ borderRadius: 'var(--awb-radius)' }} />
              <Heading level={3} style={elementColor(props, `/items/${index}/title`)} data-awb-element={`/items/${index}/title`}>{item.title}</Heading>
              {item.description && <Prose style={{ margin: 0, fontSize: '0.95rem' , ...elementColor(props, `/items/${index}/description`)}} data-awb-element={`/items/${index}/description`}>{item.description}</Prose>}
              {item.href && <Cta label="View" href={item.href} variant="text-link" />}
            </article>
          ))}
        </div>
      </Container>
    </Section>
  ),
})

export const servicesAlternatingShowcase = defineComponent({
  componentId: 'ServicesAlternatingShowcase',
  version: '1.0.0',
  family: 'SERVICES',
  name: 'Alternating showcase',
  description: 'Full-width alternating image/copy blocks, one per service.',
  aiGuidance: 'Use for 2-4 flagship services that each deserve a story and a photo.',
  propsSchema: servicesPropsSchema,
  editorFields: servicesEditorFields,
  tokenDeps: ['palette.background'],
  fixture,
  render: ({ props }) => (
    <Section>
      <Container style={{ display: 'grid', gap: '4rem' }}>
        <Heading level={2} style={{ maxWidth: '20ch' , ...elementColor(props, '/heading')}} data-awb-element={'/heading'}>
          {props.heading}
        </Heading>
        {props.items.map((item, index) => (
          <div
            key={item.title}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '2.5rem',
              alignItems: 'center',
              direction: index % 2 === 1 ? 'rtl' : 'ltr',
              ...cardColor(props, `/items/${index}`),
            }}
           data-awb-element={`/items/${index}`}>
            <div style={{ direction: 'ltr' }}>
              <Media sizeStyle={imageSizing(props, `/items/${index}/imageUrl`)} data-awb-element={`/items/${index}/imageUrl`} src={item.imageUrl} alt={item.imageAlt || item.title} ratio="4 / 3" />
            </div>
            <div style={{ direction: 'ltr', display: 'grid', gap: '1rem' }}>
              <Heading level={3} style={elementColor(props, `/items/${index}/title`)} data-awb-element={`/items/${index}/title`}>{item.title}</Heading>
              {item.description && <Prose style={{ margin: 0 , ...elementColor(props, `/items/${index}/description`)}} data-awb-element={`/items/${index}/description`}>{item.description}</Prose>}
              {item.price && <p style={{ margin: 0, color: 'var(--awb-accent)' }}>{item.price}</p>}
              {item.href && <Cta label="Learn more" href={item.href} variant="text-link" />}
            </div>
          </div>
        ))}
      </Container>
    </Section>
  ),
})
