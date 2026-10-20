import { z } from 'zod'
import { SocialLink, uniqueSocialLinks } from './social-link'

export const businessContactDetailsSchema = z.object({
  address: z.string(),
  emails: z.array(z.string()),
  phones: z.array(z.string()),
  socials: z.array(z.object({ platform: z.string(), href: z.string() })),
  hours: z.array(z.object({ day: z.string(), value: z.string() })),
})
export type BusinessContactDetailsValue = z.infer<typeof businessContactDetailsSchema>

export function BusinessContactDetails({ details }: { details: BusinessContactDetailsValue }) {
  const hasDetails = details.address || details.emails.length || details.phones.length || details.socials.length || details.hours.length
  if (!hasDetails) return null
  return <div data-awb-business-contact="true" style={{ display: 'grid', gap: '1.5rem', overflowWrap: 'anywhere' }}>
    <address style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '1.5rem', fontStyle: 'normal' }}>
      {details.address && <div><h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Address</h3><p style={{ margin: 0 }}>{details.address}</p></div>}
      {details.phones.length > 0 && <div><h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Phone</h3><div style={{ display: 'grid', gap: '0.5rem' }}>{details.phones.map((phone, index) => <a key={index} href={`tel:${phone}`} style={{ color: 'inherit' }}>{phone}</a>)}</div></div>}
      {details.emails.length > 0 && <div><h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Email</h3><div style={{ display: 'grid', gap: '0.5rem' }}>{details.emails.map((email, index) => <a key={index} href={`mailto:${email}`} style={{ color: 'inherit' }}>{email}</a>)}</div></div>}
    </address>
    {details.socials.length > 0 && <div><h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Follow us</h3><div aria-label="Social media" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>{uniqueSocialLinks(details.socials).map(social => <SocialLink key={`${social.platform}:${social.href}`} {...social} />)}</div></div>}
    {details.hours.length > 0 && <div><h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Opening hours</h3><dl style={{ margin: 0, display: 'grid', gap: '0.4rem' }}>{details.hours.map((hour, index) => <div key={index} style={{ display: 'flex', gap: '1rem' }}><dt>{hour.day}</dt><dd style={{ margin: 0 }}>{hour.value}</dd></div>)}</dl></div>}
  </div>
}
