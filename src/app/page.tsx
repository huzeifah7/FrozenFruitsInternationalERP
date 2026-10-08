
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/components/auth-provider';
import { canList } from '@/lib/permissions';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();
  const { profile, loading } = useAuthContext();

  useEffect(() => {
    if (loading) return;
    
    if (canList(profile, 'dashboard')) {
      router.push('/overview');
    } else {
      router.push('/profile');
    }
  }, [loading, profile, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-background">
      <Loader2 className="h-10 w-10 text-[#193A7B] animate-spin mb-4" />
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Redirecting...</p>
    </div>
  );
}
