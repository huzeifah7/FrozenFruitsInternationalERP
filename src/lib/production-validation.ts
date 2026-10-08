import { getPackagingWeight } from './utils';

export type ShippingMethod = 'truck' | 'container' | 'freight';
export type PalletType = 'international' | 'euro' | 'standard';

export interface BoxValidationRule {
  expectedBoxes: number | null;
  isExplicitlyDisallowed: boolean;
  standardWeight: number;
  packagingCategory: string;
  palletType: PalletType;
  shippingMethod: ShippingMethod;
}

export interface ProductionDiscrepancy {
  index: number;
  type: 'boxes' | 'disallowed' | 'gross' | 'net';
  message: string;
}

/**
 * Normalizes shipping method from order or user selection
 */
export function normalizeShippingMethod(rawMethod?: string): ShippingMethod {
  if (!rawMethod) return 'truck';
  const lower = rawMethod.toLowerCase().trim();
  if (lower.includes('freight') || lower.includes('air') || lower.includes('avion')) return 'freight';
  if (lower.includes('container') || lower.includes('sea') || lower.includes('maritime') || lower.includes('ship')) return 'container';
  return 'truck';
}

/**
 * Normalizes pallet type from order item or user selection
 */
export function normalizePalletType(rawType?: string): PalletType {
  if (!rawType) return 'international';
  const lower = rawType.toLowerCase().trim();
  if (lower.includes('euro')) return 'euro';
  if (lower.includes('standard')) return 'standard';
  return 'international';
}

/**
 * Categorizes packaging by weight and special type (e.g., axar, plastic)
 */
export function getPackagingCategory(packaging: any): {
  standardWeight: number;
  isAxar: boolean;
  isPlastic: boolean;
  categoryLabel: string;
} | null {
  if (!packaging) return null;

  let weight = getPackagingWeight(packaging) || 0;
  const nameStr = [
    packaging.name || '',
    packaging.displayName || '',
    packaging.description || '',
    typeof packaging === 'string' ? packaging : ''
  ].join(' ').toLowerCase();

  // If weight wasn't found through standard fields, check regex
  if (!weight) {
    if (nameStr.includes('4kg') || nameStr.includes('4 kg')) weight = 4;
    else if (nameStr.includes('10kg') || nameStr.includes('10 kg')) weight = 10;
    else if (nameStr.includes('14kg') || nameStr.includes('14 kg')) weight = 14;
    else if (nameStr.includes('16kg') || nameStr.includes('16 kg')) weight = 16;
  }

  // Normalize weight ranges
  if (weight >= 3.5 && weight <= 4.5) weight = 4;
  else if (weight >= 9 && weight <= 11) weight = 10;
  else if (weight >= 13 && weight <= 15) weight = 14;
  else if (weight >= 15.5 && weight <= 17) weight = 16;

  if (weight !== 4 && weight !== 10 && weight !== 14 && weight !== 16) {
    return null; // Not a covered packaging category in the validation matrix
  }

  const isAxar = nameStr.includes('axar');
  const isPlastic = nameStr.includes('plastic') || nameStr.includes('one way') || nameStr.includes('one-way');

  let categoryLabel = `${weight} kg`;
  if (weight === 10) {
    if (isAxar) categoryLabel = '10 kg axar';
    else if (isPlastic) categoryLabel = '10 kg one way plastic';
  }

  return {
    standardWeight: weight,
    isAxar,
    isPlastic,
    categoryLabel
  };
}

/**
 * Looks up the expected boxes and validation rule based on the spreadsheet matrix:
 * 
 * Truck:
 *  - 4 kg | international -> 220
 *  - 10 kg one way plastic | international -> 90
 *  - 10 kg axar | international -> 88
 *  - 10 kg (other) | international -> 90
 *  - 4 kg | standard -> [-]
 *  - 10 kg | standard -> [-]
 *  - 4 kg | Euro pallet -> 144
 *  - 10 kg | Euro pallet -> 80
 *  - 14 kg | international -> 64
 *  - 16 kg | international -> 56
 * 
 * Container:
 *  - 4 kg | international -> 240
 *  - 10 kg | international -> 100
 *  - 10 kg axar | international -> [-]
 *  - 4 kg | standard -> [-]
 *  - 10 kg | standard -> [-]
 *  - 4 kg | Euro pallet -> 176
 *  - 10 kg | Euro pallet -> 80
 *  - 14 kg | international -> [-]
 *  - 16 kg | international -> [-]
 * 
 * Freight:
 *  - 4 kg | international -> 130
 *  - 10 kg | international -> 50
 *  - 4 kg | standard -> [-]
 *  - 10 kg | standard -> [-]
 *  - 4 kg | Euro pallet -> 104
 *  - 10 kg | Euro pallet -> 40
 *  - 14 kg | international -> [-]
 *  - 16 kg | international -> [-]
 */
export function getBoxValidationRule(
  rawShippingMethod?: string,
  rawPalletType?: string,
  packaging?: any
): BoxValidationRule | null {
  const pkgInfo = getPackagingCategory(packaging);
  if (!pkgInfo) return null;

  const shippingMethod = normalizeShippingMethod(rawShippingMethod);
  const palletType = normalizePalletType(rawPalletType);
  const { standardWeight, isAxar, categoryLabel } = pkgInfo;

  let expectedBoxes: number | null = null;
  let isExplicitlyDisallowed = false;

  if (shippingMethod === 'truck') {
    if (palletType === 'international') {
      if (standardWeight === 4) expectedBoxes = 220;
      else if (standardWeight === 10) {
        expectedBoxes = isAxar ? 88 : 90;
      } else if (standardWeight === 14) expectedBoxes = 64;
      else if (standardWeight === 16) expectedBoxes = 56;
    } else if (palletType === 'euro') {
      if (standardWeight === 4) expectedBoxes = 144;
      else if (standardWeight === 10) expectedBoxes = 80;
      else if (standardWeight === 14 || standardWeight === 16) isExplicitlyDisallowed = true;
    } else if (palletType === 'standard') {
      isExplicitlyDisallowed = true;
    }
  } else if (shippingMethod === 'container') {
    if (palletType === 'international') {
      if (standardWeight === 4) expectedBoxes = 240;
      else if (standardWeight === 10) {
        if (isAxar) isExplicitlyDisallowed = true;
        else expectedBoxes = 100;
      } else if (standardWeight === 14 || standardWeight === 16) {
        isExplicitlyDisallowed = true;
      }
    } else if (palletType === 'euro') {
      if (standardWeight === 4) expectedBoxes = 176;
      else if (standardWeight === 10) expectedBoxes = 80;
      else if (standardWeight === 14 || standardWeight === 16) {
        isExplicitlyDisallowed = true;
      }
    } else if (palletType === 'standard') {
      isExplicitlyDisallowed = true;
    }
  } else if (shippingMethod === 'freight') {
    if (palletType === 'international') {
      if (standardWeight === 4) expectedBoxes = 130;
      else if (standardWeight === 10) expectedBoxes = 50;
      else if (standardWeight === 14 || standardWeight === 16) {
        isExplicitlyDisallowed = true;
      }
    } else if (palletType === 'euro') {
      if (standardWeight === 4) expectedBoxes = 104;
      else if (standardWeight === 10) expectedBoxes = 40;
      else if (standardWeight === 14 || standardWeight === 16) {
        isExplicitlyDisallowed = true;
      }
    } else if (palletType === 'standard') {
      isExplicitlyDisallowed = true;
    }
  }

  return {
    expectedBoxes,
    isExplicitlyDisallowed,
    standardWeight,
    packagingCategory: categoryLabel,
    palletType,
    shippingMethod,
  };
}

/**
 * Validates production output items against the expected box counts, gross weight, and net weight.
 */
export function validateProductionOutputItems(params: {
  palletisationType?: string;
  selectedOrder?: any;
  packaging?: any;
  tare?: number;
  items: Array<{
    productId?: string;
    caliber?: string;
    numberOfBoxes: number;
    grossWeight?: number;
    netWeight?: number;
  }>;
}): ProductionDiscrepancy[] {
  const { palletisationType, selectedOrder, packaging, tare, items } = params;

  // Validation applies when palletisationType is Final product or Finalised pallet
  // or when an order is selected
  const isFinalProduct = 
    palletisationType === 'Final product' || 
    palletisationType === 'Finalised pallet' ||
    Boolean(selectedOrder);

  if (!isFinalProduct) return [];

  const rawShippingMethod = selectedOrder?.shippingMethod;
  const issues: ProductionDiscrepancy[] = [];

  items.forEach((item, index) => {
    // Determine the pallet type for this item from the order
    const matchedOrderItem = selectedOrder?.items?.find((oi: any) => {
      if (oi.productId && item.productId && oi.productId === item.productId) {
        if (item.caliber && oi.caliber) return oi.caliber === item.caliber;
        return true;
      }
      return false;
    }) || selectedOrder?.items?.find((oi: any) => {
      return oi.packagingType === packaging?.id || oi.packagingType === packaging?.name;
    }) || selectedOrder?.items?.[0];

    const rawPalletType = matchedOrderItem?.palletType || selectedOrder?.palletType;

    const rule = getBoxValidationRule(rawShippingMethod, rawPalletType, packaging);
    if (!rule) return;

    const shippingLabel = rule.shippingMethod.toUpperCase();
    const palletLabel = rule.palletType === 'euro' ? 'Euro Pallet' : rule.palletType === 'standard' ? 'Standard Pallet' : 'International Pallet';

    if (rule.isExplicitlyDisallowed) {
      issues.push({
        index: index + 1,
        type: 'disallowed',
        message: `Line ${index + 1}: ${rule.packagingCategory} is not configured/supported for ${shippingLabel} with ${palletLabel}.`,
      });
      return;
    }

    const boxes = Number(item.numberOfBoxes) || 0;
    const gross = Number(item.grossWeight) || 0;
    const net = Number(item.netWeight) || 0;

    // Check box count
    if (rule.expectedBoxes !== null && boxes > 0 && boxes !== rule.expectedBoxes) {
      issues.push({
        index: index + 1,
        type: 'boxes',
        message: `Line ${index + 1}: Expected ${rule.expectedBoxes} boxes for ${rule.packagingCategory} (${shippingLabel}, ${palletLabel}), but entered ${boxes}.`,
      });
    }

    const targetBoxes = rule.expectedBoxes || boxes;
    const expectedNet = rule.standardWeight * targetBoxes;

    // Gross weight expectation
    let totalTare = 0;
    if (tare !== undefined && tare !== null && !isNaN(Number(tare)) && Number(tare) > 0) {
      const numTare = Number(tare);
      totalTare = numTare;
    } else {
      // Default tare estimate based on packaging weight & box count
      if (rule.standardWeight === 4) totalTare = 78;
      else if (rule.standardWeight === 10) totalTare = (targetBoxes >= 100 ? 60 : 52);
      else if (rule.standardWeight === 14) totalTare = 50;
      else if (rule.standardWeight === 16) totalTare = 50;
    }

    const expectedGross = expectedNet + totalTare;
    if (gross > 0 && expectedGross > 0 && gross < expectedGross) {
      issues.push({
        index: index + 1,
        type: 'gross',
        message: `Line ${index + 1}: Gross weight ${gross} kg is below expected theoretical minimum ${Math.round(expectedGross)} kg.`,
      });
    }

    // Net weight expectations
    if (expectedNet > 0) {
      if (net > 0 && net < expectedNet) {
        issues.push({
          index: index + 1,
          type: 'net',
          message: `Line ${index + 1}: Net weight ${net} kg is below expected theoretical minimum ${expectedNet} kg (${rule.standardWeight} kg × ${targetBoxes} boxes).`,
        });
      } else if (net > expectedNet + 9) {
        issues.push({
          index: index + 1,
          type: 'net',
          message: `Line ${index + 1}: Net weight ${net} kg exceeds expected maximum ${expectedNet + 9} kg.`,
        });
      }
    }
  });

  return issues;
}
