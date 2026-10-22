import { elementColor } from '../element-colors'
import { imageSizing } from '../image-sizing'
import { z } from 'zod'
import { SocialLink, uniqueSocialLinks } from './social-link'
import { defineComponent } from '../types'
import { Container } from '../primitives'

export const footerPropsSchema = z.object({
  businessName: z.string(),
  layoutManaged: z.boolean().default(false),
  tagline: z.string().optional(),
  logoImageUrl: z.string().optional(),
  phones: z.array(z.string()).optional(),
  emails: z.array(z.string()).optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  columns: z
    .array(
      z.object({
        title: z.string(),
        kind: z.enum(['links', 'address', 'logo']).default('links'),
        items: z.array(z.object({ label: z.string(), href: z.string() })),
      }),
    )
    .default([]),
  socials: z.array(z.object({ platform: z.string(), href: z.string() })).default([]),
  legalLinks: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
  address: z.string().optional(),
})

const footerEditorFields = [
  { path: '/businessName', label: 'Business name', type: 'text' as const },
  { path: '/logoImageUrl', label: 'Logo image', type: 'image' as const },
  { path: '/phone', label: 'Phone', type: 'text' as const },
  { path: '/email', label: 'Email', type: 'text' as const },
  { path: '/tagline', label: 'Tagline', type: 'text' as const },
  { path: '/columns', label: 'Link columns', type: 'list' as const },
  { path: '/socials', label: 'Social links', type: 'list' as const },
  { path: '/legalLinks', label: 'Legal links', type: 'list' as const },
  { path: '/address', label: 'Address', type: 'text' as const },
]

const fixture = {
  layoutManaged: false,
  businessName: 'MJ Saloon',
  tagline: 'Precision cutting and colour in Mississauga.',
  columns: [],
  socials: [],
  legalLinks: [{ label: 'Privacy', href: '/privacy' }],
}

export const footerEditorial = defineComponent({
  componentId: 'FooterEditorial',
  version: '1.0.0',
  family: 'FOOTER',
  name: 'Editorial footer',
  description: 'Four responsive columns for brand, main links, information and contact details.',
  aiGuidance: 'Pairs with editorial and typographic heroes.',
  propsSchema: footerPropsSchema,
  editorFields: footerEditorFields,
  tokenDeps: ['palette.foreground', 'typography.headingFamily'],
  fixture,
  render: ({ props, context }) => {
    const href = (value: string) => value.startsWith('/') && !value.startsWith('//') ? `${context.baseUrl}${value}` : value
    return (
      <footer style={{ background: 'var(--awb-primary)', color: 'var(--awb-primary-fg)', borderTop: '4px solid var(--awb-accent)', padding: '3.5rem 0 1.5rem', fontFamily: 'var(--awb-body-font)', lineHeight: 1.7 }}>
        <Container>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '2.5rem', alignItems: 'start' }}>
            {!props.layoutManaged && <div>
              <a href={href('/')} style={{ color: 'inherit', textDecoration: 'none', display: 'inline-block' }}>
                {props.logoImageUrl ? <img data-awb-element="/logoImageUrl" src={props.logoImageUrl} alt={props.businessName} style={{ display: 'block', maxWidth: 'min(100%, 220px)', width: 'auto', height: 'auto', maxHeight: '80px', objectFit: 'contain', objectPosition: 'left center', ...imageSizing(props, '/logoImageUrl') }} /> : <span style={{ fontFamily: 'var(--awb-heading-font)', fontSize: '1.4rem', fontWeight: 600 }}>{<span data-awb-element="/businessName" style={elementColor(props, '/businessName')}>{props.businessName}</span>}</span>}
              </a>
              {props.tagline && <p style={{ margin: '1rem 0 0', maxWidth: '32ch', fontSize: '0.9rem' }}>{<span data-awb-element="/tagline" style={elementColor(props, '/tagline')}>{props.tagline}</span>}</p>}
            </div>}
            {props.columns.map((column, columnIndex) => (
              <nav key={columnIndex} aria-label={`Footer ${column.title}`}>
                <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}><span data-awb-element={`/columns/${columnIndex}/title`} style={elementColor(props, `/columns/${columnIndex}/title`)}>{column.title}</span></h2>
                {column.kind === 'logo' ? <div><a href={href('/')} style={{ color: 'inherit' }}>{props.logoImageUrl ? <img src={props.logoImageUrl} alt={props.businessName} style={{ maxWidth: '100%', maxHeight: 80, objectFit: 'contain' }} /> : props.businessName}</a>{props.tagline && <p>{props.tagline}</p>}</div> : column.kind === 'address' ? <address style={{ fontStyle: 'normal', overflowWrap: 'anywhere' }}>{props.address && <p>{props.address}</p>}{(props.phones ?? (props.phone ? [props.phone] : [])).map((phone, i) => <p key={`p${i}`}><a style={{ color: 'inherit' }} href={`tel:${phone}`}>{phone}</a></p>)}{(props.emails ?? (props.email ? [props.email] : [])).map((email, i) => <p key={`e${i}`}><a style={{ color: 'inherit' }} href={`mailto:${email}`}>{email}</a></p>)}{uniqueSocialLinks(props.socials).map(social => <SocialLink key={`${social.platform}:${social.href}`} platform={social.platform} href={social.href} />)}</address> : <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.55rem', fontSize: '0.9rem' }}>
                  {column.items.map((item, itemIndex) => <li key={item.href + item.label}><a href={href(item.href)} style={{ color: 'inherit', textDecoration: 'none' }}><span data-awb-element={`/columns/${columnIndex}/items/${itemIndex}/label`} style={elementColor(props, `/columns/${columnIndex}/items/${itemIndex}/label`)}>{item.label}</span></a></li>)}
                </ul>}
              </nav>
            ))}
            {!props.layoutManaged && <div>
              <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>Get in touch</h2>
              <address style={{ fontStyle: 'normal', display: 'grid', gap: '0.65rem', fontSize: '0.9rem', overflowWrap: 'anywhere' }}>
                {props.address && <p style={{ margin: 0 }}>{<span data-awb-element="/address" style={elementColor(props, '/address')}>{props.address}</span>}</p>}
                {(props.phones ?? (props.phone ? [props.phone] : [])).map((phone, index) => <a key={index} href={`tel:${phone}`} style={{ color: 'inherit' }}>{<span data-awb-element={props.phones ? `/phones/${index}` : '/phone'} style={elementColor(props, props.phones ? `/phones/${index}` : '/phone')}>{phone}</span>}</a>)}
                {(props.emails ?? (props.email ? [props.email] : [])).map((email, index) => <a key={index} href={`mailto:${email}`} style={{ color: 'inherit' }}>{<span data-awb-element={props.emails ? `/emails/${index}` : '/email'} style={elementColor(props, props.emails ? `/emails/${index}` : '/email')}>{email}</span>}</a>)}
              </address>
              {props.socials.length > 0 && <div aria-label="Social media" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem', fontSize: '0.85rem' }}>{uniqueSocialLinks(props.socials).map((social) => <SocialLink key={`${social.platform}:${social.href}`} platform={social.platform} href={social.href} />)}</div>}
            </div>}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.25)', marginTop: '2.5rem', paddingTop: '1.25rem', fontSize: '0.8rem' }}>© {new Date().getFullYear()} {<span data-awb-element="/businessName" style={elementColor(props, '/businessName')}>{props.businessName}</span>}</div>
        </Container>
      </footer>
    )
  },
})

export const footerCompact = defineComponent({
  componentId: 'FooterCompact',
  version: '1.0.0',
  family: 'FOOTER',
  name: 'Compact footer',
  description: 'Single row with address, links and legal line.',
  aiGuidance: 'Use for small sites where the footer should stay quiet.',
  propsSchema: footerPropsSchema,
  editorFields: footerEditorFields,
  tokenDeps: ['palette.border'],
  fixture,
  render: ({ props, context }) => props.layoutManaged ? <footerEditorial.render props={props} context={context} /> : (
    <footer style={{ borderTop: '1px solid var(--awb-border)', padding: '2.5rem 0', fontFamily: 'var(--awb-body-font)', fontSize: '0.85rem' }}>
      <Container style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap', color: 'var(--awb-muted)' }}>
        <span>
          © {new Date().getFullYear()} <span data-awb-element="/businessName" style={elementColor(props, '/businessName')}>{props.businessName}</span>
          {props.address && <span data-awb-element="/address" style={elementColor(props, '/address')}> · {props.address}</span>}
        </span>
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
          {(props.phones ?? (props.phone ? [props.phone] : [])).map((phone, index) => <a key={`phone-${index}`} href={`tel:${phone}`}>{<span data-awb-element={props.phones ? `/phones/${index}` : '/phone'} style={elementColor(props, props.phones ? `/phones/${index}` : '/phone')}>{phone}</span>}</a>)}
          {(props.emails ?? (props.email ? [props.email] : [])).map((email, index) => <a key={`email-${index}`} href={`mailto:${email}`}>{<span data-awb-element={props.emails ? `/emails/${index}` : '/email'} style={elementColor(props, props.emails ? `/emails/${index}` : '/email')}>{email}</span>}</a>)}
          {uniqueSocialLinks(props.socials).map((social) => (
            <SocialLink key={`${social.platform}:${social.href}`} platform={social.platform} href={social.href} />
          ))}
          {props.legalLinks.map((link, index) => (
            <a key={link.href} href={link.href} style={{ color: 'inherit' }}>
              <span data-awb-element={`/legalLinks/${index}/label`} style={elementColor(props, `/legalLinks/${index}/label`)}>{link.label}</span>
            </a>
          ))}
        </div>
      </Container>
    </footer>
  ),
})
