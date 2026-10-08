'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthContext } from '@/components/auth-provider';
import { permissionsRegistry, hasPermission, isAdmin } from '@/lib/permissions';
import { Loader2 } from 'lucide-react';

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading, user } = useAuthContext();
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    // Check inactive
    if (profile?.status === 'Inactive') {
      router.push('/unauthorized?reason=inactive');
      return;
    }

    if (!pathname) {
      setIsAuthorized(true);
      return;
    }

    // Let dashboard home, profile routes, and unauthorized page pass
    if (pathname === '/' || pathname.startsWith('/profile') || pathname === '/unauthorized') {
      setIsAuthorized(true);
      return;
    }

    // Find which module this route belongs to. We check which module's basePath matches the start of the pathname.
    // Sort by length descending so deeper paths match first.
    const sortedModules = [...permissionsRegistry].sort((a, b) => b.basePath.length - a.basePath.length);
    const matchedModule = sortedModules.find(m => pathname.startsWith(m.basePath));

    if (!matchedModule) {
      // If we don't know this module, we might block it, or let it pass if it's an unlisted route. 
      // For strict RBAC, block it if it's in protected layout.
      console.warn(`Route ${pathname} not found in permissions registry. Defaulting to deny.`);
      router.push('/unauthorized');
      return;
    }

    // Determine the required action based on the path
    let requiredAction: 'list' | 'add' | 'update' | 'delete' = 'list';
    
    if (pathname.includes('/add') || pathname.includes('/create')) {
      requiredAction = 'add';
    } else if (pathname.includes('/edit') || pathname.includes('/update')) {
      requiredAction = 'update';
    }
    // Delete actions are typically buttons, not pages, but just in case:
    else if (pathname.includes('/delete')) {
      requiredAction = 'delete';
    }

    const hasAccess = hasPermission(profile, matchedModule.moduleKey, requiredAction);

    if (!hasAccess) {
      router.push('/unauthorized');
      return;
    }

    setIsAuthorized(true);
  }, [loading, user, profile, pathname, router]);

  if (loading || !isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] w-full">
        <Loader2 className="h-10 w-10 text-[#193A7B] animate-spin mb-4" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Checking permissions...</p>
      </div>
    );
  }

  return <>{children}</>;
}
