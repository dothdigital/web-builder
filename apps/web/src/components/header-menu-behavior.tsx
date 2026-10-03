'use client'
import Script from 'next/script'
import { HEADER_MENU_SCRIPT } from '../lib/header-menu-script'

export function HeaderMenuBehavior() {
  return <Script id="awb-header-menu-behavior" strategy="afterInteractive">{HEADER_MENU_SCRIPT}</Script>
}
