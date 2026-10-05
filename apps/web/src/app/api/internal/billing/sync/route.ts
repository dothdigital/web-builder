import { timingSafeEqual } from 'node:crypto'
import { runBillingSweep } from '@/lib/billing/lifecycle'
export const runtime = 'nodejs'
export const maxDuration = 300
export async function POST(request: Request) {
  const secret = process.env.BILLING_CRON_SECRET
  const received = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (!secret || secret.length < 32 || received.length !== expected.length || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return new Response(null, { status: 401 })
  return Response.json(await runBillingSweep(), { headers: { 'Cache-Control': 'no-store' } })
}
