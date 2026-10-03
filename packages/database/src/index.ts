import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/client/client'

export * from '../generated/client/client'
export * from '../generated/client/enums'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaConstructor: typeof PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.')
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

// Hot reload must not keep a client created from an older generated schema.
// Reuse the connection pool only while the generated client constructor matches.
export const prisma: PrismaClient = globalForPrisma.prisma && globalForPrisma.prismaConstructor === PrismaClient
  ? globalForPrisma.prisma
  : createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaConstructor = PrismaClient
}
