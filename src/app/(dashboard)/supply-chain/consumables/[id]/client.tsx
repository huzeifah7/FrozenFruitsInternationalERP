'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  doc,
} from '@/firebase/firestore-override';
import {
  useFirestore,
  useDoc,
  useMemoFirebase,
} from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  Edit,
  Package2,
  Loader2,
  Calendar,
  User,
  AlertTriangle,
  BarChart2,
  Users,
  FileText,
  BadgeCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function ViewConsumablePage() {
  const router = useRouter();
  const { id } = useParams();
  const db = useFirestore();

  const consumableRef = useMemoFirebase(() => {
    if (!db || !id) return null;
    return doc(db, 'consumables', id as string);
  }, [db, id]);

  const { data: consumable, isLoading: loading } = useDoc(consumableRef);

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary/20" />
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">Loading details...</p>
        </div>
      </div>
    );
  }

  if (!consumable) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground uppercase font-black text-xs tracking-widest">Consumable not found</p>
        <Button variant="link" onClick={() => router.push('/supply-chain/consumables')} className="mt-4">
          Back to list
        </Button>
      </div>
    );
  }

  const DetailRow = ({ label, value, icon: Icon, color }: { label: string; value: any; icon?: any; color?: string }) => (
    <div className="flex items-start py-6 border-b border-primary/5 last:border-0 group">
      <div className="w-1/3 flex items-center gap-3">
        {Icon && <Icon className={`size-4 ${color || 'text-primary/20'} group-hover:text-primary transition-colors`} />}
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">{label}</span>
      </div>
      <div className="flex-1">
        <span className="text-sm font-bold text-primary tracking-tight">
          {value || <span className="opacity-20">N/A</span>}
        </span>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push('/supply-chain/consumables')}
            className="rounded-full hover:bg-primary/5 text-primary/40 hover:text-primary transition-all"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="space-y-1">
            <nav className="flex text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/40">
              <ol className="inline-flex items-center space-x-2">
                <li>Profile</li>
                <li className="flex items-center">
                  <span className="mx-2 opacity-20">/</span>
                  Consumables
                </li>
                <li className="flex items-center">
                  <span className="mx-2 opacity-20">/</span>
                  <span className="text-primary/60 font-black">Details</span>
                </li>
              </ol>
            </nav>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase leading-none">{consumable.name}</h1>
              {consumable.is_packaging && (
                <Badge className="bg-emerald-500 text-white border-none text-[9px] font-black uppercase tracking-widest px-3 py-1 flex items-center gap-1.5">
                  <BadgeCheck className="size-3" /> Packaging
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Button 
          onClick={() => router.push(`/supply-chain/consumables/${id}/edit`)}
          className="h-11 px-6 bg-white border border-primary/10 hover:border-primary/20 text-primary font-black rounded-xl shadow-lg shadow-primary/5 transition-all flex items-center gap-2"
        >
          <Edit className="size-4" />
          <span className="uppercase tracking-widest text-[10px]">Edit Details</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Info Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-primary/5 border border-primary/5 overflow-hidden">
            <div className="bg-primary/[0.02] px-10 py-5 border-b border-primary/5">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40">Technical Specifications</h2>
            </div>
            <div className="px-10 py-4">
              <DetailRow label="Consumable Name" value={consumable.name} icon={Package2} />
              <DetailRow label="Packaging Material" value={consumable.is_packaging ? "Yes (Integrated with Production)" : "No"} icon={BadgeCheck} color={consumable.is_packaging ? "text-emerald-500" : ""} />
              {consumable.is_packaging && (
                <DetailRow label="Standard Weight per Unit (kg)" value={`${consumable.weight_per_unit || 0} kg`} icon={Package2} />
              )}
              <DetailRow label="Critical Level" value={consumable.critical_level} icon={AlertTriangle} color="text-rose-500" />
              <DetailRow label="Average Level" value={consumable.average_level} icon={BarChart2} color="text-amber-500" />
              <DetailRow 
                label="Associated Suppliers" 
                value={consumable.suppliers?.join(', ')} 
                icon={Users} 
              />
            </div>
          </div>

          {/* Description Card */}
          <div className="bg-[#FAFAFF] rounded-[2rem] p-8 border border-primary/5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-primary/40 mb-4 flex items-center gap-2">
              <FileText className="size-3.5" /> Technical Description
            </h3>
            <p className="text-sm font-bold text-primary/70 leading-relaxed whitespace-pre-wrap">
              {consumable.description || "No technical description provided."}
            </p>
          </div>
        </div>

        {/* Audit Info Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] p-8 shadow-xl shadow-primary/5 border border-primary/5 space-y-8">
            <div className="space-y-6">
              <div className="flex flex-col gap-2 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                <span className="text-[9px] font-black uppercase tracking-widest text-primary/40 flex items-center gap-2">
                  <User className="size-3" /> Registered By
                </span>
                <span className="text-xs font-black text-primary uppercase">{consumable.created_by}</span>
                <span className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1.5 mt-1">
                  <Calendar className="size-3" />
                  {consumable.created_at?.toDate ? format(consumable.created_at.toDate(), 'dd MMM yyyy HH:mm') : 'N/A'}
                </span>
              </div>

              <div className="flex flex-col gap-2 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                <span className="text-[9px] font-black uppercase tracking-widest text-primary/40 flex items-center gap-2">
                  <User className="size-3" /> Last Updated By
                </span>
                <span className="text-xs font-black text-primary uppercase">{consumable.updated_by}</span>
                <span className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1.5 mt-1">
                  <Calendar className="size-3" />
                  {consumable.updated_at?.toDate ? format(consumable.updated_at.toDate(), 'dd MMM yyyy HH:mm') : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
