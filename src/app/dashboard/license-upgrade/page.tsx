import { getAuthContext } from '@/lib/auth-utils'
import { getDesktopLicenses } from '@/lib/actions/licenses'
import { getFarm } from '@/lib/hatchlog-api'
import LicenseUpgradeClient from './LicenseUpgradeClient'

export default async function LicenseUpgradePage() {
  const { activeFarmId } = await getAuthContext()

  const [farm, deviceData] = await Promise.all([
    activeFarmId ? getFarm(activeFarmId).catch(() => null) as Promise<any> : Promise.resolve(null),
    getDesktopLicenses(),
  ])

  return (
    <LicenseUpgradeClient
      currentTier={farm?.subscriptionTier ?? 'BASIC'}
      devices={deviceData.licenses}
    />
  )
}
