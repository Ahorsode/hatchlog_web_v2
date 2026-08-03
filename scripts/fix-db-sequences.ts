import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting database sequence synchronization...');

  try {
    // Focus on tables with Int IDs that might be out of sync
    const tables = ['farms', 'houses', 'flocks', 'batches', 'sales', 'expenses', 'mortality', 'feeding_logs'];

    for (const table of tables) {
      console.log(`📡 Checking table: ${table}...`);
      
      // Check if table exists first to avoid P2010
      const exists = await prisma.$queryRawUnsafe(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '${table}'
        );
      `) as any[];

      if (!exists[0].exists) {
        console.warn(`⚠️ Table "${table}" does not exist in schema "public". Skipping.`);
        continue;
      }

      console.log(`🔄 Syncing sequence for table: ${table}...`);
      try {
        const seqQuery = `
          SELECT setval(
            pg_get_serial_sequence('"${table}"', 'id'), 
            COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, 
            false
          );
        `;
        await prisma.$executeRawUnsafe(seqQuery);
        console.log(`✅ Table "${table}" sequence synchronized.`);
      } catch (err) {
        console.error(`❌ Failed to sync sequence for "${table}". It may not have an 'id' column or a sequence.`);
      }
    }

    console.log('✨ All sequences synchronized successfully!');
  } catch (error) {
    console.error('❌ Error synchronizing sequences:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
