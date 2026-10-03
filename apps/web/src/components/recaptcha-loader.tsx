'use client'
import Script from 'next/script'

export function RecaptchaLoader() {
  return <Script src="https://www.google.com/recaptcha/api.js?render=explicit" onReady={() => {
    const captcha = (window as unknown as { grecaptcha?: { ready: (fn: () => void) => void; render: (element: Element, options: { sitekey: string }) => void } }).grecaptcha
    captcha?.ready(() => document.querySelectorAll<HTMLElement>('.g-recaptcha').forEach((element) => {
      if (!element.childNodes.length && element.dataset.sitekey) captcha.render(element, { sitekey: element.dataset.sitekey })
    }))
  }} />
}
