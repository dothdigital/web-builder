import { getStorage } from '@awb/shared'
import { appUrl } from '@/lib/account-security'
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\.png$/i.test(file)) return new Response('Not found', { status: 404 })
  const url = await getStorage().readUrl(`marketing/${file}`)
  return new Response(null, { status: 302, headers: { Location: new URL(url, appUrl()).href, 'Cache-Control': 'public, max-age=300' } })
}
