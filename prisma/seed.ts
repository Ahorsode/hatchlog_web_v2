import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const userId = 'seed_user_id'

  // 1. Create a User (Optional, but good for multi-tenancy)
  const user = await prisma.user.upsert({
    where: { id: userId },
    update: {
      email: 'seed@example.com',
      name: 'Seed User',
      role: 'OWNER'
    },
    create: {
      id: userId,
      email: 'seed@example.com',
      name: 'Seed User',
      role: 'OWNER'
    }
  })

  // 2. Create a Farm
  const farm = await prisma.farm.upsert({
    where: { id: 'seed_farm_1' },
    update: {},
    create: {
      id: 'seed_farm_1',
      name: 'Green Valley Poultry',
      location: '123 Farm Road, Rural County',
      capacity: 50000,
      userId
    },
  })

  // 3. Create two Houses
  const house1 = await prisma.house.upsert({
    where: { id: 'seed_house_1' },
    update: {},
    create: {
      id: 'seed_house_1',
      farmId: farm.id,
      name: 'H-01',
      capacity: 10000,
      currentTemperature: 28.5,
      currentHumidity: 65,
      userId
    },
  })

  const house2 = await prisma.house.upsert({
    where: { id: 'seed_house_2' },
    update: {},
    create: {
      id: 'seed_house_2',
      farmId: farm.id,
      name: 'H-02',
      capacity: 15000,
      currentTemperature: 27.8,
      currentHumidity: 62,
      userId
    },
  })

  // 4. Create a Broiler Batch
  const batch = await prisma.livestock.upsert({
    where: { id: 'seed_batch_1' },
    update: {},
    create: {
      id: 'seed_batch_1',
      houseId: house1.id,
      farmId: farm.id,
      batchName: 'Broiler Batch 1',
      type: 'POULTRY_BROILER',
      breedType: 'Broiler',
      initialCount: 5000,
      currentCount: 4950,
      arrivalDate: new Date('2026-03-01'),
      status: 'active',
      userId
    },
  })

  // 5. Create Feed Inventory
  await prisma.inventory.upsert({
    where: { id: 'seed_inventory_1' },
    update: {},
    create: {
      id: 'seed_inventory_1',
      farmId: farm.id,
      itemName: 'Starter Feed',
      category: 'feed',
      stockLevel: 1200.50,
      unit: 'kg',
      userId
    },
  })

  await prisma.inventory.upsert({
    where: { id: 'seed_inventory_2' },
    update: {},
    create: {
      id: 'seed_inventory_2',
      farmId: farm.id,
      itemName: 'Grower Feed',
      category: 'feed',
      stockLevel: 450.00,
      unit: 'kg',
      userId
    },
  })

  // 6. Add some logs
  await prisma.healthMortality.create({
    data: {
      batchId: batch.id,
      farmId: farm.id,
      count: 10,
      logDate: new Date(),
      userId
    }
  })

  console.log('Seeding completed.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
