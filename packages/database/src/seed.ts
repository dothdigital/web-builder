import { config as loadEnv } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { CollectionType, WorkspaceRole } from '../generated/client/enums'

loadEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) })
loadEnv()

const { prisma } = await import('./index')

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    create: { email: 'demo@example.com', name: 'Demo User' },
    update: {},
  })

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo-studio' },
    create: {
      name: 'Demo Studio',
      slug: 'demo-studio',
      members: { create: { userId: user.id, role: WorkspaceRole.OWNER } },
    },
    update: {},
  })

  const project = await prisma.project.upsert({
    where: { workspaceId_slug: { workspaceId: workspace.id, slug: 'northside-salon' } },
    create: {
      workspaceId: workspace.id,
      name: 'Northside Salon',
      slug: 'northside-salon',
      previewHost: 'northside-salon.preview.local',
      businessProfile: {
        create: {
          displayName: 'Northside Salon',
          description:
            'An independent hair salon focused on precision cutting, considered colour and unhurried appointments for a small number of clients each day.',
          industry: 'Hair salon',
          city: 'Mississauga',
          region: 'Ontario',
          email: 'hello@northsidesalon.example',
          phone: '+1 905 555 0142',
          tone: 'warm, premium, unhurried',
          primaryConversion: 'BOOKING_URL',
          missingFacts: [],
        },
      },
    },
    update: {},
  })

  const existingServices = await prisma.collection.findUnique({
    where: { projectId_type: { projectId: project.id, type: CollectionType.SERVICES } },
  })

  if (!existingServices) {
    await prisma.collection.create({
      data: {
        projectId: project.id,
        type: CollectionType.SERVICES,
        name: 'Services',
        items: {
          create: [
            { position: 0, data: { title: 'Precision cutting' } },
            { position: 1, data: { title: 'Colour and balayage' } },
            { position: 2, data: { title: 'Bridal and events' } },
          ],
        },
      },
    })
  }

  console.log(`Seeded workspace ${workspace.slug} with project ${project.slug} for ${user.email}`)
}

await main()
await prisma.$disconnect()
