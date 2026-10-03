import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import { ensureAccountWorkspace, socialAvailability } from './lib/social-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@awb/database'
import { rateLimit, verifyPassword } from './lib/account-security'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma as never),
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: '/signin' },
  providers: [
    ...(socialAvailability().google ? [Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET, allowDangerousEmailAccountLinking: false })] : []),
    ...(socialAvailability().microsoft ? [MicrosoftEntraID({ clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID, clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET, issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER || 'https://login.microsoftonline.com/common/v2.0', allowDangerousEmailAccountLinking: false })] : []),
    Credentials({
    id: 'password', name: 'Email and password',
    credentials: { email: { type: 'email' }, password: { type: 'password' } },
    async authorize(credentials, request) {
      const email = typeof credentials.email === 'string' ? credentials.email.trim().toLowerCase() : ''
      const password = typeof credentials.password === 'string' ? credentials.password : ''
      if (email.length > 254 || password.length > 128 || !email.includes('@') || !password) return null
      try {
        await rateLimit(`login:${email}`)
        await rateLimit(`login-ip:${request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'}`, 60)
      } catch { return null }
      const user = await prisma.user.findUnique({ where: { email } })
      const valid = await verifyPassword(password, user?.passwordHash ?? null)
      if (!user || !valid || user.suspendedAt || !user.emailVerified) return null
      return { id: user.id, email: user.email, name: user.name }
    },
  })],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false
      if (account?.provider === 'google' && profile?.email_verified !== true) return false
      const existing = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() }, select: { suspendedAt: true } })
      return !existing?.suspendedAt
    },
    async jwt({ token, user }) {
      if (user?.id) {
        await ensureAccountWorkspace(user.id)
        await prisma.emailContact.upsert({ where: { userId: user.id }, create: { userId: user.id, firstLoginAt: new Date() }, update: {} })
        await prisma.emailContact.updateMany({ where: { userId: user.id, firstLoginAt: null }, data: { firstLoginAt: new Date() } })
        token.sub = user.id
        token.sessionVersion = (await prisma.user.findUnique({ where: { id: user.id }, select: { sessionVersion: true } }))?.sessionVersion
      }
      return token
    },
    async session({ session, token }) {
      if (token.sub) {
        const user = await prisma.user.findUnique({ where: { id: token.sub }, select: { suspendedAt: true, sessionVersion: true } })
        session.user.id = user && !user.suspendedAt && user.sessionVersion === (token.sessionVersion ?? 0) ? token.sub : ''
      }
      return session
    },
  },
})
