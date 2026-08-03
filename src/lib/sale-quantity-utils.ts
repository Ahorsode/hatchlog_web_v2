export type EggSaleQuantityUnit = 'crate' | 'egg'

export const DEFAULT_EGGS_PER_CRATE = 30

export function saleQuantityInEggs(
  displayQuantity: number,
  unit: EggSaleQuantityUnit,
  eggsPerCrate = DEFAULT_EGGS_PER_CRATE,
) {
  if (displayQuantity <= 0) return 0
  return unit === 'crate' ? displayQuantity * eggsPerCrate : displayQuantity
}

export function saleUnitPriceForDisplay(
  catalogPricePerCrate: number,
  unit: EggSaleQuantityUnit,
  eggsPerCrate = DEFAULT_EGGS_PER_CRATE,
) {
  if (unit === 'crate') return catalogPricePerCrate
  return eggsPerCrate > 0 ? catalogPricePerCrate / eggsPerCrate : catalogPricePerCrate
}

export function saleUnitPricePerEgg(
  displayUnitPrice: number,
  unit: EggSaleQuantityUnit,
  eggsPerCrate = DEFAULT_EGGS_PER_CRATE,
) {
  if (unit === 'egg') return displayUnitPrice
  return eggsPerCrate > 0 ? displayUnitPrice / eggsPerCrate : displayUnitPrice
}

export type LineDiscountType = 'flat' | 'percent' | 'item'

/** Money value of free units given on top of paid quantity (not capped by line subtotal of paid qty alone). */
export function computeItemGiveawayDiscount(giveawayQty: number, unitPrice: number) {
  if (giveawayQty <= 0 || unitPrice <= 0) return 0
  return Math.max(0, giveawayQty * unitPrice)
}

/** Stock quantity leaving inventory = paid units + free giveaway units. */
export function saleQuantityWithGiveaway(paidQuantity: number, giveawayQuantity: number) {
  const paid = Math.max(0, paidQuantity)
  const free = Math.max(0, giveawayQuantity)
  return paid + free
}

export function computeLineDiscount(
  lineSubtotal: number,
  discountAmount: number,
  discountType: LineDiscountType = 'flat',
  unitPrice = 0,
) {
  if (discountType === 'item') {
    return computeItemGiveawayDiscount(discountAmount, unitPrice)
  }
  if (lineSubtotal <= 0) return 0
  if (discountType === 'percent') {
    return Math.min(lineSubtotal, Math.max(0, (lineSubtotal * discountAmount) / 100))
  }
  return Math.min(lineSubtotal, Math.max(0, discountAmount))
}

export function formatEggStockCrateLabel(eggsInStock: number, eggsPerCrate = DEFAULT_EGGS_PER_CRATE) {
  if (eggsInStock <= 0) return '0 crates'
  const crates = Math.floor(eggsInStock / eggsPerCrate)
  const remainder = eggsInStock % eggsPerCrate
  const crateLabel = crates === 1 ? 'crate' : 'crates'
  if (remainder === 0) return `${crates} ${crateLabel}`
  const eggLabel = remainder === 1 ? 'egg' : 'eggs'
  return `${crates} ${crateLabel} (+${remainder} ${eggLabel})`
}
