import { prisma } from '@awb/database'
const id = 'cmubk14iy00003dqh5uhqacl1'
prisma.project.findUnique({ where: { id }, include: { workspace: { include: { members: { include: { user: true } } } } } }).then((r) => {
  console.log(r?.slug, r?.previewHost, r?.workspace.members.map((m) => m.user.email))
  return prisma.$disconnect()
})
