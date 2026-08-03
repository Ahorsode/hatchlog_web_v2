import { getAuthContext } from '@/lib/auth-utils'
import { getDesktopLicenses } from '@/lib/actions/licenses'
import prisma from '@/lib/db'
import LicenseUpgradeClient from './LicenseUpgradeClient'

export default async function LicenseUpgradePage() {
  const { activeFarmId } = await getAuthContext()

  const [farm, deviceData] = await Promise.all([
    prisma.farm.findUnique({
      where: { id: activeFarmId! },
      select: { subscriptionTier: true },
    }),
    getDesktopLicenses(),
  ])

  return (
    <LicenseUpgradeClient
      currentTier={farm?.subscriptionTier ?? 'BASIC'}
      devices={deviceData.licenses}
    />
  )
}
