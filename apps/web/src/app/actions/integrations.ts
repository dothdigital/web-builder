'use server'

import { WorkspaceRole, prisma } from '@awb/database'
import { z } from 'zod'
import { requireProject } from '@/lib/tenancy'
import { encryptRecaptchaSecret } from '@/lib/recaptcha'

export async function getRecaptchaSettings(projectId: string) {
  await requireProject(projectId)
  const config = await prisma.integration.findUnique({ where: { projectId } })
  return { enabled: config?.recaptchaEnabled ?? false, siteKey: config?.recaptchaSiteKey ?? '', hasSecret: !!config?.recaptchaSecret }
}
export async function saveRecaptchaSettings(projectId: string, input: unknown) {
  await requireProject(projectId, WorkspaceRole.EDITOR)
  const values = z.object({ enabled: z.boolean(), siteKey: z.string().trim().max(200).regex(/^[a-zA-Z0-9_-]*$/), secret: z.string().trim().max(500) }).parse(input)
  const existing = await prisma.integration.findUnique({ where: { projectId } })
  if (values.enabled && (!values.siteKey || (!values.secret && !existing?.recaptchaSecret))) throw new Error('Enter a site key and secret key before enabling reCAPTCHA.')
  if (values.enabled && existing?.recaptchaSiteKey && existing.recaptchaSiteKey !== values.siteKey && !values.secret) throw new Error('Enter the matching secret when changing the site key.')
  const data = { recaptchaEnabled: values.enabled, recaptchaSiteKey: values.siteKey, ...(values.secret ? { recaptchaSecret: encryptRecaptchaSecret(values.secret) } : {}) }
  await prisma.integration.upsert({ where: { projectId }, create: { projectId, conversionEvents: [], ...data }, update: data })
}
