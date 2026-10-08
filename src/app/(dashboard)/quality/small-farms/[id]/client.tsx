'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  doc, 
  onSnapshot 
} from '@/firebase/firestore-override';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  ChevronLeft, 
  MapPin, 
  Hash, 
  Info,
  MoreHorizontal,
  User,
  Map,
  Phone,
  FileCode,
  Activity
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface SmallFarm {
  id: string;
  name: string;
  farmerName: string;
  region: string;
  phone: string;
  ggnNumber: string;
  gpsLocation?: string;
  farmCodification: string;
  createdAt: any;
  createdBy: string;
  createdByDisplayName?: string;
}

export default function ViewSmallFarmPage() {
  const params = useParams();
  const router = useRouter();
  const db = useFirestore();
  const [data, setData] = useState<SmallFarm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !params.id) return;

    const docRef = doc(db, 'small_farms', params.id as string);
    
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const farmData = { id: docSnap.id, ...docSnap.data() } as SmallFarm;
        setData(farmData);
        
        // Resolve creator name
        if (farmData.createdByDisplayName) {
          setCreatorName(farmData.createdByDisplayName);
        } else if (farmData.createdBy) {
          try {
            const userRef = doc(db, 'appUsers', farmData.createdBy);
            const userSnap = await (await import('firebase/firestore')).getDoc(userRef);
            if (userSnap.exists()) {
              setCreatorName(userSnap.data()?.displayName || userSnap.data()?.email || farmData.createdBy);
            } else {
              setCreatorName(farmData.createdBy);
            }
          } catch (e) {
            setCreatorName(farmData.createdBy);
          }
        }
      } else {
        setError("Small farm not found.");
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError("Failed to fetch data.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, params.id]);

  if (loading) {
    return (
      <div className="p-8 space-y-8 max-w-6xl mx-auto text-primary">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-64" />
          </div>
        </div>
        <Skeleton className="h-[250px] w-full rounded-3xl" />
        <Skeleton className="h-[200px] w-full rounded-3xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="p-6 bg-destructive/10 rounded-full text-destructive">
          <Info size={40} />
        </div>
        <h2 className="text-2xl font-bold text-primary">{error || "Something went wrong"}</h2>
        <Button onClick={() => router.push('/quality/small-farms')} variant="outline" className="rounded-xl border-primary/20 shadow-lg">
          Back to Listing
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/quality/small-farms')} className="rounded-full hover:bg-primary/5 text-primary">
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div>
            <nav className="flex text-[10px] font-bold uppercase tracking-widest text-primary/50 mb-1" aria-label="Breadcrumb">
              <ol className="inline-flex items-center space-x-2">
                <li>Profile</li>
                <li className="flex items-center">
                  <span className="mx-2">/</span>
                  <span className="hover:text-primary cursor-pointer" onClick={() => router.push('/quality/small-farms')}>Small Farms</span>
                </li>
                <li className="flex items-center">
                  <span className="mx-2">/</span>
                  <span className="text-primary truncate max-w-[150px] font-bold">View Small Farms</span>
                </li>
              </ol>
            </nav>
            <h1 className="text-3xl font-extrabold text-primary tracking-tight">Small Farm Details</h1>
          </div>
        </div>
        <Button variant="outline" className="rounded-xl border-primary/20 text-primary font-bold px-6 gap-2 hover:bg-primary/5 shadow-sm">
          <MoreHorizontal size={18} /> OPTIONS
        </Button>
      </div>

      <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
        <CardHeader className="bg-primary/5 border-b border-primary/10 p-8">
          <div className="flex items-center gap-3 text-primary">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Activity size={20} className="font-bold" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold uppercase tracking-wider">Producer Profile</CardTitle>
              <CardDescription className="text-xs font-medium text-primary/60">Comprehensive data including contact and regional info.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 grid grid-cols-1 md:grid-cols-3 gap-y-10 gap-x-12">
          <DataField label="Farm Name" value={data.name} icon={<Map size={14} />} />
          <DataField label="Farmer Name" value={data.farmerName} icon={<User size={14} />} isHighlight />
          <DataField label="Region / Area" value={data.region} icon={<MapPin size={14} />} />
          <DataField label="Phone Number" value={data.phone} icon={<Phone size={14} />} />
          <DataField label="GGN Number" value={data.ggnNumber} icon={<Hash size={14} />} />
          <DataField label="Farm Codification" value={data.farmCodification} icon={<FileCode size={14} />} />
          
          {data.gpsLocation && (
            <div className="md:col-span-3">
              <DataField label="GPS Location" value={data.gpsLocation} icon={<MapPin size={14} />} />
            </div>
          )}
          
          <div className="md:col-span-3 pt-6 border-t border-primary/5 flex items-center justify-between">
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-primary/30 uppercase tracking-widest">Registered By:</span>
                <span className="text-xs font-bold text-primary/70">{creatorName || data.createdBy || 'Unknown'}</span>
             </div>
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-primary/30 uppercase tracking-widest">Created At:</span>
                <span className="text-xs font-bold text-primary/70">
                   {data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : 'N/A'}
                </span>
             </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DataField({ label, value, icon, isHighlight }: { label: string, value: string | number | undefined, icon: React.ReactNode, isHighlight?: boolean }) {
  return (
    <div className="space-y-1.5 flex flex-col">
      <div className="flex items-center gap-2 text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-1">
        {icon} {label}
      </div>
      <p className={`font-bold tracking-tight ${isHighlight ? 'text-2xl text-primary font-extrabold' : 'text-lg text-primary/80 font-bold'}`}>
        {value || 'Not Specified'}
      </p>
    </div>
  );
}
