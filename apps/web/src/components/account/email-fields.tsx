import { EmailDesigner } from './email-designer'
import type { EmailCampaign, EmailSequenceStep } from '@awb/database'
export function WebsiteFilter({ value = 'ANY' }: { value?: string }) {
  return <label>Website status<select name="websiteCondition" defaultValue={value}><option value="ANY">With or without a website</option><option value="HAS_WEBSITE">Has created a website</option><option value="NO_WEBSITE">Has not created a website</option></select></label>
}
export function EmailFields({ value }: { value?: Pick<EmailCampaign | EmailSequenceStep, 'name' | 'subject' | 'body' | 'bodyDesign' | 'websiteCondition'> }) {
  return <><label>Internal name<input name="name" defaultValue={value?.name} minLength={2} maxLength={100} required /></label><WebsiteFilter value={value?.websiteCondition} /><label>Email subject<input name="subject" defaultValue={value?.subject} required minLength={2} maxLength={200} /></label><EmailDesigner body={value?.body ?? 'Hi {{name}},\n\nWrite your message here.'} initialDesign={value?.bodyDesign} /><small>Personalise with {'{{name}}'}, {'{{website_name}}'}, {'{{trial_end}}'}, {'{{dashboard_url}}'} and {'{{billing_url}}'}. Links can be pasted in full. Your mailing address and unsubscribe link are included automatically.</small></>
}
export function AudienceField({ value = 'UNPAID' }: { value?: string }) {
  return <label>Audience<select name="audience" defaultValue={value}><option value="UNPAID">All unpaid users</option><option value="EXPIRED">Unpaid — subscription required</option><option value="PAID">Paid users</option></select></label>
}
