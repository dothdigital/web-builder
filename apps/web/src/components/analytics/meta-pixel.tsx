'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import styles from './meta-pixel.module.css'
import { googlePageView, updateGoogleConsent } from './google-consent'

const PIXEL_ID = '3004331693237487'
const STORAGE_KEY = 'webtummy-optional-consent-v2'
const CONSENT_LIFETIME = 180 * 24 * 60 * 60 * 1000
const PUBLIC_PAGES = new Set(['/', '/how-it-works', '/pricing', '/about-us', '/faq', '/contact', '/privacy', '/terms', '/signup', '/support', '/ai-website-builder', '/website-builder-for-entrepreneurs', '/no-code-website-builder', '/website-builder-for-consultants', '/restaurant-website-builder', '/freelancer-website-builder'])
type Choice = 'accepted' | 'rejected'
type Pixel = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[][]
  push: Pixel
  loaded: boolean
  version: string
  disablePushState: boolean
}
declare global { interface Window { fbq?: Pixel; _fbq?: Pixel } }

function readChoice(): Choice | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved && (saved.choice === 'accepted' || saved.choice === 'rejected') && saved.expires > Date.now()) return saved.choice
  } catch { /* Storage can be unavailable; default to no advertising permission. */ }
  return null
}

function revokePixel() {
  const fbq = window.fbq
  if (!fbq) return
  // Drop unsent events as well as revoking future sends if the script is still loading.
  fbq.queue = fbq.queue.filter(args => !['track', 'trackSingle', 'consent'].includes(String(args[0])))
  if (fbq.callMethod) fbq('consent', 'revoke')
  else fbq.queue.unshift(['consent', 'revoke'])
}

function clearAdvertisingCookies() {
  for (const name of ['_fbp', '_fbc']) {
    for (const domain of ['', location.hostname, `.${location.hostname}`]) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ''}`
    }
  }
}

function pixel(): Pixel {
  if (window.fbq) return window.fbq
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args)
    else fbq.queue.push(args)
  } as Pixel
  fbq.queue = []
  fbq.push = fbq
  fbq.loaded = true
  fbq.version = '2.0'
  fbq.disablePushState = true
  window.fbq = window._fbq = fbq
  // Keep automatic events and form matching disabled. Only explicit page views are sent.
  fbq('consent', 'revoke')
  fbq('set', 'autoConfig', false, PIXEL_ID)
  fbq('init', PIXEL_ID)
  return fbq
}

function loadPixel(onReady: () => void) {
  const existing = document.getElementById('webtummy-meta-pixel')
  if (existing) {
    if (existing.dataset.ready === 'true') onReady()
    else existing.addEventListener('load', onReady, { once: true })
    return
  }
  const script = document.createElement('script')
  script.id = 'webtummy-meta-pixel'
  script.async = true
  script.src = 'https://connect.facebook.net/en_US/fbevents.js'
  script.referrerPolicy = 'origin'
  script.onload = () => { script.dataset.ready = 'true'; onReady() }
  script.onerror = () => script.remove()
  document.head.appendChild(script)
}

function safePublicLocation() {
  // Do not expose verification tokens, email addresses, workspace IDs or arbitrary query data.
  if (location.hash) return false
  return [...new URLSearchParams(location.search).keys()].every(key => key === 'fbclid' || /^utm_(source|medium|campaign|term|content|id)$/.test(key))
}

export function MetaPixel() {
  const pathname = usePathname()
  const isPublic = PUBLIC_PAGES.has(pathname) || pathname.startsWith('/support/')
  const [ready, setReady] = useState(false)
  const [pixelReady, setPixelReady] = useState(false)
  const [choice, setChoice] = useState<Choice | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [privacySignal, setPrivacySignal] = useState(false)
  const lastPage = useRef<string | null>(null)
  const lastGooglePage = useRef<string | null>(null)

  useEffect(() => {
    const signal = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
    setPrivacySignal(signal)
    setChoice(signal ? 'rejected' : readChoice())
    setReady(true)
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setChoice(signal ? 'rejected' : readChoice())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  useEffect(() => {
    if (!ready) return
    const accepted = choice === 'accepted' && isPublic && safePublicLocation()
    updateGoogleConsent(accepted)
    if (!accepted) {
      lastGooglePage.current = null
      return
    }
    if (lastGooglePage.current !== pathname) {
      googlePageView(pathname)
      lastGooglePage.current = pathname
    }
  }, [ready, choice, isPublic, pathname])

  useEffect(() => {
    if (!ready) return
    if (choice !== 'accepted' || !isPublic || !safePublicLocation()) {
      revokePixel()
      lastPage.current = null
      if (choice !== 'accepted') clearAdvertisingCookies()
      return
    }
    const fbq = pixel()
    // Meta pauses its startup queue on revoke. Grant only after the SDK has loaded
    // so the command can unlock that queue instead of getting stuck behind it.
    if (!pixelReady) {
      loadPixel(() => setPixelReady(true))
      return
    }
    fbq('consent', 'grant')
    if (lastPage.current !== pathname) {
      fbq('trackSingle', PIXEL_ID, 'PageView')
      lastPage.current = pathname
    }
  }, [ready, pixelReady, choice, isPublic, pathname])

  function choose(next: Choice) {
    const value = privacySignal ? 'rejected' : next
    updateGoogleConsent(value === 'accepted' && isPublic && safePublicLocation())
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice: value, expires: Date.now() + CONSENT_LIFETIME })) } catch { /* Honour the choice for this page even without storage. */ }
    if (value === 'rejected') {
      revokePixel()
      clearAdvertisingCookies()
    }
    setChoice(value)
    setShowSettings(false)
  }

  if (!ready || !isPublic) return null
  if (choice && !showSettings) return <button type="button" className={styles.settings} onClick={() => setShowSettings(true)}>Cookie settings</button>
  return <section className={styles.banner} aria-label="Analytics and advertising cookie preferences">
    <div className={styles.copy}>
      <h2>Choose your cookies</h2>
      <p>Essential cookies keep Webtummy working. With your permission, we also use Google Analytics to understand site visits and Google and Meta advertising cookies to measure ads and help show relevant ads. You can change your choice anytime in Cookie settings. <Link href="/privacy">Privacy Policy</Link></p>
      {privacySignal && <p>Your browser’s privacy preference keeps optional cookies off.</p>}
    </div>
    <div className={styles.actions}>
      <button type="button" onClick={() => choose('rejected')}>Reject optional</button>
      {!privacySignal && <button type="button" onClick={() => choose('accepted')}>Accept optional</button>}
    </div>
  </section>
}
