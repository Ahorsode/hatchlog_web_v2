export type FlockStatus = 'Active' | 'Sold' | 'Quarantined';
export type FlockBreed = 'Broiler' | 'Layer' | 'Breeder';

export interface Flock {
  id: string;
  breed: FlockBreed;
  quantity: number;
  hatchDate: string; // ISO string Date
  status: FlockStatus;
}

export interface FeedingLog {
  id: string;
  flockId: string;
  date: string; // ISO string Date
  feedType: string;
  amountConsumed: number; // in kg or lbs
}

export interface MortalityRecord {
  id: string;
  flockId: string;
  date: string; // ISO string Date
  count: number;
  reason: string;
}

export type Unit = 'kg' | 'bag' | 'ml' | 'head';

export interface ClimateLog {
  id: string;
  timestamp: string; // ISO string Date
  temperature: number; // in Celsius
  humidity: number; // as a percentage
  amoniaLevel: number; // ppm
}
