'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

export default function UnauthorizedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams?.get('reason');

  const message = reason === 'inactive' 
    ? 'Your account is currently inactive. Please contact your administrator.'
    : 'You do not have permission to access this page.';

  return (
    <div className="min-h-[calc(100vh-64px)] w-full flex items-center justify-center bg-[#f3f3f3] p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-24 w-24 bg-rose-50 rounded-full flex items-center justify-center">
            <ShieldAlert className="h-12 w-12 text-rose-500" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-[#2e1d52] uppercase tracking-wider">Access Denied</h1>
          <p className="text-sm font-medium text-slate-500">{message}</p>
        </div>

        <div className="pt-4">
          <Button 
            onClick={() => router.push('/dashboard')}
            className="h-12 w-full bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl font-bold tracking-wide transition-all"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
