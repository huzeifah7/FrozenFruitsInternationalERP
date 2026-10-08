'use client';

import { useAuthContext } from '@/components/auth-provider';
import { canList, canAdd, canUpdate, canDelete, hasPermission } from '@/lib/permissions';

export function usePermissions(moduleKey: string) {
  const { profile } = useAuthContext();
  return {
    profile,
    canList: canList(profile, moduleKey),
    canAdd: canAdd(profile, moduleKey),
    canUpdate: canUpdate(profile, moduleKey),
    canDelete: canDelete(profile, moduleKey),
    hasPermission: (action: 'list' | 'add' | 'update' | 'delete') => hasPermission(profile, moduleKey, action),
  };
}
