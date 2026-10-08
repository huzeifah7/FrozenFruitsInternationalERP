'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc } from '@/firebase/firestore-override';
import { useFirestore } from '@/firebase';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, CalendarRange, Clock, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ViewSeasonPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const db = useFirestore();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<any>(null);

  useEffect(() => {
    if (!db || !id) return;
    const fetchDoc = async () => {
      try {
        const snap = await getDoc(doc(db, 'seasons', id));
        if (snap.exists()) {
          setSeason({ id: snap.id, ...snap.data() });
        } else {
          toast({ title: 'Error', description: 'Season not found.', variant: 'destructive' });
          router.push('/settings/seasons');
        }
      } catch (err) {
        console.error('Error fetching season:', err);
        toast({ title: 'Error', description: 'Failed to fetch season details.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [db, id, router, toast]);

  const breadcrumbItems = [
    { label: 'Profile', href: '/settings/seasons' },
    { label: 'Seasons', href: '/settings/seasons' },
    { label: 'View Season', active: true }
  ];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f3f3f3]">
        <Loader2 className="h-8 w-8 animate-spin text-[#2e1d52]" />
      </div>
    );
  }

  if (!season) return null;

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6">
      <ERPPageHeader
        title="View Season"
        subtitle={`Details for ${season.name}`}
        breadcrumbItems={breadcrumbItems}
        actions={
          <Button 
            variant="outline" 
            onClick={() => router.push('/settings/seasons')}
            className="h-12 rounded-xl px-6 font-bold text-slate-600"
          >
            <ArrowLeft size={18} className="mr-2" /> Back
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        <Card className="shadow-lg border-0 rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-[#2e1d52] to-[#452b7a] text-white">
            <CardTitle className="text-xl flex items-center gap-2">
              <CalendarRange className="h-5 w-5" /> Season Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500 font-semibold uppercase tracking-wider">Season Name</p>
                <p className="text-lg font-bold text-[#2e1d52]">{season.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 font-semibold uppercase tracking-wider">Status</p>
                <span className={`inline-block mt-1 text-xs font-black px-3 py-1 rounded-md uppercase tracking-widest ${
                  season.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {season.status} {season.isDefault && '(Default)'}
                </span>
              </div>
              <div>
                <p className="text-sm text-slate-500 font-semibold uppercase tracking-wider">Start Date</p>
                <p className="text-md font-semibold text-slate-700">{season.start || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 font-semibold uppercase tracking-wider">End Date</p>
                <p className="text-md font-semibold text-slate-700">{season.end || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-100 to-slate-50 border-b">
            <CardTitle className="text-xl flex items-center gap-2 text-slate-700">
              <Clock className="h-5 w-5" /> Audit Trail
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500 font-semibold uppercase tracking-wider">Created By</p>
                <p className="text-md font-semibold text-slate-700 flex items-center gap-2 mt-1">
                  <User className="h-4 w-4" /> {season.createdBy || 'System'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 font-semibold uppercase tracking-wider">Created At</p>
                <p className="text-md font-semibold text-slate-700 mt-1">
                  {season.createdAt?.toDate ? season.createdAt.toDate().toLocaleString() : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 font-semibold uppercase tracking-wider">Updated By</p>
                <p className="text-md font-semibold text-slate-700 flex items-center gap-2 mt-1">
                  <User className="h-4 w-4" /> {season.updatedBy || 'System'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 font-semibold uppercase tracking-wider">Updated At</p>
                <p className="text-md font-semibold text-slate-700 mt-1">
                  {season.updatedAt?.toDate ? season.updatedAt.toDate().toLocaleString() : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
