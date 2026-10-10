import { getGenerationProgress } from '@awb/pipeline'
import { requireProject, withApiAuthorization } from '@/lib/tenancy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/// Server-sent events beat polling here: generation takes minutes and the user
/// needs to see which stage is running, not a spinner.
async function handleGET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireProject(id)

  const url = new URL(request.url)
  const correlationId = url.searchParams.get('correlationId')

  if (!correlationId) {
    return Response.json({ error: 'correlationId is required' }, { status: 400 })
  }

  if (url.searchParams.get('format') === 'json') {
    return Response.json(await getGenerationProgress(id, correlationId), { headers: { 'cache-control': 'no-store' } })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false

      const send = (data: unknown) => {
        if (!closed) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }
      }

      const finish = () => {
        if (!closed) {
          closed = true
          clearInterval(timer)
          controller.close()
        }
      }

      const tick = async () => {
        try {
          const progress = await getGenerationProgress(id, correlationId)
          send(progress)

          if (progress.status === 'succeeded' || progress.status === 'failed') {
            finish()
          }
        } catch (error) {
          send({ status: 'failed', error: error instanceof Error ? error.message : 'unknown error' })
          finish()
        }
      }

      const timer = setInterval(tick, 1200)
      request.signal.addEventListener('abort', finish)
      await tick()
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}

export const GET = withApiAuthorization(handleGET)
