import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const workers = await prisma.user.findMany({
    where: { role: 'WORKER' }
  })

  console.log(`Found ${workers.length} workers to backfill.`)

  for (const worker of workers) {
    const memberships = await prisma.farmMember.findMany({
      where: { userId: worker.id }
    })

    for (const membership of memberships) {
      await prisma.userPermission.upsert({
        where: {
          userId_farmId: {
            userId: worker.id,
            farmId: membership.farmId
          }
        },
        update: {},
        create: {
          userId: worker.id,
          farmId: membership.farmId,
          canViewFinance: true,
          canEditFinance: false,
          canViewInventory: true,
          canEditInventory: false,
          canViewBatches: true,
          canEditBatches: false,
        }
      })
      console.log(`Updated permissions for worker ${worker.id} on farm ${membership.farmId}`)
    }
  }

  console.log('Backfill complete.')
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
