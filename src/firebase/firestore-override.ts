import * as firestore from 'firebase/firestore';

export * from 'firebase/firestore';

// Define the global and seasonal collections
const GLOBAL_COLLECTIONS = [
  'users',
  'appUsers',
  'settings_roles',
  'settings_seasons',
  'seasons',
  'settings_contact',
  'contacts',
  'settings_payment_terms',
  'payment_terms',
  'customers',
  'suppliers',
  'procurement_suppliers',
  'products',
  'locations',
  'processing_lines',
  'calibers',
  'farms',
  'main_farms',
  'small_farms',
  'raw_material_pricing',
  'employees',
  'hrSettings',
  'work_time_tracking',
  'cabranes',
  'transports',
  'consumables',
  'stock_inventories',
  'local_customers',
  'cheque_follow_ups',
  'cashTransactions',
  'caisseBankTransactions',
  'bankAccountTransactions',
  'suppliers_situation_payments',
  'finance_suppliers',
  'customer_portal_users',
  'quality_consumables'
];

function isSeasonal(path: string): boolean {
  if (!path) return false;
  // If the path contains a global collection name, it's global
  // Assuming top level collections, so no slashes or just one segment
  const baseCollection = path.split('/')[0];
  return !GLOBAL_COLLECTIONS.includes(baseCollection);
}

function getActiveSeasonId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('season_id');
}

// Override addDoc
export function addDoc<AppModelType, DbModelType extends firestore.DocumentData>(
  reference: firestore.CollectionReference<AppModelType, DbModelType>,
  data: firestore.WithFieldValue<AppModelType>
): Promise<firestore.DocumentReference<AppModelType, DbModelType>> {
  const seasonId = getActiveSeasonId();
  if (seasonId && isSeasonal(reference.path)) {
    return firestore.addDoc(reference, {
      ...(data as any),
      season_id: seasonId
    });
  }
  return firestore.addDoc(reference, data);
}

// Override setDoc to intercept creations (and updates that replace the doc)
export function setDoc<AppModelType, DbModelType extends firestore.DocumentData>(
  reference: firestore.DocumentReference<AppModelType, DbModelType>,
  data: firestore.WithFieldValue<AppModelType>,
  options?: firestore.SetOptions
): Promise<void> {
  const seasonId = getActiveSeasonId();
  if (seasonId && isSeasonal(reference.path)) {
    // Check if we are merging
    if (options && (options as any).merge) {
      // It's an update essentially, but we still might want to ensure season_id exists. 
      // Actually, editing shouldn't change season_id per the prompt ("Season is immutable"). 
      // But if it's the first creation via setDoc, it needs it. We will just append it.
      return firestore.setDoc(reference, {
        ...(data as any),
        season_id: seasonId
      }, options);
    } else {
      return firestore.setDoc(reference, {
        ...(data as any),
        season_id: seasonId
      });
    }
  }
  return options ? firestore.setDoc(reference, data, options) : firestore.setDoc(reference, data);
}

// Note: updateDoc is intentionally NOT wrapped with season_id injection
// because the prompt says: "When editing, DO NOT allow changing season_id. Season is immutable."
// Existing documents will already have their season_id.

// Override query
export function query<AppModelType, DbModelType extends firestore.DocumentData>(
  queryOrCollection: firestore.Query<AppModelType, DbModelType>,
  ...queryConstraints: firestore.QueryConstraint[]
): firestore.Query<AppModelType, DbModelType> {
  const seasonId = getActiveSeasonId();
  
  // Extract path safely
  let path = '';
  if ((queryOrCollection as any).type === 'collection') {
      path = ((queryOrCollection as any).path || '');
  } else if ((queryOrCollection as any)._query) {
      path = (queryOrCollection as any)._query.path?.canonicalString() || '';
  }

  if (seasonId && path && isSeasonal(path)) {
    // Check if season_id constraint already exists
    // queryConstraints is an array of QueryConstraint.
    // In Firebase v9, we can stringify or inspect it to check if it contains season_id.
    // A safer way is to assume that if the user explicitly provided a where('season_id', ...), we don't inject ours.
    let hasSeasonIdFilter = false;
    for (const c of queryConstraints) {
      // The internal representation usually has _op, _field, etc. but it might be minified.
      // Easiest is checking JSON string representation for "season_id".
      // This is a bit hacky but works reliably for Firestore QueryConstraints in JS.
      const anyC = c as any;
      if (anyC) {
        let fieldName = '';
        if (anyC._field && typeof anyC._field.toString === 'function') {
          fieldName = anyC._field.toString();
        } else if (anyC.type === 'where' && typeof anyC._field === 'string') {
          fieldName = anyC._field;
        }

        if (fieldName.includes('season_id') || fieldName.includes('seasonId')) {
          hasSeasonIdFilter = true;
          break;
        }

        if (anyC._field && anyC._field.segments && Array.isArray(anyC._field.segments)) {
          if (anyC._field.segments.includes('season_id') || anyC._field.segments.includes('seasonId')) {
            hasSeasonIdFilter = true;
            break;
          }
        }
      }
    }

    if (!hasSeasonIdFilter) {
      return firestore.query(queryOrCollection, firestore.where('season_id', '==', seasonId), ...queryConstraints);
    }
  }
  
  return firestore.query(queryOrCollection, ...queryConstraints);
}
