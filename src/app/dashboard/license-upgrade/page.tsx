import { getAuthContext } from '@/lib/auth-utils'
import { getFarmSubscriptionStatus } from '@/lib/subscription-utils'
import LicenseUpgradeClient from './LicenseUpgradeClient'

export default async function LicenseUpgradePage() {
  const { activeFarmId } = await getAuthContext()
  const status = activeFarmId
    ? await getFarmSubscriptionStatus(activeFarmId)
    : null

  return (
    <LicenseUpgradeClient
      currentTier={status?.tier ?? 'STANDARD'}
      accessStatus={status?.status ?? 'trial'}
      remainingDays={status?.remainingDays ?? 30}
      periodEndsAt={status?.periodEndsAt ?? null}
      statusLoaded={Boolean(status)}
    />
  )
}
