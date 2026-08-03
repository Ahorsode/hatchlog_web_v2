const { PrismaClient } = require('@prisma/client');

async function applyRLS() {
  const prisma = new PrismaClient();
  
  const statements = [
    // Helper function to get current user ID
    `CREATE OR REPLACE FUNCTION current_app_user() RETURNS text AS $$
      SELECT current_setting('app.current_user_id', true);
    $$ LANGUAGE sql STABLE;`,

    // Helper function to get current farm ID
    `CREATE OR REPLACE FUNCTION current_app_farm() RETURNS integer AS $$
      SELECT NULLIF(current_setting('app.current_farm_id', true), '')::integer;
    $$ LANGUAGE sql STABLE;`,

    // Farm: Users can see farms they belong to
    `DROP POLICY IF EXISTS farm_isolation_policy ON "farms"`,
    `CREATE POLICY farm_isolation_policy ON "farms" 
     FOR ALL USING (
       "userId" = current_app_user() OR
       EXISTS (
         SELECT 1 FROM "farm_members" fm 
         WHERE fm."farmId" = "farms".id AND fm."userId" = current_app_user()
       )
     )`,

    // Farm Members: Users can see members of farms they belong to
    `DROP POLICY IF EXISTS member_isolation_policy ON "farm_members"`,
    `CREATE POLICY member_isolation_policy ON "farm_members"
     FOR ALL USING (
       "farmId" IN (
         SELECT f.id FROM "farms" f WHERE f."userId" = current_app_user()
         UNION
         SELECT fm."farmId" FROM "farm_members" fm WHERE fm."userId" = current_app_user()
       )
     )`,

    // Generic Policy for all data tables that have farmId
    ...[
      ['houses', 'house_isolation_policy'],
      ['batches', 'batch_isolation_policy'],
      ['inventory', 'inventory_isolation_policy'],
      ['daily_feeding_logs', 'feeding_isolation_policy'],
      ['health_records', 'health_isolation_policy'],
      ['egg_production', 'egg_production_isolation_policy'],
      ['mortality', 'mortality_isolation_policy'],
      ['weight_records', 'weight_isolation_policy'],
      ['sales', 'sales_isolation_policy'],
      ['sale_items', 'sale_items_isolation_policy'],
      ['vaccination_schedules', 'vaccination_isolation_policy'],
      ['medication_schedules', 'medication_isolation_policy'],
      ['expenses', 'expenses_isolation_policy']
    ].map(([table, policy]) => [
      `DROP POLICY IF EXISTS ${policy} ON "${table}"`,
      `CREATE POLICY ${policy} ON "${table}" 
       FOR ALL USING (
         "farmId" = current_app_farm() OR
         "farmId" IN (
           SELECT fm."farmId" FROM "farm_members" fm WHERE fm."userId" = current_app_user()
           UNION
           SELECT f.id FROM "farms" f WHERE f."userId" = current_app_user()
         )
       )`
    ]).flat()
  ];

  console.log('Applying RLS policies for Farm-Isolation...');

  for (const sql of statements) {
    try {
      console.log(`Executing: ${sql.substring(0, 70)}...`);
      await prisma.$executeRawUnsafe(sql);
    } catch (error) {
      console.error(`Error executing statement: ${sql.substring(0, 70)}...`);
      console.error(error.message);
    }
  }

  await prisma.$disconnect();
  console.log('RLS application process finished.');
}

applyRLS();
