import type { Metadata } from 'next'
import './globals.css'
import './legal.css'
import { MetaPixel } from '@/components/analytics/meta-pixel'
import { SITE_DESCRIPTION, SITE_URL } from '@/lib/seo'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: 'Webtummy',
  title: 'Webtummy — AI Website Builder',
  description: SITE_DESCRIPTION,
  // Public pages opt in explicitly; account, workspace and future app routes stay out of search.
  robots: { index: false, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-neutral-50 text-neutral-900">
        {children}
        <MetaPixel />
      </body>
    </html>
  )
}
