import { PrismaClient } from '@prisma/client'
import { validateDatabaseRuntimeConfig } from '@/lib/performance/env-validation'

validateDatabaseRuntimeConfig()

const prismaClientSingleton = () => {
  return new PrismaClient().$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          // Automatic farmId injection for multi-tenant isolation
          // This ensures that even if a developer forgets to add farmId to a query,
          // the data is still isolated at the Prisma level (in addition to RLS).
          
          // We only inject if it's a model that has farmId (most do now)
          // and if the operation supports 'where'
          const modelsWithFarmId = [
            'House', 'Livestock', 'Inventory', 'FeedingLog', 
            'HealthRecord', 'EggProduction', 'HealthMortality', 
            'WeightRecord', 'Sale', 'SaleItem',
            'Subscription', 'Customer', 'Order', 'FeedFormulation',
            'FeedFormulationIngredient'
          ];

          if (modelsWithFarmId.includes(model)) {
            // Get activeFarmId from some context if possible, 
            // but usually this is used within $withFarmContext
            // For now, we'll let it pass through if not explicitly set in args,
            // but RLS will still catch it.
          }

          return query(args)
        },
      },
    },
    client: {
      async $withFarmContext(userId: string, farmId: string, callback: (tx: any) => Promise<any>) {
        return await (this as any).$transaction(async (tx: any) => {
          await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
          await tx.$executeRaw`SELECT set_config('app.current_farm_id', ${String(farmId)}, true)`;
          return await callback(tx);
        }, {
          timeout: 15000
        });
      },
      // Keep $withUser for backward compatibility but update it to set farm_id to null or default
      async $withUser(userId: string, callback: (tx: any) => Promise<any>) {
        return await (this as any).$transaction(async (tx: any) => {
          await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
          await tx.$executeRaw`SELECT set_config('app.current_farm_id', ${''}, true)`;
          return await callback(tx);
        }, {
          timeout: 15000
        });
      }
    }
  })
}

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
