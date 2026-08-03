/** UI-only chart/priority shapes for the executive dashboard. */

export type StrategicPriority = {
  title: string
  detail: string
  type: 'finance' | 'stock' | 'performance'
}

export type RevenueVelocityPoint = {
  date: string
  revenue: number
  target: number
}
