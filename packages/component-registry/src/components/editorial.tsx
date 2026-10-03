import { imageSizing } from '../image-sizing'
import { elementColor, cardColor } from '../element-colors'
import { z } from 'zod'
import { defineComponent } from '../types'
import { Container, Cta, Heading, Media, Prose, Section } from '../primitives'

const aboutPropsSchema = z.object({
  layout: z.enum(['story', 'cards', 'steps']).default('story'),
  points: z.array(z.object({ title: z.string(), body: z.string(), number: z.string().optional() })).default([]),
  eyebrow: z.string().optional(),
  heading: z.string(),
  body: z.string(),
  imageUrl: z.string().optional(),
  imageAlt: z.string().default(''),
  stats: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
  cta: z.object({ label: z.string(), href: z.string() }).optional(),
})

export const aboutSplitOverlap = defineComponent({
  componentId: 'AboutSplitOverlap',
  version: '1.0.0',
  family: 'ABOUT',
  name: 'Image-led story, cards or process',
  description: 'Wide responsive story split with concept imagery, benefit cards or numbered methodology steps.',
  aiGuidance: 'Use story for About us, cards with points for Why choose us or supplied service areas, and steps with points for methodology or approach. Choose imagery about the actual concept, not a generic portrait. Only use supplied facts and process details. Vary layout between sections.',
  propsSchema: aboutPropsSchema,
  editorFields: [
    { path: '/layout', label: 'Story layout', type: 'select' as const, options: ['story', 'cards', 'steps'] },
    { path: '/points', label: 'Benefits, areas or process steps', type: 'list' as const },
    { path: '/eyebrow', label: 'Eyebrow', type: 'text' as const },
    { path: '/heading', label: 'Heading (H2)', type: 'text' as const, headingLevel: 2 as const },
    { path: '/body', label: 'Story', type: 'textarea' as const },
    { path: '/imageUrl', label: 'Image', type: 'image' as const },
    { path: '/imageAlt', label: 'Image alt text', type: 'text' as const },
    { path: '/stats', label: 'Stats', type: 'list' as const, help: 'Only use facts supplied by the business' },
  ],
  tokenDeps: ['palette.surface', 'palette.accent'],
  fixture: {
    layout: 'story',
    points: [],
    eyebrow: 'Our story',
    heading: 'A studio built on precision',
    body: 'Founded in Mississauga, the salon focuses on considered, unhurried appointments.',
    imageAlt: 'Salon interior',
    stats: [],
  },
  render: ({ props }) => (
    <Section background="surface">
      <Container style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '3rem', alignItems: 'center' }}>
        <div style={{ overflow: 'hidden', borderRadius: '18px', boxShadow: '0 18px 40px rgba(0,0,0,0.1)' }}>
          <Media sizeStyle={imageSizing(props, '/imageUrl')} data-awb-element="/imageUrl" src={props.imageUrl} alt={props.imageAlt} ratio="5 / 4" style={{ display: 'block' }} />
        </div>
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {props.eyebrow && (
            <p style={{ textTransform: 'uppercase', letterSpacing: '0.22em', fontSize: '0.75rem', color: 'var(--awb-muted)', margin: 0 , ...elementColor(props, '/eyebrow')}} data-awb-element={'/eyebrow'}>{props.eyebrow}</p>
          )}
          <Heading level={2} style={elementColor(props, '/heading')} data-awb-element={'/heading'}>{props.heading}</Heading>
          <Prose style={elementColor(props, '/body')} data-awb-element={'/body'}>{props.body}</Prose>
          {props.points.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: props.layout === 'cards' ? 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' : '1fr', gap: '1rem' }}>
            {props.points.map((point, index) => <div key={`${point.title}-${index}`} style={{ padding: '1.25rem', background: 'var(--awb-bg)', border: '1px solid var(--awb-border)', borderRadius: 'max(var(--awb-radius), 16px)', display: 'grid', gap: '0.75rem', ...cardColor(props, `/points/${index}`) }} data-awb-element={`/points/${index}`}>
              {props.layout === 'steps' && <span style={{ color: 'var(--awb-primary)', fontSize: '0.85rem', fontWeight: 700, ...elementColor(props, `/points/${index}/number`) }} data-awb-element={`/points/${index}/number`}>{point.number || String(index + 1).padStart(2, '0')}</span>}
              <Heading level={3} style={elementColor(props, `/points/${index}/title`)} data-awb-element={`/points/${index}/title`}>{point.title}</Heading><Prose style={{ margin: 0 , ...elementColor(props, `/points/${index}/body`)}} data-awb-element={`/points/${index}/body`}>{point.body}</Prose>
            </div>)}
          </div>}
          {props.stats.length > 0 && (
            <dl style={{ display: 'flex', gap: '2.5rem', margin: 0, flexWrap: 'wrap' }}>
              {props.stats.map((stat, index) => (
                <div key={stat.label}>
                  <dt style={{ fontSize: '0.75rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--awb-muted)' }}><span data-awb-element={`/stats/${index}/label`} style={elementColor(props, `/stats/${index}/label`)}>{stat.label}</span></dt>
                  <dd style={{ margin: 0, fontFamily: 'var(--awb-heading-font)', fontSize: '2rem' }}><span data-awb-element={`/stats/${index}/value`} style={elementColor(props, `/stats/${index}/value`)}>{stat.value}</span></dd>
                </div>
              ))}
            </dl>
          )}
          {props.cta && <Cta data-awb-element="/cta" style={elementColor(props, '/cta')} {...props.cta} variant="outline" />}
        </div>
      </Container>
    </Section>
  ),
})

const galleryPropsSchema = z.object({
  heading: z.string().optional(),
  images: z.array(z.object({ url: z.string().optional(), alt: z.string().default('') })).min(1),
})

export const galleryAsymmetric = defineComponent({
  componentId: 'GalleryAsymmetric',
  version: '1.0.0',
  family: 'GALLERY',
  name: 'Asymmetric gallery',
  description: 'Deliberately uneven grid with varied aspect ratios and offsets.',
  aiGuidance: 'Use to show work without the generic three-column card grid.',
  propsSchema: galleryPropsSchema,
  editorFields: [
    { path: '/heading', label: 'Heading (H2)', type: 'text' as const, headingLevel: 2 as const },
    { path: '/images', label: 'Images', type: 'list' as const },
  ],
  tokenDeps: ['palette.background'],
  fixture: { heading: 'Recent work', images: [{ alt: '' }, { alt: '' }, { alt: '' }, { alt: '' }] },
  render: ({ props }) => {
    const ratios = ['3 / 4', '1 / 1', '4 / 5', '16 / 10']
    const offsets = ['0rem', '3rem', '1rem', '4rem']

    return (
      <Section>
        <Container style={{ display: 'grid', gap: '2.5rem' }}>
          {props.heading && <Heading level={2} style={elementColor(props, '/heading')} data-awb-element={'/heading'}>{props.heading}</Heading>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
            {props.images.map((image, index) => (
              <div key={`${image.url ?? 'placeholder'}-${index}`} style={{ marginTop: offsets[index % offsets.length] }}>
                <Media data-awb-element={`/images/${index}/url`} sizeStyle={imageSizing(props, `/images/${index}/url`)} src={image.url} alt={image.alt} ratio={ratios[index % ratios.length]} />
              </div>
            ))}
          </div>
        </Container>
      </Section>
    )
  },
})

const reviewsPropsSchema = z.object({
  layout: z.enum(['cards', 'slider']).default('slider'),
  heading: z.string().optional(),
  testimonials: z
    .array(
      z.object({
        quote: z.string(),
        author: z.string(),
        source: z.string().optional(),
        rating: z.number().min(1).max(5).optional(),
      }),
    )
    .default([]),
})

const reviewsEditorFields = [
  { path: '/layout', label: 'Review layout', type: 'select' as const, options: ['cards', 'slider'] },
  { path: '/heading', label: 'Heading (H2)', type: 'text' as const, headingLevel: 2 as const },
  {
    path: '/testimonials',
    label: 'Testimonials',
    type: 'collection' as const,
    help: 'Bound to the Testimonials collection. Never generated by AI.',
  },
]

export const reviewsEditorialQuote = defineComponent({
  componentId: 'ReviewsEditorialQuote',
  version: '1.0.0',
  family: 'REVIEWS',
  name: 'Single editorial quote',
  description: 'One oversized testimonial, no carousel.',
  aiGuidance: 'Only place when the business supplied at least one real testimonial.',
  propsSchema: reviewsPropsSchema,
  editorFields: reviewsEditorFields,
  tokenDeps: ['typography.headingFamily'],
  fixture: reviewsPropsSchema.parse({ testimonials: [] }),
  render: ({ props }) => {
    const testimonial = props.testimonials[0]

    if (!testimonial) {
      return null
    }

    return (
      <Section background="inverted">
        <Container style={{ display: 'grid', gap: '2rem', justifyItems: 'center', textAlign: 'center' }}>
          <blockquote style={{ margin: 0, maxWidth: '24ch', fontFamily: 'var(--awb-heading-font)', fontSize: 'clamp(1.6rem, 3.2vw, 2.6rem)', lineHeight: 1.2 }}>
            “<span data-awb-element="/testimonials/0/quote" style={elementColor(props, '/testimonials/0/quote')}>{testimonial.quote}</span>”
          </blockquote>
          <cite style={{ fontStyle: 'normal', letterSpacing: '0.18em', textTransform: 'uppercase', fontSize: '0.75rem', opacity: 0.75 }}>
            <span data-awb-element="/testimonials/0/author" style={elementColor(props, '/testimonials/0/author')}>{testimonial.author}</span>
            {testimonial.source && <span data-awb-element="/testimonials/0/source" style={elementColor(props, '/testimonials/0/source')}> · {testimonial.source}</span>}
          </cite>
        </Container>
      </Section>
    )
  },
})

export const reviewsTrustStrip = defineComponent({
  componentId: 'ReviewsTrustStrip',
  version: '1.0.0',
  family: 'REVIEWS',
  name: 'Trust strip',
  description: 'Modern review cards or a responsive swipeable slider with reviewer attribution.',
  aiGuidance: 'Use when several short testimonials exist and space is limited.',
  propsSchema: reviewsPropsSchema,
  editorFields: reviewsEditorFields,
  tokenDeps: ['palette.border'],
  fixture: reviewsPropsSchema.parse({ testimonials: [] }),
  render: ({ props }) => {
    if (props.testimonials.length === 0) {
      return null
    }

    const slider = props.layout === 'slider' && props.testimonials.length > 1
    return (
      <Section background="surface" style={{ paddingTop: 'clamp(3rem, 6vw, 6rem)', paddingBottom: 'clamp(3rem, 6vw, 6rem)' }}>
        <Container style={{ display: 'grid', gap: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', flexWrap: 'wrap', gap: '1rem' }}>
            <div><p style={{ margin: '0 0 0.75rem', color: 'var(--awb-primary)', fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Client experiences</p><Heading level={2} style={elementColor(props, '/heading')} data-awb-element={'/heading'}>{props.heading || 'What our clients say'}</Heading></div>
            {slider && <p style={{ margin: 0, color: 'var(--awb-muted)', fontSize: '0.85rem' }}>Swipe or scroll to read more →</p>}
          </div>
          <div
            role="region"
            aria-label="Customer testimonials"
            aria-roledescription={slider ? 'carousel' : undefined}
            tabIndex={slider ? 0 : undefined}
            style={{ display: slider ? 'flex' : 'grid', gridTemplateColumns: slider ? undefined : 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.5rem', overflowX: slider ? 'auto' : undefined, scrollSnapType: slider ? 'x mandatory' : undefined, padding: '0.25rem 0.25rem 1.25rem', scrollbarWidth: 'thin', scrollbarColor: 'var(--awb-primary) var(--awb-surface)' }}
          >
            {props.testimonials.map((testimonial, index) => (
              <figure key={testimonial.author + index} aria-label={`${index + 1} of ${props.testimonials.length}`} style={{ margin: 0, flex: slider ? '0 0 min(100%, 380px)' : undefined, minWidth: 0, scrollSnapAlign: 'start', border: '1px solid var(--awb-border)', borderRadius: '18px', background: 'var(--awb-bg)', padding: '2rem', boxShadow: '0 8px 24px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '1.5rem', ...cardColor(props, `/testimonials/${index}`) }} data-awb-element={`/testimonials/${index}`}>
                <span aria-hidden="true" style={{ color: 'var(--awb-accent)', fontSize: '3.5rem', lineHeight: 0.7, fontFamily: 'Georgia, serif' }}>“</span>
                <blockquote style={{ margin: 0, lineHeight: 1.8, flex: 1 , ...elementColor(props, `/testimonials/${index}/quote`)}} data-awb-element={`/testimonials/${index}/quote`}>{testimonial.quote}</blockquote>
                <figcaption style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', borderTop: '1px solid var(--awb-border)', paddingTop: '1.25rem' }}>
                  <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', flexShrink: 0, width: '42px', height: '42px', borderRadius: '50%', background: 'var(--awb-primary)', color: 'var(--awb-primary-fg)', fontWeight: 600 , ...elementColor(props, `/testimonials/${index}/avatar`)}} data-awb-element={`/testimonials/${index}/avatar`}>{testimonial.author.split(/\s+/).map((part) => part[0]).slice(0, 2).join('')}</span>
                  <span><strong style={{ display: 'block', fontSize: '0.9rem' , ...elementColor(props, `/testimonials/${index}/author`)}} data-awb-element={`/testimonials/${index}/author`}>{testimonial.author}</strong><span style={{ color: 'var(--awb-muted)', fontSize: '0.8rem' , ...elementColor(props, `/testimonials/${index}/source`)}} data-awb-element={`/testimonials/${index}/source`}>{testimonial.source}{testimonial.rating ? ` · ${testimonial.rating}/5` : ''}</span></span>
                </figcaption>
              </figure>
            ))}
          </div>
        </Container>
      </Section>
    )
  },
})
