import { PackSize } from '../types/database'

export function formatQuantityDisplay(
  quantity: number, 
  packSizeDetails?: PackSize | null,
  numberFormatter: (num: number) => string = (num) => num.toString(),
  showBothWhenSame: boolean = false
): string {
  const formatNum = numberFormatter
  
  if (!packSizeDetails?.uom_per_each || !packSizeDetails?.units_of_units) {
    return `${formatNum(quantity)} EA`
  }

  const volume = quantity * packSizeDetails.uom_per_each
  
  // If volume and quantity are the same and we don't want to show both, just show EA
  if (!showBothWhenSame && volume === quantity) {
    return `${formatNum(quantity)} EA`
  }

  return `${formatNum(volume)} ${packSizeDetails.units_of_units} (${formatNum(quantity)} EA)`
}

export function formatPackSizeDisplay(packSizeDetails?: PackSize | null): string {
  if (!packSizeDetails) return 'N/A'
  
  let display = packSizeDetails.pack_size
  if (packSizeDetails.uom_per_each && packSizeDetails.units_of_units) {
    display += ` (${packSizeDetails.uom_per_each} ${packSizeDetails.units_of_units}/EA)`
  }
  return display
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString()
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString()
}

export function formatNumber(value: number): string {
  return value.toLocaleString()
}