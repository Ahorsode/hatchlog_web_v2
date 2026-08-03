import { Flock, ClimateLog } from '@/types/poultry';

export const mockBatches: Flock[] = [
  { id: 'FLK-001', breed: 'Broiler', quantity: 15000, hatchDate: '2026-02-15T00:00:00Z', status: 'Active' },
  { id: 'FLK-002', breed: 'Layer', quantity: 5000, hatchDate: '2025-10-10T00:00:00Z', status: 'Active' },
  { id: 'FLK-003', breed: 'Broiler', quantity: 20000, hatchDate: '2026-03-01T00:00:00Z', status: 'Active' },
];

export const mockClimateLogs: ClimateLog[] = [
  { id: 'CLM-001', timestamp: '2026-03-15T14:45:00Z', temperature: 28.5, humidity: 65, amoniaLevel: 12 },
  { id: 'CLM-002', timestamp: '2026-03-15T14:50:00Z', temperature: 28.7, humidity: 66, amoniaLevel: 14 },
];

export const getHealthStatus = (id: string) => {
  if (id === 'FLK-002') return 'Warning';
  if (id === 'FLK-003') return 'Critical';
  return 'Healthy';
}
