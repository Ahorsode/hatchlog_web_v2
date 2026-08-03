import { LivestockType } from '@prisma/client';

export interface GrowthPerformance {
  days: number;
  currentWeight: number;
  targetWeight: number;
  weightGap: number;
  weightPerformance: number; // Percentage
  status: 'OPTIMAL' | 'DEVIATED' | 'CRITICAL';
}

/**
 * Calculates current growth performance versus a standard benchmark.
 */
export function calculateGrowthPerformance(
  hatchDate: Date | string,
  currentWeight: number,
  standards: Array<{ ageInDays: number, targetWeight: number }>
): GrowthPerformance | null {
  const birth = new Date(hatchDate);
  const now = new Date();
  const days = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));

  if (days < 0) return null;

  // Find the closest standard for this age
  const closestStandard = standards
    .sort((a, b) => Math.abs(a.ageInDays - days) - Math.abs(b.ageInDays - days))[0];

  if (!closestStandard) return null;

  const targetWeight = Number(closestStandard.targetWeight);
  const weightGap = currentWeight - targetWeight;
  const weightPerformance = (currentWeight / targetWeight) * 100;

  let status: GrowthPerformance['status'] = 'OPTIMAL';
  if (weightPerformance < 90) status = 'DEVIATED';
  if (weightPerformance < 80) status = 'CRITICAL';

  return {
    days,
    currentWeight,
    targetWeight,
    weightGap,
    weightPerformance,
    status
  };
}

/**
 * Normalizes livestock type names for display.
 */
export function formatLivestockType(type: LivestockType | string | null | undefined): string {
  if (!type) return 'Unknown';
  return String(type).replace(/_/g, ' ').toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}
/**
 * Returns the plural unit name for a livestock type.
 */
export function getLivestockUnit(type: LivestockType | string | null | undefined): string {
  if (!type) return 'units';
  const t = String(type);
  if (t === 'POULTRY_BROILER') return 'broilers';
  if (t === 'POULTRY_LAYER') return 'layers';
  if (t === 'CATTLE') return 'cattle';
  if (t === 'PIG') return 'pigs';
  if (t === 'SHEEP_GOAT') return 'sheep/goats';
  if (t.startsWith('POULTRY')) return 'birds';
  return 'head';
}
