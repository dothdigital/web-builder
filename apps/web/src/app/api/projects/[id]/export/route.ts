export const dynamic = 'force-dynamic'
export async function GET() {
  return Response.json({ error: 'Webtummy websites are published through managed hosting. Source downloads are unavailable.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } })
}
