import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getProductPriority(name: string): number {
  const lower = (name || '').toLowerCase();
  if (lower.includes('avocado')) return 1;
  if (lower.includes('blueberry')) return 2;
  if (lower.includes('pomegranate')) return 3;
  return 99;
}

export function sortProducts<T extends { productName?: string; category?: string; type?: string; name?: string }>(productsList: T[]): T[] {
  if (!productsList) return [];
  return [...productsList].sort((a, b) => {
    const nameA = a.productName || a.name || '';
    const nameB = b.productName || b.name || '';
    const prioA = getProductPriority(nameA);
    const prioB = getProductPriority(nameB);
    if (prioA !== prioB) {
      return prioA - prioB;
    }
    const compProduct = nameA.localeCompare(nameB);
    if (compProduct !== 0) return compProduct;

    const catA = a.category || '';
    const catB = b.category || '';
    const compCat = catA.localeCompare(catB);
    if (compCat !== 0) return compCat;

    const typeA = a.type || '';
    const typeB = b.type || '';
    return typeA.localeCompare(typeB);
  });
}

export function sortProductFamilies(families: string[]): string[] {
  if (!families) return [];
  return [...families].sort((a, b) => {
    const prioA = getProductPriority(a);
    const prioB = getProductPriority(b);
    if (prioA !== prioB) {
      return prioA - prioB;
    }
    return a.localeCompare(b);
  });
}

export async function getBase64ImageFromUrl(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Failed to get canvas context'));
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (error) => reject(error);
    img.src = imageUrl;
  });
}

export function normalizePackagingName(name: any): string {
  if (name === null || name === undefined) return '';
  let normalized = String(name).trim().toLowerCase();
  // Remove accents
  normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Replace multiple spaces with one space
  normalized = normalized.replace(/\s+/g, ' ');
  // Normalize "kg", "KG", "Kg" to "kg" and remove space before it (e.g., "4 kg" -> "4kg")
  normalized = normalized.replace(/\b(\d+)\s*kg\b/g, '$1kg');
  // General replacement of "kg" to lowercase "kg" just in case
  normalized = normalized.replace(/kg/g, 'kg');
  return normalized;
}

export function getProductionPackagingOptions(orderPackagingName: string, consumables: any[]): any[] {
  if (!orderPackagingName || !consumables) return [];

  // Map input consumables to standard option structure if not already mapped
  const mappedOptions = consumables.map(c => {
    if (c.id && c.name !== undefined && c.displayName !== undefined && c.standardWeight !== undefined) {
      return c;
    }
    return {
      id: c.id,
      name: c.name || c.consumableName || '',
      displayName: `${c.name || c.consumableName || ''} - ${c.weight_per_unit || c.standardWeightPerUnitKg || c.standardWeight || c.weight || ''}kg`,
      standardWeight: Number(c.weight_per_unit || c.standardWeightPerUnitKg || c.standardWeight || c.weight) || 0
    };
  });

  const normOrder = normalizePackagingName(orderPackagingName);

  // Rule 1: Carton 4kg Mavocado (resilient to database values like "Mavocado ")
  if (normOrder.includes("mavocado")) {
    return mappedOptions.filter(opt => {
      const normOpt = normalizePackagingName(opt.name);
      return normOpt.includes("mavocado") && (opt.standardWeight === 4 || normOpt.includes("4kg"));
    });
  }

  // Rule 2: Carton Noir (resilient to database values like "Carton Noir ", "carton 10kg black")
  if (normOrder.includes("noir") || normOrder.includes("black")) {
    const is10kg = normOrder.includes("10kg");
    return mappedOptions.filter(opt => {
      const normOpt = normalizePackagingName(opt.name);
      const optIs10kg = opt.standardWeight === 10 || normOpt.includes("10kg");
      if (is10kg) {
        return (normOpt.includes("noir") || normOpt.includes("black")) && optIs10kg;
      } else {
        return (normOpt.includes("noir") || normOpt.includes("black")) && !optIs10kg;
      }
    });
  }

  // Rule 3, 4, 5: Plastic 10kg, 14kg, 16kg
  if (normOrder.includes("plastic")) {
    let targetWeight = 10;
    if (normOrder.includes("14kg")) targetWeight = 14;
    else if (normOrder.includes("16kg")) targetWeight = 16;

    return mappedOptions.filter(opt => {
      const normOpt = normalizePackagingName(opt.name);
      return normOpt.includes("plastic") && (opt.standardWeight === targetWeight || normOpt.includes(`${targetWeight}kg`));
    });
  }

  // Rule 6: Wooden Boxes
  if (normOrder.includes("wooden")) {
    return mappedOptions.filter(opt => {
      const normOpt = normalizePackagingName(opt.name);
      return normOpt.includes("wooden");
    });
  }

  // Rule 7: Carton 10kg Lidl / Carton 4kg Lidl
  if (normOrder.includes("lidl")) {
    const is10kg = normOrder.includes("10kg");
    return mappedOptions.filter(opt => {
      const normOpt = normalizePackagingName(opt.name);
      const optIs10kg = opt.standardWeight === 10 || normOpt.includes("10kg");
      if (is10kg) {
        return normOpt.includes("lidl") && optIs10kg;
      } else {
        return normOpt.includes("lidl") && !optIs10kg;
      }
    });
  }

  // Rule 8: Carton 4kg customized
  if (normOrder.includes("customized")) {
    return mappedOptions.filter(opt => {
      const normOpt = normalizePackagingName(opt.name);
      const is4kg = opt.standardWeight === 4 || normOpt.includes("4kg");
      return (
        is4kg &&
        !normOpt.includes("mavocado") &&
        !normOpt.includes("noir")
      );
    });
  }

  // Advanced fallback matching
  const exactMatches = mappedOptions.filter(opt => {
    const normName = normalizePackagingName(opt.name);
    if (normName === normOrder) return true;
    
    if (opt.standardWeight > 0) {
      if (`${normName} ${opt.standardWeight}kg` === normOrder) return true;
      if (`${normName}${opt.standardWeight}kg` === normOrder) return true;
    }

    const orderWithoutWeight = normOrder.replace(/\b\d+kg\b/g, '').trim();
    if (orderWithoutWeight && normName === orderWithoutWeight) {
      const orderWeightMatch = normOrder.match(/(\d+)kg/);
      if (orderWeightMatch && opt.standardWeight > 0) {
        return Number(orderWeightMatch[1]) === opt.standardWeight;
      }
      return true;
    }

    return false;
  });
  return exactMatches;
}

export function extractWeightFromPackaging(name: string): number | null {
  if (!name) return null;
  const match = name.match(/\b(\d+(?:\.\d+)?)\s*kg\b/i);
  if (match) {
    const num = parseFloat(match[1]);
    if (!isNaN(num)) return num;
  }
  return null;
}

export function getPackagingWeight(packaging: any): number | null {
  if (!packaging) return null;
  
  if (typeof packaging === 'string') {
    return extractWeightFromPackaging(packaging);
  }

  const weightFields = [
    'standardWeightPerUnitKg',
    'standard_weight_per_unit_kg',
    'standardWeight',
    'weightPerUnit',
    'weight',
    'weight_per_unit'
  ];

  for (const field of weightFields) {
    if (packaging[field] !== undefined && packaging[field] !== null) {
      const val = Number(packaging[field]);
      if (!isNaN(val) && val > 0) {
        return val;
      }
    }
  }

  const nameFields = ['displayName', 'name', 'consumableName', 'packagingTypeName'];
  for (const field of nameFields) {
    if (packaging[field] && typeof packaging[field] === 'string') {
      const weight = extractWeightFromPackaging(packaging[field]);
      if (weight !== null) return weight;
    }
  }

  return null;
}

// Trigger HMR to resolve Turbopack caching issue

/**
 * Recursively cleans object properties by removing `undefined` values,
 * which Firestore JS SDK rejects with "Unsupported field value: undefined".
 * Preserves Date, File, Timestamps, and Firestore FieldValue instances.
 */
export function sanitizeForFirestore<T = any>(obj: T): T {
  if (obj === undefined) return null as any;
  if (obj === null || typeof obj !== 'object') return obj;
  if (
    obj instanceof Date ||
    (typeof File !== 'undefined' && obj instanceof File) ||
    typeof (obj as any).toMillis === 'function' ||
    typeof (obj as any).isEqual === 'function' ||
    ((obj as any)._methodName && typeof (obj as any)._methodName === 'string') ||
    (obj as any).constructor?.name === 'FieldValue'
  ) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item)) as any;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean as T;
}
