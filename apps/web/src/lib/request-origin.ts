import { appUrl } from './account-security'

// The reverse proxy's internal request URL may differ from the public HTTPS URL.
export function sameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try { return new URL(origin).origin === appUrl() }
  catch { return false }
}
