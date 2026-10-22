const MEASUREMENT_ID = 'G-Z5M0FPHR6M'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

function googleTag() {
  // Queue denied defaults before any consent update or Google SDK load.
  if (!window.gtag) {
    window.dataLayer = window.dataLayer || []
    window.gtag = function () { window.dataLayer!.push(arguments) }
    window.gtag('consent', 'default', consentState(false))
  }
  return window.gtag
}

function consentState(accepted: boolean) {
  const state = accepted ? 'granted' : 'denied'
  return { analytics_storage: state, ad_storage: state, ad_user_data: state, ad_personalization: state }
}

export function updateGoogleConsent(accepted: boolean) {
  googleTag()('consent', 'update', consentState(accepted))
  if (!accepted) {
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.trim().split('=')[0]
      if (!/^(_ga($|_)|_gid$|_gat($|_)|_gcl_)/.test(name)) continue
      const labels = location.hostname.split('.')
      const domains = ['', ...labels.map((_, i) => labels.slice(i).join('.')).filter(domain => domain.includes('.'))]
      for (const domain of domains) {
        document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ''}`
      }
    }
  }
}

export function googlePageView(pathname: string) {
  const gtag = googleTag()
  if (!document.getElementById('webtummy-google-analytics')) {
    gtag('js', new Date())
    // Explicit public page views avoid exposing private routes and query strings.
    gtag('config', MEASUREMENT_ID, { send_page_view: false, page_location: location.origin + pathname })
    const script = document.createElement('script')
    script.id = 'webtummy-google-analytics'
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
    document.head.appendChild(script)
  }
  gtag('event', 'page_view', { page_location: location.origin + pathname, page_title: document.title })
}
