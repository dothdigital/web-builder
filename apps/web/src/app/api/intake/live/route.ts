import { env } from '@awb/shared'
import { rateLimit } from '@/lib/account-security'
import { sameOriginRequest } from '@/lib/request-origin'
import { requireUser, withApiAuthorization } from '@/lib/tenancy'
import { readBoundedBody, RequestBodyTooLarge } from '@/lib/request-body'
import { createIntakeTranscriptionCall } from '@/lib/intake-live-transcription'

export const runtime = 'nodejs'
export const maxDuration = 30

async function handlePOST(request: Request) {
  if (!sameOriginRequest(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 })
  const user = await requireUser()
  try { await rateLimit(`intake-voice:${user.id}`, 12, 15) }
  catch { return Response.json({ error: 'Please wait a few minutes before recording again.' }, { status: 429 }) }
  const apiKey = env().OPENAI_API_KEY
  if (!apiKey) return Response.json({ error: 'Voice input is unavailable. You can type your answer.' }, { status: 503 })
  let sdp: string
  try { sdp = new TextDecoder().decode(await readBoundedBody(request, 65536)) }
  catch (error) { return Response.json({ error: 'Invalid voice connection.' }, { status: error instanceof RequestBodyTooLarge ? 413 : 400 }) }
  if (!sdp.startsWith('v=0') || !sdp.includes('m=audio')) return Response.json({ error: 'Invalid voice connection.' }, { status: 400 })
  try {
    return new Response(await createIntakeTranscriptionCall(sdp, apiKey), { headers: { 'Content-Type': 'application/sdp', 'Cache-Control': 'no-store' } })
  } catch { return Response.json({ error: 'Live transcription could not connect. Try again or use a recording.' }, { status: 502 }) }
}

export const POST = withApiAuthorization(handlePOST)
