import { LivestockType } from '@prisma/client';

export function useLivestockStats() {
  const getAgeInDays = (hatchDate: string) => {
    const start = new Date(hatchDate).getTime();
    const now = new Date().getTime();
    return Math.floor((now - start) / (1000 * 60 * 60 * 24));
  };

  const formatAge = (hatchDate: string, type: LivestockType) => {
    const totalDays = getAgeInDays(hatchDate);
    
    if (type.startsWith('POULTRY')) {
      return `Day ${totalDays}`;
    }

    const months = Math.floor(totalDays / 30);
    const days = totalDays % 30;

    if (months === 0) return `${days} Days`;
    return `${months} Mon, ${days} Days`;
  };

  const getUnitBySpecies = (type: LivestockType) => {
    switch (type) {
      case 'CATTLE':
        return 'Tonnes';
      case 'POULTRY_BROILER':
      case 'POULTRY_LAYER':
      case 'PIG':
      case 'SHEEP_GOAT':
        return 'kg';
      default:
        return 'kg';
    }
  };

  const getProductionUnit = (type: LivestockType) => {
    if (type === 'POULTRY_LAYER') return 'Crates';
    return getUnitBySpecies(type);
  };

  const getMortalityPercentage = (totalDead: number, initialQuantity: number) => {
    if (initialQuantity <= 0) return 0;
    return (totalDead / initialQuantity) * 100;
  };

  const calculateFCR = (totalFeedWeight: number, totalLivestockWeight: number) => {
    if (totalLivestockWeight <= 0) return 0;
    return totalFeedWeight / totalLivestockWeight;
  };

  return {
    getAgeInDays,
    formatAge,
    getUnitBySpecies,
    getProductionUnit,
    getMortalityPercentage,
    calculateFCR,
  };
}
