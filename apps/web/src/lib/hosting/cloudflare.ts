import { assertHostingConfigured } from './config'

export type ValidationRecord = { type: 'TXT'; name: string; value: string }
export type CustomHostname = { id: string; hostname: string; status: string; ownership_verification?: { type: string; name: string; value: string }; ssl?: { status: string; validation_records?: Array<{ txt_name?: string; txt_value?: string }> } }
async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const config = assertHostingConfigured()
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(config.zoneId)}${path}`, { method, headers: { Authorization: `Bearer ${config.apiToken}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000), cache: 'no-store' })
  const result = await response.json() as { success: boolean; result: T }
  if (!response.ok || !result.success) throw new Error('Cloudflare request failed')
  return result.result
}
export async function ensureCustomHostname(hostname: string, id?: string | null) {
  if (id) return api<CustomHostname>(`/custom_hostnames/${encodeURIComponent(id)}`)
  // Recover a hostname created before the database write completed.
  const existing = await api<CustomHostname[]>(`/custom_hostnames?hostname=${encodeURIComponent(hostname)}`)
  return existing.find((entry) => entry.hostname === hostname) ?? api<CustomHostname>('/custom_hostnames', 'POST', { hostname, ssl: { method: 'txt', type: 'dv', settings: { min_tls_version: '1.2' } } })
}
export function validationRecords(host: CustomHostname): ValidationRecord[] {
  const records: ValidationRecord[] = []
  if (host.ownership_verification?.type === 'txt') records.push({ type: 'TXT', name: host.ownership_verification.name, value: host.ownership_verification.value })
  for (const record of host.ssl?.validation_records ?? []) if (record.txt_name && record.txt_value) records.push({ type: 'TXT', name: record.txt_name, value: record.txt_value })
  return records
}
export async function deleteCustomHostname(id: string) { await api(`/custom_hostnames/${encodeURIComponent(id)}`, 'DELETE') }
