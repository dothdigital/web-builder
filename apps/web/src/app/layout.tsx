import type { Metadata } from 'next'
import './globals.css'
import './legal.css'

export const metadata: Metadata = {
  title: 'Webtummy — AI Website Builder',
  description: 'Describe your business, answer a few questions, get an editable website.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-neutral-50 text-neutral-900">{children}</body>
    </html>
  )
}
