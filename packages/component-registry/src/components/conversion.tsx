import type { ReactNode } from 'react'
import { imageSizing } from '../image-sizing'
import { elementColor, cardColor } from '../element-colors'
import { z } from 'zod'
import type { RenderContext } from '../types'
import { defineComponent } from '../types'
import { Container, Cta, Heading, Media, Prose, Section } from '../primitives'

function safeLabelLink(url: string) {
  return /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i.test(url) && !/[\\\s]/.test(url)
}
function FormLabel({ field }: { field: { label: string; linkText?: string; linkUrl?: string; labelLinks?: Array<{ text: string; url: string }>; required?: boolean } }) {
  const links = field.labelLinks ?? (field.linkText ? [{ text: field.linkText, url: field.linkUrl ?? '' }] : [])
  const matches = links.filter(link => link.text && safeLabelLink(link.url)).map((link, index) => ({ ...link, index, start: field.label.indexOf(link.text) })).filter(link => link.start >= 0).sort((a, b) => a.start - b.start || a.index - b.index)
  const parts: ReactNode[] = []
  let cursor = 0
  for (const link of matches) {
    if (link.start < cursor) continue
    parts.push(field.label.slice(cursor, link.start), <a key={link.index} href={link.url} style={{ color: 'inherit', textDecoration: 'underline' }}>{link.text}</a>)
    cursor = link.start + link.text.length
  }
  parts.push(field.label.slice(cursor))
  return <>{parts}{field.required && <span aria-hidden="true"> *</span>}</>
}

export const contactPropsSchema = z.object({
  imageUrl: z.string().optional(),
  imageAlt: z.string().default(''),
  heading: z.string(),
  intro: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  hours: z.array(z.object({ day: z.string(), value: z.string() })).default([]),
  mapEmbedUrl: z.string().optional(),
  formFields: z.array(z.object({ name: z.string(), label: z.string(), type: z.enum(['text', 'email', 'tel', 'textarea', 'number', 'select', 'checkbox', 'radio']), required: z.boolean().optional(), rows: z.number().int().min(1).max(30).optional(), labelFontSize: z.number().min(10).max(80).optional(), labelCase: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(), labelLinks: z.array(z.object({ text: z.string().max(300), url: z.string().refine(value => !value || safeLabelLink(value), 'Use a page path or an HTTP(S) link') })).max(10).optional(), linkText: z.string().max(300).optional(), linkUrl: z.string().refine(value => !value || safeLabelLink(value), 'Use a page path or an HTTP(S) link').optional(), options: z.array(z.string().max(200)).max(100).optional() })).default([]),
  submissionUrl: z.string().url().refine(value => value.startsWith('https://'), 'Use an HTTPS form endpoint').or(z.literal('')).optional(),
  submitLabel: z.string().default('Send enquiry'),
  consentText: z.string().optional(),
})

export const contactSplit = defineComponent({
  componentId: 'ContactSplit',
  version: '1.0.0',
  family: 'CONTACT',
  name: 'Split contact and enquiry form',
  description: 'Image-led contact panel beside a contained enquiry form, with a branded fallback when no image is supplied.',
  aiGuidance: 'Use a relevant service or environment image alongside the form. Only render details the business actually supplied.',
  propsSchema: contactPropsSchema,
  editorFields: [
    { path: '/imageUrl', label: 'Contact image', type: 'image' as const },
    { path: '/imageAlt', label: 'Contact image alt text', type: 'text' as const },
    { path: '/heading', label: 'Heading (H2)', type: 'text' as const, headingLevel: 2 as const },
    { path: '/intro', label: 'Intro copy', type: 'textarea' as const },
    { path: '/address', label: 'Address', type: 'text' as const },
    { path: '/phone', label: 'Phone', type: 'text' as const },
    { path: '/email', label: 'Email', type: 'text' as const },
    { path: '/hours', label: 'Opening hours', type: 'list' as const, help: 'Never invent hours' },
    { path: '/mapEmbedUrl', label: 'Map embed URL', type: 'link' as const },
    { path: '/formFields', label: 'Form fields', type: 'list' as const },
    { path: '/submissionUrl', label: 'Custom submission URL (HTTPS)', type: 'text' as const, help: 'Optional public endpoint accepting standard form POST data. Leave blank to save leads in Webtummy. Never put secret API keys here.' },
    { path: '/submitLabel', label: 'Submit label', type: 'text' as const },
    { path: '/consentText', label: 'Consent text', type: 'textarea' as const },
  ],
  tokenDeps: ['palette.surface', 'radius'],
  fixture: {
    imageAlt: '',
    heading: 'Visit or get in touch',
    intro: 'Send an enquiry and the team will reply within one business day.',
    hours: [],
    formFields: [
      { name: 'name', label: 'Name', type: 'text' as const },
      { name: 'email', label: 'Email', type: 'email' as const },
      { name: 'message', label: 'Message', type: 'textarea' as const },
    ],
    submitLabel: 'Send enquiry',
  },
  render: ({ props, context }) => (
    <Section id="contact">
      <Container style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 'clamp(1.5rem, 4vw, 4rem)', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: '1.5rem', alignContent: 'start', minWidth: 0, padding: 'clamp(1.5rem, 3vw, 2.5rem)', borderRadius: 'max(var(--awb-radius), 24px)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--awb-primary) 14%, var(--awb-bg)), color-mix(in srgb, var(--awb-accent) 10%, var(--awb-bg)))', border: '1px solid var(--awb-border)', overflowWrap: 'anywhere', ...cardColor(props, '/contact-panel') }} data-awb-element={'/contact-panel'}>
          {props.imageUrl && <div style={{ overflow: 'hidden', borderRadius: 'max(var(--awb-radius), 16px)' }}><Media sizeStyle={imageSizing(props, '/imageUrl')} data-awb-element="/imageUrl" src={props.imageUrl} alt={props.imageAlt} ratio="16 / 9" /></div>}
          <Heading level={2} style={elementColor(props, '/heading')} data-awb-element={'/heading'}>{props.heading}</Heading>
          {props.intro && <Prose style={elementColor(props, '/intro')} data-awb-element={'/intro'}>{props.intro}</Prose>}
          <address style={{ fontStyle: 'normal', display: 'grid', gap: '0.4rem', color: 'var(--awb-muted)' }}>
            {props.address && <span>{<span data-awb-element="/address" style={elementColor(props, '/address')}>{props.address}</span>}</span>}
            {props.phone && <a href={`tel:${props.phone}`} style={{ color: 'inherit' }}>{<span data-awb-element="/phone" style={elementColor(props, '/phone')}>{props.phone}</span>}</a>}
            {props.email && <a href={`mailto:${props.email}`} style={{ color: 'inherit' }}>{<span data-awb-element="/email" style={elementColor(props, '/email')}>{props.email}</span>}</a>}
          </address>
          {props.hours.length > 0 && (
            <dl style={{ display: 'grid', gap: '0.35rem', margin: 0 }}>
              {props.hours.map((entry, index) => (
                <div key={entry.day} style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '22rem', borderBottom: '1px solid var(--awb-border)', paddingBottom: '0.35rem' }}>
                  <dt data-awb-element={`/hours/${index}/day`} style={elementColor(props, `/hours/${index}/day`)}>{entry.day}</dt>
                  <dd style={{ margin: 0, color: 'var(--awb-muted)', ...elementColor(props, `/hours/${index}/value`) }} data-awb-element={`/hours/${index}/value`}>{entry.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {props.mapEmbedUrl && (
            <iframe title="Map" src={props.mapEmbedUrl} loading="lazy" style={{ width: '100%', aspectRatio: '16 / 9', border: '1px solid var(--awb-border)' }} />
          )}
        </div>
        {renderContactForm(props, context)}
      </Container>
    </Section>
  ),
})

const ctaPropsSchema = z.object({
  heading: z.string(),
  body: z.string().optional(),
  primaryCta: z.object({ label: z.string(), href: z.string() }),
  backgroundImageUrl: z.string().optional(),
  backgroundAlt: z.string().default(''),
})

export const ctaCinematic = defineComponent({
  componentId: 'CtaCinematic',
  version: '1.0.0',
  family: 'CTA',
  name: 'Cinematic closing CTA',
  description: 'Full-bleed image with a dark scrim and a single action.',
  aiGuidance: 'Use as the final section when strong photography exists.',
  propsSchema: ctaPropsSchema,
  editorFields: [
    { path: '/heading', label: 'Heading (H2)', type: 'text' as const, headingLevel: 2 as const },
    { path: '/body', label: 'Supporting copy', type: 'textarea' as const },
    { path: '/primaryCta/label', label: 'CTA label', type: 'text' as const },
    { path: '/primaryCta/href', label: 'CTA link', type: 'link' as const },
    { path: '/backgroundImageUrl', label: 'Background image', type: 'image' as const },
    { path: '/backgroundAlt', label: 'Background alt text', type: 'text' as const },
  ],
  tokenDeps: ['palette.primary'],
  fixture: { heading: 'Ready when you are', primaryCta: { label: 'Book now', href: '/contact' }, backgroundAlt: '' },
  render: ({ props }) => (
    <Section style={{ position: 'relative', isolation: 'isolate', color: '#fff' }}>
      <div className="awb-native-background" style={{ position: 'absolute', inset: 0, zIndex: -2 }}>
        <Media sizeStyle={imageSizing(props, '/backgroundImageUrl', true)} src={props.backgroundImageUrl} alt={props.backgroundAlt} ratio="auto" style={{ height: '100%' }} />
      </div>
      <div className="awb-native-background" style={{ position: 'absolute', inset: 0, background: 'rgba(15, 12, 10, 0.55)', zIndex: -1 }} />
      <Container style={{ display: 'grid', gap: '1.5rem', justifyItems: 'center', textAlign: 'center' }}>
        <Heading level={2} style={{ maxWidth: '18ch' , ...elementColor(props, '/heading')}} data-awb-element={'/heading'}>
          {props.heading}
        </Heading>
        {props.body && <Prose style={{ color: 'rgba(255,255,255,0.82)' , ...elementColor(props, '/body')}} data-awb-element={'/body'}>{props.body}</Prose>}
        <Cta data-awb-element="/primaryCta" style={elementColor(props, '/primaryCta')} {...props.primaryCta} variant="outline" />
      </Container>
    </Section>
  ),
})

const faqPropsSchema = z.object({
  heading: z.string(),
  items: z.array(z.object({ question: z.string(), answer: z.string() })).min(1),
})

export const faqAccordion = defineComponent({
  componentId: 'FaqAccordion',
  version: '1.0.0',
  family: 'FAQ',
  name: 'FAQ accordion',
  description: 'Native disclosure accordion, emits FAQPage schema.',
  aiGuidance: 'Only answer questions using facts supplied by the business.',
  propsSchema: faqPropsSchema,
  editorFields: [
    { path: '/heading', label: 'Heading (H2)', type: 'text' as const, headingLevel: 2 as const },
    { path: '/items', label: 'Questions', type: 'list' as const },
  ],
  tokenDeps: ['palette.border'],
  fixture: { heading: 'Frequently asked', items: [{ question: 'Do you take walk-ins?', answer: 'Walk-ins are welcome when a stylist is free.' }] },
  render: ({ props }) => (
    <Section>
      <Container style={{ display: 'grid', gap: '2rem', maxWidth: '54rem' }}>
        <Heading level={2} style={elementColor(props, '/heading')} data-awb-element={'/heading'}>{props.heading}</Heading>
        <div>
          {props.items.map((item, index) => (
            <details key={item.question} style={{ borderTop: '1px solid var(--awb-border)', padding: '1.25rem 0', ...cardColor(props, `/items/${index}`) }} data-awb-element={`/items/${index}`}>
              <summary style={{ cursor: 'pointer', fontFamily: 'var(--awb-heading-font)', fontSize: '1.1rem', ...elementColor(props, `/items/${index}/question`) }} data-awb-element={`/items/${index}/question`}>{item.question}</summary>
              <Prose style={{ marginTop: '0.75rem', ...elementColor(props, `/items/${index}/answer`) }} data-awb-element={`/items/${index}/answer`}>{item.answer}</Prose>
            </details>
          ))}
        </div>
      </Container>
    </Section>
  ),
})

export function renderContactForm(props: z.infer<typeof contactPropsSchema>, context: RenderContext, prefix = '') {
  const inputAppearance = (index: number) => elementColor(props, `${prefix}/formFields/${index}/input`)
  return (<form data-awb-element={`${prefix}/form`} method="post" action={props.submissionUrl || context.forms?.action || "/api/leads"} style={{ display: 'grid', gap: '1.25rem', minWidth: 0, alignContent: 'start', background: 'var(--awb-surface)', padding: 'clamp(1.5rem, 3vw, 2.5rem)', borderRadius: 'max(var(--awb-radius), 24px)', border: '1px solid var(--awb-border)', boxShadow: '0 16px 48px color-mix(in srgb, var(--awb-primary) 8%, transparent)', ...cardColor(props, `${prefix}/form`) }}>
          {context.forms && !props.submissionUrl && <input type="hidden" name="projectId" value={context.forms.projectId} />}
          {props.formFields.map((field, index) => (
            <fieldset key={field.name} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: 'grid', gap: '0.4rem', fontSize: '0.85rem', textTransform: field.labelCase ?? 'none', letterSpacing: 'normal', color: 'var(--awb-muted)' }}>
              {field.type !== 'checkbox' && <legend data-awb-element={`${prefix}/formFields/${index}/label`} style={{ ...(field.labelFontSize ? { fontSize: field.labelFontSize } : {}), ...elementColor(props, `${prefix}/formFields/${index}/label`), textTransform: field.labelCase ?? 'none' }}><FormLabel field={field} /></legend>}
              {field.type === 'checkbox' ? (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer' }}>
                  <input data-awb-element={`${prefix}/formFields/${index}/input`} type="checkbox" name={field.name} value="yes" required={field.required} style={{ width: 20, height: 20, flexShrink: 0, margin: '0.15em 0 0', accentColor: inputAppearance(index).color ?? 'var(--awb-primary)', ...inputAppearance(index) }} />
                  <span data-awb-element={`${prefix}/formFields/${index}/label`} style={{ ...(field.labelFontSize ? { fontSize: field.labelFontSize } : {}), ...elementColor(props, `${prefix}/formFields/${index}/label`), textTransform: field.labelCase ?? 'none' }}><FormLabel field={field} /></span>
                </label>
              ) : field.type === 'radio' ? (
                <span data-awb-element={`${prefix}/formFields/${index}/input`} style={{ display: 'grid', gap: '0.5rem', ...inputAppearance(index) }}>{[...new Set((field.options ?? []).map(option => option.trim()).filter(Boolean))].map(option => <label key={option} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><input aria-label={option} type="radio" name={field.name} value={option} required={field.required} style={{ accentColor: inputAppearance(index).color ?? 'var(--awb-primary)', ...inputAppearance(index) }} />{option}</label>)}</span>
              ) : field.type === 'textarea' ? (
                <textarea data-awb-element={`${prefix}/formFields/${index}/input`} aria-label={field.label} required={field.required} name={field.name} rows={field.rows ?? 5} style={{ resize: context.editing ? 'none' : 'vertical', minWidth: 0, width: '100%', boxSizing: 'border-box', padding: '0.75rem', border: '1px solid var(--awb-border)', borderRadius: 'var(--awb-radius)', font: 'inherit', textTransform: 'none', letterSpacing: 'normal', background: 'var(--awb-bg)', color: 'var(--awb-fg)', ...inputAppearance(index) }} />
              ) : field.type === 'select' ? (
                <select data-awb-element={`${prefix}/formFields/${index}/input`} aria-label={field.label} name={field.name} required={field.required} defaultValue="" style={{ minWidth: 0, width: '100%', boxSizing: 'border-box', padding: '0.75rem', border: '1px solid var(--awb-border)', borderRadius: 'var(--awb-radius)', font: 'inherit', textTransform: 'none', letterSpacing: 'normal', background: 'var(--awb-bg)', color: 'var(--awb-fg)', ...inputAppearance(index) }}>
                  <option value="">Select an option…</option>
                  {[...new Set((field.options ?? []).map(option => option.trim()).filter(Boolean))].map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input data-awb-element={`${prefix}/formFields/${index}/input`} aria-label={field.label} required={field.required} step={field.type === 'number' ? 'any' : undefined} name={field.name} type={field.type} style={{ minWidth: 0, width: '100%', boxSizing: 'border-box', padding: '0.75rem', border: '1px solid var(--awb-border)', borderRadius: 'var(--awb-radius)', font: 'inherit', textTransform: 'none', letterSpacing: 'normal', background: 'var(--awb-bg)', color: 'var(--awb-fg)', ...inputAppearance(index) }} />
              )}
            </fieldset>
          ))}
          {props.consentText && <p style={{ fontSize: '0.75rem', color: 'var(--awb-muted)', margin: 0 }}>{<span data-awb-element={`${prefix}/consentText`} style={elementColor(props, `${prefix}/consentText`)}>{props.consentText}</span>}</p>}
          {!props.submissionUrl && context.forms?.recaptchaSiteKey && <div className="g-recaptcha" data-sitekey={context.forms.recaptchaSiteKey} />}
          <button data-awb-element={`${prefix}/submitButton`} type="submit" style={{ padding: '0.95rem 1.8rem', background: 'var(--awb-button-bg, var(--awb-primary))', color: 'var(--awb-button-fg, var(--awb-primary-fg))', border: 'none', borderRadius: 'var(--awb-radius)', textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer', ...elementColor(props, `${prefix}/submitButton`) }}>
            <span data-awb-element={`${prefix}/submitLabel`} style={elementColor(props, `${prefix}/submitLabel`)}>{props.submitLabel}</span>
          </button>
        </form>)
}
