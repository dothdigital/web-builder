import { PublicPageSchema } from '@/components/public-page-schema'
import { publicPageMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { SupportHome } from './support-home'
export const metadata: Metadata = publicPageMetadata('/support')

export default function SupportPage() { return <><PublicPageSchema path="/support" /><SupportHome /></> }
