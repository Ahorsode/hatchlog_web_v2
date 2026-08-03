'use server'

import prisma from '@/lib/db'
import { getAuthContext } from '@/lib/auth-utils'
import { LivestockType } from '@prisma/client'

export async function generateSocialPost() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  // Fetch last 7 days of production
  const sevenDaysAgo = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000)
  
  const [eggs, mortality, batches] = await Promise.all([
    prisma.eggProduction.aggregate({
      where: { farmId: activeFarmId, logDate: { gte: sevenDaysAgo } },
      _sum: { eggsCollected: true, unusableCount: true }
    }),
    prisma.healthMortality.aggregate({
      where: { farmId: activeFarmId, logDate: { gte: sevenDaysAgo }, type: 'DEAD' },
      _sum: { count: true }
    }),
    prisma.livestock.findMany({
      where: { farmId: activeFarmId, status: 'active' }
    })
  ])

  const totalEggs = eggs._sum.eggsCollected || 0
  const totalLoss = mortality._sum.count || 0
  const batchTypes = Array.from(new Set(batches.map(b => b.type)))

  const tips = [
    "Tip: High protein starter feed in the first 14 days is critical for skeletal development.",
    "Did you know? Proper ventilation reduces ammonia levels and improves respiratory health.",
    "Farmer Wisdom: Regular weight checks help detect early signs of nutritional deficiencies.",
    "Market Tip: Clean, graded eggs can fetch up to 15% higher market prices."
  ]

  const randomTip = tips[Math.floor(Math.random() * tips.length)]

  let postText = `🚜 Weekly Farm Update from our Agri-ERP! \n\n`
  postText += `Production Highlights:\n`
  postText += `🥚 ${totalEggs.toLocaleString()} Eggs Collected\n`
  if (totalLoss > 0) postText += `📉 Mortality Kept at ${totalLoss} animals\n`
  postText += `🌱 Managing ${batches.length} active flocks including ${batchTypes.join(', ')}\n\n`
  postText += `${randomTip}\n\n`
  postText += `#AgriERP #SustainableFarming #FarmManagement #Poultry`

  return { success: true, postText }
}
