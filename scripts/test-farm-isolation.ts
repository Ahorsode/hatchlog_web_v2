import prisma from '../src/lib/db'

async function testIsolation() {
  console.log('--- Starting Farm-Isolation Test ---')

  try {
    // 0. Cleanup any previous failed runs
    console.log('Pre-test cleanup...')
    await prisma.livestock.deleteMany({ where: { farmId: { in: ['test-farm-1001', 'test-farm-1002'] } } })
    await prisma.house.deleteMany({ where: { farmId: { in: ['test-farm-1001', 'test-farm-1002'] } } })
    await prisma.farmMember.deleteMany({ where: { farmId: { in: ['test-farm-1001', 'test-farm-1002'] } } })
    await prisma.farm.deleteMany({ where: { id: { in: ['test-farm-1001', 'test-farm-1002'] } } })

    // 1. Create Test Users
    console.log('Creating users...')
    const userA = await prisma.user.upsert({
      where: { email: 'userA@test.com' },
      update: {},
      create: { email: 'userA@test.com', name: 'User A' }
    })
    const userB = await prisma.user.upsert({
      where: { email: 'userB@test.com' },
      update: {},
      create: { email: 'userB@test.com', name: 'User B' }
    })

    // 2. Create Test Farms
    console.log('Creating farms and memberships...')
    const farmA = await prisma.farm.create({
      data: { id: 'test-farm-1001', name: 'Farm A', userId: userA.id, capacity: 1000 }
    })
    await prisma.farmMember.create({
      data: { farmId: farmA.id, userId: userA.id, role: 'OWNER' }
    })

    const farmB = await prisma.farm.create({
      data: { id: 'test-farm-1002', name: 'Farm B', userId: userB.id, capacity: 2000 }
    })
    await prisma.farmMember.create({
      data: { farmId: farmB.id, userId: userB.id, role: 'OWNER' }
    })

    // 3. Create Houses
    console.log('Creating houses...')
    const houseA = await prisma.house.create({
      data: { 
        id: 'test-house-1001', 
        name: 'House A', 
        farmId: farmA.id, 
        userId: userA.id, 
        capacity: 1000 
      }
    })
    const houseB = await prisma.house.create({
      data: { 
        id: 'test-house-1002', 
        name: 'House B', 
        farmId: farmB.id, 
        userId: userB.id, 
        capacity: 2000 
      }
    })

    // 4. Add Data to Farm A using $withFarmContext
    console.log('Creating data in Farm A (under User A context)...')
    const batchA = await (prisma as any).$withFarmContext(userA.id, 'test-farm-1001', async (tx: any) => {
      return await tx.livestock.create({
        data: {
          farmId: farmA.id,
          userId: userA.id,
          houseId: houseA.id,
          batchName: 'Test Batch A',
          type: 'POULTRY_BROILER',
          breedType: 'Test Breed A',
          initialCount: 500,
          currentCount: 500,
          arrivalDate: new Date(),
          status: 'active'
        }
      })
    })
    console.log(`Created Batch A (ID: ${batchA.id}) in Farm A (ID: ${farmA.id})`)

    // 5. Test Isolation via RLS Session Variable using $withFarmContext
    console.log('\nTesting RLS Isolation...')
    
    console.log(`Setting session context for User B (Farm test-farm-1002)`)
    const visibleBatchesForB = await (prisma as any).$withFarmContext(userB.id, 'test-farm-1002', async (tx: any) => {
      return await tx.livestock.findMany()
    })
    
    console.log(`Found ${visibleBatchesForB.length} batches visible to User B.`)

    const foundAInB = visibleBatchesForB.some((b: any) => b.id === batchA.id)

    if (foundAInB) {
      console.error('❌ FAILURE: User B can see Farm A data via RLS!')
    } else {
      console.log('✅ SUCCESS: User B cannot see Farm A data via RLS.')
    }

    // 6. Cleanup
    console.log('\nCleaning up test data...')
    await prisma.livestock.deleteMany({ where: { farmId: { in: ['test-farm-1001', 'test-farm-1002'] } } })
    await prisma.house.deleteMany({ where: { farmId: { in: ['test-farm-1001', 'test-farm-1002'] } } })
    await prisma.farmMember.deleteMany({ where: { farmId: { in: ['test-farm-1001', 'test-farm-1002'] } } })
    await prisma.farm.deleteMany({ where: { id: { in: ['test-farm-1001', 'test-farm-1002'] } } })
    console.log('Cleanup completed.')

  } catch (error: any) {
    console.error('Test script failed with error:', error.message || error)
  } finally {
    await prisma.$disconnect()
  }
}

testIsolation()
