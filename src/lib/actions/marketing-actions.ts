'use server'

import { getAuthContext } from '@/lib/auth-utils'
import { getDashboardStatsApi } from '@/lib/hatchlog-api'

export async function generateSocialPost() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  try {
    const stats = await getDashboardStatsApi(activeFarmId) as any

    const totalEggs = stats.todayEggs || stats.totalEggs || 0
    const totalLoss = stats.todayDead || 0
    const batchCount = stats.activeBatches?.length || 0
    const batchTypes = Array.from(
      new Set((stats.activeBatches || []).map((b: any) => b.type).filter(Boolean))
    )

    const tips = [
      'Tip: High protein starter feed in the first 14 days is critical for skeletal development.',
      'Did you know? Proper ventilation reduces ammonia levels and improves respiratory health.',
      'Farmer Wisdom: Regular weight checks help detect early signs of nutritional deficiencies.',
      'Market Tip: Clean, graded eggs can fetch up to 15% higher market prices.',
    ]

    const randomTip = tips[Math.floor(Math.random() * tips.length)]

    let postText = `🚜 Weekly Farm Update from our Agri-ERP! \n\n`
    postText += `Production Highlights:\n`
    postText += `🥚 ${totalEggs.toLocaleString()} Eggs Collected\n`
    if (totalLoss > 0) postText += `📉 Mortality Kept at ${totalLoss} animals\n`
    postText += `🌱 Managing ${batchCount} active flocks${batchTypes.length ? ` including ${batchTypes.join(', ')}` : ''}\n\n`
    postText += `${randomTip}\n\n`
    postText += `#AgriERP #SustainableFarming #FarmManagement #Poultry`

    return { success: true, postText }
  } catch (error: any) {
    console.error('Error generating social post:', error)
    return { success: false, error: error.message || 'Failed to generate post' }
  }
}
