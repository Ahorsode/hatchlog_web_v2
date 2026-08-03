'use server'

import prisma from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'

export async function getInsertLogs() {
  const { role, activeFarmId } = await getAuthContext()
  if (!activeFarmId || (role !== 'OWNER' && role !== 'MANAGER')) return []

  return await prisma.insertLog.findMany({
    where: { farmId: activeFarmId },
    include: {
      user: {
        select: {
          firstname: true,
          surname: true,
          role: true
        }
      }
    },
    orderBy: { insertedAt: 'desc' },
    take: 100
  })
}

export async function getDeleteLogs() {
  const { role, activeFarmId } = await getAuthContext()
  if (!activeFarmId || (role !== 'OWNER' && role !== 'MANAGER')) return []

  return await prisma.deleteLog.findMany({
    where: { farmId: activeFarmId },
    include: {
      user: {
        select: {
          firstname: true,
          surname: true,
          role: true
        }
      }
    },
    orderBy: { deletedAt: 'desc' },
    take: 100
  })
}

export async function getEditLogs() {
  const { role, activeFarmId } = await getAuthContext()
  if (!activeFarmId || (role !== 'OWNER' && role !== 'MANAGER')) return []

  return await prisma.auditLog.findMany({
    where: { farmId: activeFarmId },
    include: {
      user: {
        select: {
          firstname: true,
          surname: true,
          role: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  })
}

const TABLE_TO_MODEL: Record<string, string> = {
  'batches': 'livestock',
  'sales': 'sale',
  'expenses': 'expense',
  'inventory': 'inventory',
  'daily_feeding_logs': 'feedingLog',
  'egg_production': 'eggProduction',
  'mortality': 'mortality',
  'weight_records': 'weightRecord',
  'houses': 'house',
  'customers': 'customer',
  'farm_members': 'farmMember',
  'invitations': 'invitation',
}

export async function restoreDeletedRecord(logId: string) {
  const { userId, role, activeFarmId } = await getAuthContext()
  if (!activeFarmId || role !== 'OWNER') {
    return { success: false, error: 'Unauthorized: Only Owners can restore data' }
  }

  try {
    const log = await prisma.deleteLog.findUnique({
      where: { id: logId, farmId: activeFarmId }
    })

    if (!log) return { success: false, error: 'Log entry not found' }

    // Resolve model name from table name
    const normalizedTableName = log.tableName.toLowerCase()
    const modelName = TABLE_TO_MODEL[normalizedTableName] || normalizedTableName
    if (!(prisma as any)[modelName]) {
      return { success: false, error: `Invalid target table for restoration: ${log.tableName}` }
    }

    // Parse CSV data
    const rows = log.deletedDataCsv.split('\n')
    if (rows.length < 2) return { success: false, error: 'Invalid log data format' }

    const headers = rows[0].split('|')
    const values = rows[1].split('|')

    // Map common snake_case DB columns to camelCase Prisma model field names
    const headerMap: Record<string, string> = {
      'farm_id': 'farmId',
      'user_id': 'userId',
      'house_id': 'houseId',
      'batch_id': 'batchId',
      'category_id': 'categoryId',
      'created_at': 'createdAt',
      'updated_at': 'updatedAt',
      'arrival_date': 'arrivalDate',
      'log_date': 'logDate',
      'initial_count': 'initialCount',
      'current_count': 'currentCount',
      'isolation_count': 'isolationCount',
      'death_count': 'deathCount',
      'eggs_collected': 'eggsCollected',
      'bad_eggs': 'badEggs',
      'feed_consumed': 'feedConsumed',
      'unit_price': 'unitPrice',
      'total_amount': 'totalAmount',
      'local_batch_id': 'localBatchId',
    }

    const record: any = {}
    headers.forEach((header: string, i: number) => {
      const cleanHeader = header.trim().replace(/^"|"$/g, '')
      const propertyName = headerMap[cleanHeader] || cleanHeader
      
      let val: any = values[i] ? values[i].trim() : null
      
      if (val) {
        // Strip both single and double quotes and unescape
        val = val.replace(/^['"]|['"]$/g, '').replace(/''/g, "'").replace(/""/g, '"')
      }

      if (val === 'NULL' || val === '' || val === 'null' || val === null) {
        val = null
      } else if (val === 'true') {
        val = true
      } else if (val === 'false') {
        val = false
      } else if (!isNaN(Number(val)) && val !== '' && !val.includes('-') && !val.includes(':')) {
        // Numeric value
        val = Number(val)
      } else if (val && (val.includes('-') || val.includes(':')) && !isNaN(Date.parse(val))) {
        // Likely a date
        val = new Date(val)
      }
      
      record[propertyName] = val
    })

    // Remove ID and metadata to let DB generate fresh ones
    const { id, createdAt, updatedAt, deletedAt, ...dataToRestore } = record

    // Ensure context matches current session
    dataToRestore.farmId = activeFarmId
    
    // Perform restoration in farm context
    await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
      if (!tx[modelName]) {
        throw new Error(`Model ${modelName} not found in transaction context`)
      }
      
      // Recreate the deleted record
      await tx[modelName].create({
        data: dataToRestore
      })

      // Remove the log from the Recovery Vault to prevent duplicate restorations
      await tx.deleteLog.delete({
        where: { id: logId }
      })
    })

    revalidatePath('/dashboard/admin/logs')
    revalidatePath('/dashboard', 'layout')
    
    return { success: true, message: `Successfully restored record to ${log.tableName}` }
  } catch (error: any) {
    console.error('Restoration error:', error)
    return { success: false, error: `Failed to restore: ${error.message}` }
  }
}
