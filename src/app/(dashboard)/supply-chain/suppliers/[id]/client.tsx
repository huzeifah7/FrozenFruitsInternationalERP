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
  Package,
  Loader2,
  Calendar,
  User,
  MapPin,
  Phone,
  Building,
  CreditCard,
  FileText,
  Coins,
  Euro,
  DollarSign,
  PoundSterling,
} from 'lucide-react';
import { format } from 'date-fns';

export default function ViewSupplierPage() {
  const router = useRouter();
  const { id } = useParams();
  const db = useFirestore();

  const supplierRef = useMemoFirebase(() => {
    if (!db || !id) return null;
    return doc(db, 'suppliers', id as string);
  }, [db, id]);

  const { data: supplier, isLoading: loading } = useDoc(supplierRef);

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

  if (!supplier) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground uppercase font-black text-xs tracking-widest">Supplier not found</p>
        <Button variant="link" onClick={() => router.push('/supply-chain/suppliers')} className="mt-4">
          Back to list
        </Button>
      </div>
    );
  }

  const DetailRow = ({ label, value, icon: Icon }: { label: string; value: any; icon?: any }) => (
    <div className="flex items-start py-6 border-b border-primary/5 last:border-0 group">
      <div className="w-1/3 flex items-center gap-3">
        {Icon && <Icon className="size-4 text-primary/20 group-hover:text-primary transition-colors" />}
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
            onClick={() => router.push('/supply-chain/suppliers')}
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
                  Suppliers
                </li>
                <li className="flex items-center">
                  <span className="mx-2 opacity-20">/</span>
                  <span className="text-primary/60 font-black">Details</span>
                </li>
              </ol>
            </nav>
            <h1 className="text-3xl font-black text-primary tracking-tight uppercase leading-none">{supplier.name}</h1>
          </div>
        </div>

        <Button 
          onClick={() => router.push(`/supply-chain/suppliers/${id}/edit`)}
          className="h-11 px-6 bg-white border border-primary/10 hover:border-primary/20 text-primary font-black rounded-xl shadow-lg shadow-primary/5 transition-all flex items-center gap-2"
        >
          <Edit className="size-4" />
          <span className="uppercase tracking-widest text-[10px]">Edit Supplier</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Info Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-primary/5 border border-primary/5 overflow-hidden">
            <div className="bg-primary/[0.02] px-10 py-5 border-b border-primary/5">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40">Supplier Details</h2>
            </div>
            <div className="px-10 py-4">
              <DetailRow label="Supplier Name" value={supplier.name} icon={Building} />
              <DetailRow label="Supplier Type" value={supplier.supplier_type} icon={Package} />
              {(() => {
                const curr = (supplier.currency || 'MAD').toUpperCase();
                let CurrencyIcon = Coins;
                if (curr.includes('EURO') || curr.includes('EUR')) CurrencyIcon = Euro;
                else if (curr.includes('DOLLAR') || curr.includes('USD')) CurrencyIcon = DollarSign;
                else if (curr.includes('POUND') || curr.includes('GBP')) CurrencyIcon = PoundSterling;
                return <DetailRow label="Currency" value={supplier.currency || 'MAD'} icon={CurrencyIcon} />;
              })()}
              <DetailRow label="Contact Person" value={supplier.contact_person} icon={User} />
              <DetailRow label="Phone Number" value={supplier.phone_number} icon={Phone} />
              <DetailRow label="Bank Number" value={supplier.bank_number} icon={CreditCard} />
              <DetailRow label="Bank Name" value={supplier.bank_name} icon={Building} />
              <DetailRow label="IF (Identifiant Fiscal)" value={supplier.IF} icon={FileText} />
              <DetailRow label="ICE" value={supplier.ICE} icon={FileText} />
              <DetailRow label="Address" value={supplier.address} icon={MapPin} />
            </div>
          </div>

          {/* Internal Notes Card */}
          <div className="bg-[#FAFAFF] rounded-[2rem] p-8 border border-primary/5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-primary/40 mb-4 flex items-center gap-2">
              <FileText className="size-3.5" /> Internal Remarks
            </h3>
            <p className="text-sm font-bold text-primary/70 leading-relaxed italic whitespace-pre-wrap">
              {supplier.note || "No internal remarks provided."}
            </p>
          </div>
        </div>

        {/* Audit Info Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] p-8 shadow-xl shadow-primary/5 border border-primary/5 space-y-8">
            <div className="space-y-6">
              <div className="flex flex-col gap-2 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                <span className="text-[9px] font-black uppercase tracking-widest text-primary/40 flex items-center gap-2">
                  <User className="size-3" /> Created By
                </span>
                <span className="text-xs font-black text-primary uppercase">{supplier.created_by}</span>
                <span className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1.5 mt-1">
                  <Calendar className="size-3" />
                  {supplier.created_at?.toDate ? format(supplier.created_at.toDate(), 'dd MMM yyyy HH:mm') : 'N/A'}
                </span>
              </div>

              <div className="flex flex-col gap-2 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                <span className="text-[9px] font-black uppercase tracking-widest text-primary/40 flex items-center gap-2">
                  <User className="size-3" /> Last Updated By
                </span>
                <span className="text-xs font-black text-primary uppercase">{supplier.updated_by}</span>
                <span className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1.5 mt-1">
                  <Calendar className="size-3" />
                  {supplier.updated_at?.toDate ? format(supplier.updated_at.toDate(), 'dd MMM yyyy HH:mm') : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
