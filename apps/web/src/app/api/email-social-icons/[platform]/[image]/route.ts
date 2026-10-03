import sharp from 'sharp'
import { emailSocialPlatforms, emailSocialSvg, type EmailSocialPlatform } from '@awb/shared/email-social'
export const runtime = 'nodejs'
// Public, fixed glyphs only. PNGs work in email apps that strip inline SVG.
export async function GET(_request: Request, { params }: { params: Promise<{ platform: string; image: string }> }) {
  const { platform, image } = await params
  if (!emailSocialPlatforms.includes(platform as EmailSocialPlatform) || !/^[a-f\d]{6}\.png$/i.test(image)) return new Response('Not found', { status: 404 })
  const png = await sharp(Buffer.from(emailSocialSvg(platform as EmailSocialPlatform, `#${image.slice(0, 6)}`))).png().toBuffer()
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } })
}
