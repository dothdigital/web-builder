import type { Metadata } from 'next'

export const SITE_URL = 'https://webtummy.com'
export const SITE_DESCRIPTION = 'Build a business website with AI, edit without coding, and grow with SEO tools, content and managed hosting. For businesses and creators worldwide.'
export const SOCIAL_IMAGE = { url: '/og/webtummy.png', width: 1200, height: 630, alt: 'Webtummy — AI website builder, SEO tools and managed hosting' }

export const PUBLIC_PAGES = {
  '/': { title: 'AI Website Builder with Hosting & SEO | Webtummy', description: SITE_DESCRIPTION, label: 'Home' },
  '/how-it-works': { title: 'How Our AI Website Builder Works | Webtummy', description: 'Describe your business, generate a website with AI, edit it visually and publish on your domain. See how Webtummy brings website creation and growth together.', label: 'How it works' },
  '/pricing': { title: 'AI Website Builder Pricing — US$29/Month | Webtummy', description: 'AI website creation, visual editing, SEO and managed hosting for US$29/month. Eligible new customers get a 7-day free trial. Card required. Cancel renewal anytime.', label: 'Pricing' },
  '/about-us': { title: 'About Webtummy — AI Website Builder & Growth Tools', description: 'Meet Webtummy: one platform for AI website creation, content, SEO and hosting, built for small businesses, entrepreneurs and agencies worldwide.', label: 'About us' },
  '/faq': { title: 'AI Website Builder FAQs — Hosting, SEO & Plans | Webtummy', description: 'Find answers about building a website with AI, visual editing, custom domains, SEO, hosting and Webtummy’s US$29 monthly plan.', label: 'Frequently asked questions' },
  '/contact': { title: 'Contact Webtummy — Website & Account Support', description: 'Contact the Webtummy team for help with AI website creation, editing, domains, hosting, your account or subscription.', label: 'Contact' },
  '/support': { title: 'Webtummy Help Center — Website Builder Guides', description: 'Step-by-step guides for building and editing your Webtummy website. Get help with AI tools, images, SEO, custom domains, hosting and publishing.', label: 'Help center' },
  '/privacy': { title: 'Privacy Policy | Webtummy', description: 'Learn how Webtummy handles personal information, account data, cookies and consent, and how to exercise your privacy rights.', label: 'Privacy policy' },
  '/terms': { title: 'Terms of Use | Webtummy', description: 'Read the terms for using Webtummy’s AI website builder, hosting and subscriptions, including trial eligibility, billing and cancellation.', label: 'Terms of use' },
} as const

export function pageMetadata(path: string, title: string, description: string, index = true): Metadata {
  const url = SITE_URL + path
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: index ? { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } } : { index: false, follow: true },
    openGraph: { type: 'website', siteName: 'Webtummy', title, description, url, images: [SOCIAL_IMAGE] },
    twitter: { card: 'summary_large_image', title, description, images: [SOCIAL_IMAGE] },
  }
}

export function publicPageMetadata(path: keyof typeof PUBLIC_PAGES): Metadata {
  const page = PUBLIC_PAGES[path]
  return pageMetadata(path, page.title, page.description)
}
