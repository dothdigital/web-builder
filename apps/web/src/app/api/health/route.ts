import { prisma } from '@awb/database'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return Response.json({ status: 'ok', database: 'up' })
  } catch {
    return Response.json({ status: 'degraded', database: 'down' }, { status: 503 })
  }
}
