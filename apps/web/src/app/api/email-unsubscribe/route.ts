import { prisma } from '@awb/database'
import { z } from 'zod'
// RFC 8058 one-click: possession of the opaque token authorises only opting out.
export async function POST(request: Request) {
  const token = z.string().uuid().safeParse(new URL(request.url).searchParams.get('token'))
  if (!token.success) return new Response('Invalid link', { status: 400 })
  await prisma.emailContact.updateMany({ where: { unsubscribeToken: token.data }, data: { optedIn: false } })
  return new Response('Unsubscribed', { headers: { 'Cache-Control': 'no-store' } })
}
export async function GET(request: Request) {
  const url = new URL('/email-preferences', request.url); url.search = new URL(request.url).search
  return Response.redirect(url, 303)
}
