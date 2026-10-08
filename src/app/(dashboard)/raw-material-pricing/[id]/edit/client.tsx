'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  orderBy,
} from '@/firebase/firestore-override';
import { useFirestore, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  Loader2,
  Save,
  Hash,
  Calendar,
  CalendarDays,
  CreditCard,
  User,
  MapPin,
  Building2,
  Truck,
  Scale,
  Weight,
  Leaf,
  DollarSign,
  Percent,
  HardHat,
  TruckIcon,
  Navigation,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Reusable Info Field
// ─────────────────────────────────────────────────────────────────────────────
function InfoField({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#5d4a9c]/60 flex items-center gap-1.5">
        {Icon && <Icon size={10} className="shrink-0" />}
        {label}
      </span>
      <span className="text-sm font-bold text-slate-800 leading-snug">
        {value || <span className="text-slate-300 font-bold">—</span>}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable Input with suffix badge
// ─────────────────────────────────────────────────────────────────────────────
function SuffixInput({
  id,
  suffix,
  value,
  onChange,
  placeholder = '0.00',
  type = 'number',
  step = '0.01',
  min = '0',
}: {
  id: string;
  suffix: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  step?: string;
  min?: string;
}) {
  return (
    <div className="relative flex items-center">
      <Input
        id={id}
        type={type}
        step={step}
        min={min}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-xl bg-[#F5F7FA] border border-slate-200 font-bold text-slate-800 pr-14 focus-visible:ring-[#7a9800] focus-visible:border-[#7a9800] transition-colors"
      />
      <span className="absolute right-0 top-0 h-11 px-3.5 flex items-center justify-center text-[10px] font-black text-slate-400 bg-slate-100 rounded-r-xl border border-l-0 border-slate-200 select-none">
        {suffix}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Card wrapper
// ─────────────────────────────────────────────────────────────────────────────
function SectionCard({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {title && (
        <div className="px-6 pt-5 pb-3 border-b border-slate-50">
          <h2 className="text-xs font-black text-[#5d4a9c] uppercase tracking-[0.18em]">
            {title}
          </h2>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function EditRawMaterialPricingPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // ── Data ──
  const [material, setMaterial] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [transports, setTransports] = useState<any[]>([]);
  const [cabranes, setCabranes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Section 2: Pricing ──
  const [currency, setCurrency] = useState('MAD');
  const [price, setPrice] = useState('');
  const [decayPrice, setDecayPrice] = useState('');
  const [rebate, setRebate] = useState('');
  const [paymentFrom, setPaymentFrom] = useState('');

  const currencySymbols = useMemo<Record<string, string>>(() => ({
    MAD: 'dh',
    EUR: '€',
    USD: '$',
    GBP: '£',
  }), []);
  const currentSymbol = currencySymbols[currency] || 'dh';

  // ── Section 3: Workers ──
  const [workerCost, setWorkerCost] = useState('');
  const [costPaidByFarmer, setCostPaidByFarmer] = useState(''); // Serves as Cabrane Cost
  const [cabraneId, setCabraneId] = useState('');

  // ── Section 4: Transport ──
  const [transportId, setTransportId] = useState('');
  const [transportCost, setTransportCost] = useState('');
  const [origin, setOrigin] = useState('');

  // ── Auto Calculations ──
  const calcData = useMemo(() => {
    if (!material) return null;
    const blNetWeight = Number(material.blNetWeight != null ? material.blNetWeight : (material.totalNetWeight || 0));
    const decayNetWeight = Number(material.totalDecayNetWeight || material.decayNetWeight || 0);
    
    const pWorkerCost = Number(workerCost || 0);
    const pRebate = Number(rebate || 0);
    const rebateFactor = (100 - pRebate) / 100;

    let finalAmount: number | 'Pending' = 'Pending';
    let baseAmount = 0;
    let decayAmount = 0;
    let goodWeight = blNetWeight - decayNetWeight;
    let grossAmount = 0;

    if (!price || price === '') {
      finalAmount = 'Pending';
    } else {
      const pPrice = Number(price);
      const pDecayPrice = Number(decayPrice || 0);

      baseAmount = goodWeight * pPrice * rebateFactor;
      decayAmount = decayNetWeight > 0 ? (decayNetWeight * pDecayPrice * rebateFactor) : 0;
      
      grossAmount = baseAmount + decayAmount;
      finalAmount = Number((grossAmount - pWorkerCost).toFixed(2));
    }

    return {
      blNetWeight,
      decayNetWeight,
      goodWeight,
      rebateFactor,
      baseAmount,
      decayAmount,
      grossAmount,
      workerCost: pWorkerCost,
      finalAmount
    };
  }, [material, price, decayPrice, workerCost, rebate]);

  // ── Fetch everything ──
  useEffect(() => {
    if (!db || !id) return;
    const load = async () => {
      try {
        setLoading(true);
        const [rmSnap, supSnap, locSnap, trSnap, cabSnap] = await Promise.all([
          getDoc(doc(db, 'raw_materials', id)),
          getDocs(query(collection(db, 'procurement_suppliers'), orderBy('name'))),
          getDocs(query(collection(db, 'processing_lines'), orderBy('title'))),
          getDocs(query(collection(db, 'transports'), orderBy('driverName'))),
          // cabranes might be stored as calibres or a dedicated collection
          getDocs(collection(db, 'cabranes')).catch(() => ({ docs: [] as any[] })),
        ]);

        setSuppliers(supSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLocations(locSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setTransports(trSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCabranes((cabSnap as any).docs.map((d: any) => ({ id: d.id, ...d.data() })));

        if (!rmSnap.exists()) {
          toast({ title: 'Not Found', description: 'Raw material lot not found.', variant: 'destructive' });
          router.push('/procurement/prices');
          return;
        }

        const data = rmSnap.data();
        setMaterial({ id: rmSnap.id, ...data });

        // Pre-fill pricing fields
        setCurrency(data.currency || 'MAD');
        setPrice(data.price != null ? String(data.price) : '');
        setDecayPrice(data.decayPrice != null ? String(data.decayPrice) : '');
        setRebate(data.rebate != null ? String(data.rebate) : '');
        setPaymentFrom(data.paymentFrom || 'Farmer');

        // Pre-fill workers
        setWorkerCost(data.workerCost != null ? String(data.workerCost) : '');
        setCostPaidByFarmer(data.costPaidByFarmer != null ? String(data.costPaidByFarmer) : '');
        setCabraneId(data.cabraneId || '');

        // Pre-fill transport
        setTransportId(data.transportId || '');
        setTransportCost(data.transportCost != null ? String(data.transportCost) : '');
        setOrigin(data.origin || '');
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to load pricing data.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [db, id, router, toast]);

  // ── Derived helpers ──
  const getSupplierName = (sid: string) => {
    const s = suppliers.find((s) => s.id === sid);
    if (!s) return sid || '—';
    return s.name || s.supplierName || sid || '—';
  };

  const getLocationName = (lid: string) =>
    locations.find((l) => l.id === lid)?.title || lid || '—';

  const formatDate = (val: any): string => {
    if (!val) return '—';
    try {
      const d = val?.toDate ? val.toDate() : new Date(val);
      return format(d, 'dd/MM/yyyy HH:mm');
    } catch {
      return String(val);
    }
  };

  const formatShiftDate = (val: any): string => {
    if (!val) return '—';
    try {
      const d = val?.toDate ? val.toDate() : new Date(val);
      return format(d, 'dd/MM/yyyy');
    } catch {
      return String(val);
    }
  };

  // ── Validation & Submit ──
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !id || !material || !user) return;

    const numericFields: Record<string, string> = { price, decayPrice, rebate, workerCost, costPaidByFarmer, transportCost };
    for (const [k, v] of Object.entries(numericFields)) {
      if (v !== '' && (isNaN(Number(v)) || Number(v) < 0)) {
        toast({
          title: 'Validation Error',
          description: `"${k}" must be a valid non-negative number.`,
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      setSaving(true);
      await updateDoc(doc(db, 'raw_materials', id), {
        // Pricing
        currency,
        price: price !== '' ? Number(price) : null,
        decayPrice: decayPrice !== '' ? Number(decayPrice) : null,
        rebate: rebate !== '' ? Number(rebate) : null,
        paymentFrom: paymentFrom || null,
        // Workers
        workerCost: workerCost !== '' ? Number(workerCost) : null,
        costPaidByFarmer: costPaidByFarmer !== '' ? Number(costPaidByFarmer) : null,
        cabraneId: cabraneId || null,
        // Transport
        transportId: transportId || null,
        transportCost: transportCost !== '' ? Number(transportCost) : null,
        origin: origin || null,
        // Audit
        pricedAt: serverTimestamp(),
        pricedBy: user.email || 'system',
        updatedAt: serverTimestamp(),
        updatedBy: user.email || 'system',
        amount: calcData?.finalAmount === 'Pending' ? null : calcData?.finalAmount,
      });

      toast({
        title: 'Pricing Updated',
        description: `Lot ${material.lotNumber} has been updated successfully.`,
      });
      router.push('/procurement/prices');
    } catch (err) {
      console.error(err);
      toast({ title: 'Update Failed', description: 'Could not save changes. Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Loading skeleton
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F7FA]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#7a9800]" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Loading pricing data...
          </p>
        </div>
      </div>
    );
  }

  if (!material) return null;



  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-screen bg-[#F5F7FA] p-6 lg:p-8 animate-in fade-in duration-300">
      <div className="max-w-[1280px] mx-auto space-y-6">

        {/* ── PAGE HEADER ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              <span
                className="hover:text-slate-600 cursor-pointer transition-colors"
                onClick={() => router.push('/procurement/prices')}
              >
                Profile
              </span>
              <span className="opacity-40">/</span>
              <span
                className="hover:text-slate-600 cursor-pointer transition-colors"
                onClick={() => router.push('/procurement/prices')}
              >
                Raw Material Pricing
              </span>
              <span className="opacity-40">/</span>
              <span className="text-[#7a9800] font-black">Edit</span>
            </div>

            {/* Title + back */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => router.back()}
                className="h-9 w-9 rounded-xl border-slate-200 bg-white hover:bg-slate-50 shadow-sm shrink-0"
              >
                <ChevronLeft size={16} className="text-slate-500" />
              </Button>
              <h1 className="text-2xl font-black text-[#2e1d52] uppercase tracking-tight leading-none">
                Raw Material Pricing
              </h1>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">

          {/* ══════════════════════════════════════════
              SECTION 1 — RAW MATERIAL INFO
          ══════════════════════════════════════════ */}
          <SectionCard>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-6">
              <InfoField icon={Hash} label="Lot Number" value={material.lotNumber} />
              <InfoField icon={Calendar} label="Date & Time" value={formatDate(material.dateTime || material.createdAt)} />
              <InfoField icon={CalendarDays} label="Shift Date" value={formatShiftDate(material.shiftDate || material.date)} />
              <InfoField icon={CreditCard} label="Plate Number" value={material.plateNumber} />
              <InfoField icon={User} label="Farmer Name" value={material.farmName || material.farmerName} />
              <InfoField icon={MapPin} label="Location" value={getLocationName(material.locationId)} />
              <InfoField icon={Building2} label="Supplier" value={getSupplierName(material.supplierId)} />
              <InfoField icon={Truck} label="Driver Name" value={material.driverName} />
              <InfoField
                icon={Scale}
                label="BL Net Weight"
                value={material.blNetWeight != null ? `${Number(material.blNetWeight).toLocaleString()} KG` : '—'}
              />
              <InfoField
                icon={Weight}
                label="BL Gross Weight"
                value={material.blGrossWeight != null ? `${Number(material.blGrossWeight).toLocaleString()} KG` : '—'}
              />
              <InfoField
                icon={Leaf}
                label="Decay Net Weight"
                value={material.totalDecayNetWeight != null ? `${Number(material.totalDecayNetWeight).toLocaleString()} KG` : '—'}
              />
            </div>
          </SectionCard>

          {/* ══════════════════════════════════════════
              SECTION 2 — RAW MATERIAL PRICING
          ══════════════════════════════════════════ */}
          <SectionCard title="Raw Material Pricing">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

              {/* Currency */}
              <div className="space-y-2">
                <Label htmlFor="currency" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Select Currency
                </Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger
                    id="currency"
                    className="h-11 rounded-xl bg-[#F5F7FA] border border-slate-200 font-bold text-slate-800 focus:ring-[#7a9800]"
                  >
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                    <SelectItem value="MAD" className="font-bold">MAD (dh)</SelectItem>
                    <SelectItem value="EUR" className="font-bold">EUR (€)</SelectItem>
                    <SelectItem value="USD" className="font-bold">USD ($)</SelectItem>
                    <SelectItem value="GBP" className="font-bold">GBP (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Price */}
              <div className="space-y-2">
                <Label htmlFor="price" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Price
                </Label>
                <SuffixInput id="price" suffix={currentSymbol} value={price} onChange={setPrice} />
              </div>

              {/* Decay Price */}
              <div className="space-y-2">
                <Label htmlFor="decayPrice" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Decay Price
                </Label>
                <SuffixInput id="decayPrice" suffix={currentSymbol} value={decayPrice} onChange={setDecayPrice} />
              </div>

              {/* Payment From */}
              <div className="space-y-2">
                <Label htmlFor="paymentFrom" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Payment From
                </Label>
                <Select value={paymentFrom} onValueChange={setPaymentFrom}>
                  <SelectTrigger
                    id="paymentFrom"
                    className="h-11 rounded-xl bg-[#F5F7FA] border border-slate-200 font-bold text-slate-800 focus:ring-[#7a9800]"
                  >
                    <SelectValue placeholder="Select Payment From..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                    <SelectItem value="Farmer" className="font-bold">Farmer</SelectItem>
                    <SelectItem value="Company" className="font-bold">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Rebate */}
              <div className="space-y-2">
                <Label htmlFor="rebate" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Rebate
                </Label>
                <SuffixInput id="rebate" suffix="%" value={rebate} onChange={setRebate} step="0.1" />
              </div>

            </div>
          </SectionCard>

          {/* ══════════════════════════════════════════
              SECTION 3 — WORKERS
          ══════════════════════════════════════════ */}
          <SectionCard title="Add Workers Section:">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

              {/* Worker Cost */}
              <div className="space-y-2">
                <Label htmlFor="workerCost" className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <HardHat size={10} /> Worker Cost
                </Label>
                <SuffixInput id="workerCost" suffix={currentSymbol} value={workerCost} onChange={setWorkerCost} />
              </div>

              {/* Cabrane Cost (costPaidByFarmer in DB) */}
              <div className="space-y-2">
                <Label htmlFor="costPaidByFarmer" className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <DollarSign size={10} /> Cabrane Cost
                </Label>
                <SuffixInput id="costPaidByFarmer" suffix={currentSymbol} value={costPaidByFarmer} onChange={setCostPaidByFarmer} />
              </div>

              {/* Select Cabrane */}
              <div className="space-y-2">
                <Label htmlFor="cabrane" className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Percent size={10} /> Select Cabrane
                </Label>
                <Select value={cabraneId} onValueChange={setCabraneId}>
                  <SelectTrigger
                    id="cabrane"
                    className="h-11 rounded-xl bg-[#F5F7FA] border border-slate-200 font-bold text-slate-800 focus:ring-[#7a9800]"
                  >
                    <SelectValue placeholder="Select Cabrane..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100 shadow-xl max-h-60 overflow-y-auto">
                    {cabranes.length === 0 ? (
                      <div className="py-4 text-center text-[10px] font-black uppercase text-slate-400 tracking-widest">
                        No cabranes available
                      </div>
                    ) : (
                      cabranes.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="font-bold">
                          {c.name || c.label || c.id}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

            </div>
          </SectionCard>

          {/* ══════════════════════════════════════════
              SECTION 4 — TRANSPORT
          ══════════════════════════════════════════ */}
          <SectionCard title="Add Transport Section:">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

              {/* Select Transport */}
              <div className="space-y-2">
                <Label htmlFor="transport" className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <TruckIcon size={10} /> Select Transport
                </Label>
                <Select value={transportId} onValueChange={setTransportId}>
                  <SelectTrigger
                    id="transport"
                    className="h-11 rounded-xl bg-[#F5F7FA] border border-slate-200 font-bold text-slate-800 focus:ring-[#7a9800]"
                  >
                    <SelectValue placeholder="Select Transport..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100 shadow-xl max-h-60 overflow-y-auto">
                    {transports.length === 0 ? (
                      <div className="py-4 text-center text-[10px] font-black uppercase text-slate-400 tracking-widest">
                        No transports available
                      </div>
                    ) : (
                      transports.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="font-bold">
                          <span className="flex items-center gap-2">
                            <span className="font-black text-[#7a9800]">{t.plateNumber}</span>
                            <span className="text-slate-500">— {t.driverName}</span>
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Transport Cost */}
              <div className="space-y-2">
                <Label htmlFor="transportCost" className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <DollarSign size={10} /> Transport Cost
                </Label>
                <SuffixInput id="transportCost" suffix={currentSymbol} value={transportCost} onChange={setTransportCost} />
              </div>

              {/* Origin */}
              <div className="space-y-2">
                <Label htmlFor="origin" className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Navigation size={10} /> Origin
                </Label>
                <Input
                  id="origin"
                  type="text"
                  placeholder="e.g. Agadir, Marrakech..."
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="h-11 rounded-xl bg-[#F5F7FA] border border-slate-200 font-bold text-slate-800 focus-visible:ring-[#7a9800] focus-visible:border-[#7a9800] transition-colors"
                />
              </div>

            </div>
          </SectionCard>


          {/* ══════════════════════════════════════════
              SUBMIT
          ══════════════════════════════════════════ */}
          <div className="flex items-center justify-end pt-2 pb-6">
            <Button
              type="submit"
              disabled={saving}
              className={cn(
                'h-12 px-8 rounded-xl font-black uppercase tracking-widest text-xs gap-2 min-w-[260px] shadow-lg transition-all',
                'bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-[#7a9800]/20',
                saving && 'opacity-80 cursor-not-allowed'
              )}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Update Raw Materials Pricing
                </>
              )}
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
}
