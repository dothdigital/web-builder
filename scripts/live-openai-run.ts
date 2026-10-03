import { randomUUID } from 'node:crypto'
import { prisma } from '@awb/database'
import { runGeneration } from '@awb/pipeline'

const description = `Your one-stop rehab clinic in Derry West Village, Mississauga for Physiotherapy and Massage Therapy services.

Our Mississauga physiotherapy clinic, Procare Physio Clinic, is equipped with the latest state-of-the-art facilities and located conveniently in Derry West Village. We pride ourselves on offering a highly personable, relaxed, and encouraging treatment approach.

We offer thorough assessments tailored to each individual's needs, utilizing an evidence-based approach. By spending more time with each client during treatment sessions, our approach helps clients return to their daily routines more quickly.`

async function main(): Promise<void> {
  const workspace = await prisma.workspace.findFirstOrThrow()
  const slug = `procare-live-${randomUUID().slice(0, 6)}`

  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: 'Procare Physio and Rehab',
      slug,
      previewHost: `${slug}.preview.local`,
      businessProfile: {
        create: {
          displayName: 'Procare Physio and Rehab',
          description,
          industry: 'Physiotherapy clinic',
          city: 'Mississauga',
          region: 'Ontario',
          primaryConversion: 'BOOKING_URL',
          tone: 'warm, professional',
          missingFacts: [],
        },
      },
      collections: {
        create: {
          type: 'SERVICES',
          name: 'Services',
          items: {
            create: [
              { position: 0, data: { title: 'Physiotherapy' } },
              { position: 1, data: { title: 'Massage Therapy' } },
              { position: 2, data: { title: 'Pre & post-natal care' } },
            ],
          },
        },
      },
    },
  })

  console.log('project', project.id)

  const started = Date.now()
  const result = await runGeneration({ projectId: project.id })

  console.log('finished in', Math.round((Date.now() - started) / 1000), 's', result)

  const jobs = await prisma.generationJob.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'asc' },
  })

  for (const job of jobs) {
    console.log(job.stage, job.status, job.model ?? '-', job.errorMessage ?? '')
  }

  const assets = await prisma.asset.findMany({ where: { projectId: project.id } })
  for (const asset of assets) {
    console.log('asset', asset.source, asset.mimeType, asset.bytes, asset.url)
  }

  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
