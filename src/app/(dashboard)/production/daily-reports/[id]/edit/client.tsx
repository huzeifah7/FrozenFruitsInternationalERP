'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
} from '@/firebase/firestore-override';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
  useUser,
} from '@/firebase';
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
import { 
  ChevronLeft, 
  Save, 
  Loader2,
  Calendar,
  MapPin,
  Scale,
  Package,
  Layers,
  FileText
} from 'lucide-react';
import Link from 'next/link';

const reportSchema = z.object({
  date: z.string().min(1, "Date is required"),
  locationId: z.string().min(1, "Location is required"),
  shift: z.string().min(1, "Shift is required"),
  decay: z.coerce.number().min(0, "Must be positive or zero"),
  finishedPallets: z.coerce.number().min(0, "Must be positive or zero"),
  returnWeight: z.coerce.number().min(0, "Must be positive or zero"),
  reportStatus: z.string().min(1, "Status is required"),
  finishedProductsNetWeight: z.coerce.number().min(0, "Must be positive or zero"),
  pendingPallets: z.coerce.number().min(0, "Must be positive or zero"),
  smallCalibers: z.coerce.number().min(0, "Must be positive or zero"),
});

type ReportFormValues = z.infer<typeof reportSchema>;

export default function EditProductionDailyReportPage() {
  const router = useRouter();
  const { id } = useParams();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Queries
  const locationsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'processing_lines');
  }, [db]);

  const { data: locations } = useCollection(locationsQuery);

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      date: '',
      locationId: '',
      shift: '1',
      decay: 0,
      finishedPallets: 0,
      returnWeight: 0,
      reportStatus: 'Pending',
      finishedProductsNetWeight: 0,
      pendingPallets: 0,
      smallCalibers: 0,
    },
  });

  useEffect(() => {
    async function fetchReport() {
      if (!db || !id) return;
      try {
        const docRef = doc(db, 'production_daily_reports', id as string);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          form.reset({
            date: data.date || '',
            locationId: data.locationId || '',
            shift: data.shift || '1',
            decay: data.decay || 0,
            finishedPallets: data.finishedPallets || 0,
            returnWeight: data.returnWeight || 0,
            reportStatus: data.reportStatus || 'Pending',
            finishedProductsNetWeight: data.finishedProductsNetWeight || 0,
            pendingPallets: data.pendingPallets || 0,
            smallCalibers: data.smallCalibers || 0,
          });
        } else {
          toast({ variant: "destructive", title: "Error", description: "Report not found" });
          router.push('/production/daily-reports');
        }
      } catch (error) {
        console.error("Error fetching report:", error);
      } finally {
        setFetching(false);
      }
    }

    fetchReport();
  }, [db, id, form, router, toast]);

  const onSubmit = async (values: ReportFormValues) => {
    if (!db || !user || !id) return;
    setLoading(true);

    try {
      const selectedLocation = locations?.find(l => l.id === values.locationId);
      
      const reportRef = doc(db, 'production_daily_reports', id as string);
      await updateDoc(reportRef, {
        ...values,
        locationName: selectedLocation?.title || 'Unknown',
        updatedAt: serverTimestamp(),
        updatedBy: user.email,
      });

      toast({
        title: "Success",
        description: "Daily report has been updated successfully.",
      });
      router.push('/production/daily-reports');
    } catch (error) {
      console.error("Error updating report:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update report. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            asChild
            className="rounded-full hover:bg-primary/5 text-primary/40 hover:text-primary transition-all"
          >
            <Link href="/production/daily-reports">
              <ChevronLeft className="h-6 w-6" />
            </Link>
          </Button>
          <div className="space-y-1">
            <nav className="flex text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/40" aria-label="Breadcrumb">
              <ol className="inline-flex items-center space-x-2">
                <li>Profile</li>
                <li className="flex items-center">
                  <span className="mx-2 opacity-20">/</span>
                  Production Daily Report
                </li>
                <li className="flex items-center">
                  <span className="mx-2 opacity-20">/</span>
                  <span className="text-primary/60 font-black uppercase">Edit Report</span>
                </li>
              </ol>
            </nav>
            <h1 className="text-3xl font-black text-primary tracking-tight uppercase leading-none">Edit Daily Report</h1>
          </div>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-primary/5 border border-primary/5 overflow-hidden">
          <div className="bg-primary/[0.02] px-8 py-5 border-b border-primary/5 flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40 flex items-center gap-2">
              <FileText className="h-4 w-4" /> Production Daily Report Info
            </h2>
          </div>

          <div className="p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8">
              {/* Left Column */}
              <div className="space-y-8">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Date</Label>
                  <div className="relative group">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/20 group-focus-within:text-primary transition-colors" />
                    <Input 
                      type="date" 
                      {...form.register('date')} 
                      className="h-12 rounded-2xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all pl-12 pr-4" 
                    />
                  </div>
                  {form.formState.errors.date && <p className="text-[10px] text-rose-500 font-bold uppercase ml-1">{form.formState.errors.date.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Location</Label>
                  <Select onValueChange={(v) => form.setValue('locationId', v, { shouldValidate: true })} value={form.watch('locationId')}>
                    <SelectTrigger className="h-12 rounded-2xl bg-muted/30 border-none font-bold text-primary focus:ring-2 focus:ring-primary/10 transition-all px-6 text-left">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-4 w-4 text-primary/20" />
                        <SelectValue placeholder="Select Location" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-primary/5 shadow-2xl">
                      {locations?.map(l => (
                        <SelectItem key={l.id} value={l.id} className="rounded-xl font-bold py-3">{l.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.locationId && <p className="text-[10px] text-rose-500 font-bold uppercase ml-1">{form.formState.errors.locationId.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Decay</Label>
                  <div className="relative group">
                    <Scale className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/20 group-focus-within:text-primary transition-colors" />
                    <Input 
                      type="number" 
                      step="0.01"
                      {...form.register('decay')} 
                      className="h-12 rounded-2xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all pl-12 pr-12 text-right" 
                    />
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[9px] font-black text-primary/20 uppercase tracking-widest">KG</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Finished Pallets</Label>
                  <div className="relative group">
                    <Package className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/20 group-focus-within:text-primary transition-colors" />
                    <Input 
                      type="number" 
                      {...form.register('finishedPallets')} 
                      className="h-12 rounded-2xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all pl-12 pr-4 text-right" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Return</Label>
                  <div className="relative group">
                    <Scale className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/20 group-focus-within:text-primary transition-colors" />
                    <Input 
                      type="number" 
                      step="0.01"
                      {...form.register('returnWeight')} 
                      className="h-12 rounded-2xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all pl-12 pr-12 text-right" 
                    />
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[9px] font-black text-primary/20 uppercase tracking-widest">KG</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Report Status</Label>
                  <Select onValueChange={(v) => form.setValue('reportStatus', v)} value={form.watch('reportStatus')}>
                    <SelectTrigger className="h-12 rounded-2xl bg-muted/30 border-none font-bold text-primary focus:ring-2 focus:ring-primary/10 transition-all px-6 text-left">
                      <div className="flex items-center gap-3">
                        <Layers className="h-4 w-4 text-primary/20" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-primary/5 shadow-2xl">
                      <SelectItem value="Pending" className="rounded-xl font-bold py-3 text-amber-600">Pending</SelectItem>
                      <SelectItem value="Published" className="rounded-xl font-bold py-3 text-blue-600">Published</SelectItem>
                      <SelectItem value="Released" className="rounded-xl font-bold py-3 text-emerald-600">Released</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-8">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Shift</Label>
                  <Select onValueChange={(v) => form.setValue('shift', v)} value={form.watch('shift')}>
                    <SelectTrigger className="h-12 rounded-2xl bg-muted/30 border-none font-bold text-primary focus:ring-2 focus:ring-primary/10 transition-all px-6 text-left">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-primary/5 shadow-2xl">
                      <SelectItem value="1" className="rounded-xl font-bold py-3">1</SelectItem>
                      <SelectItem value="2" className="rounded-xl font-bold py-3">2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>


                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Finished Products Net Weight</Label>
                  <div className="relative group">
                    <Scale className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/20 group-focus-within:text-primary transition-colors" />
                    <Input 
                      type="number" 
                      step="0.01"
                      {...form.register('finishedProductsNetWeight')} 
                      className="h-12 rounded-2xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all pl-12 pr-12 text-right" 
                    />
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[9px] font-black text-primary/20 uppercase tracking-widest">KG</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Pending Pallets</Label>
                  <div className="relative group">
                    <Package className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/20 group-focus-within:text-primary transition-colors" />
                    <Input 
                      type="number" 
                      {...form.register('pendingPallets')} 
                      className="h-12 rounded-2xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all pl-12 pr-4 text-right" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Small Calibers</Label>
                  <div className="relative group">
                    <Scale className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/20 group-focus-within:text-primary transition-colors" />
                    <Input 
                      type="number" 
                      step="0.01"
                      {...form.register('smallCalibers')} 
                      className="h-12 rounded-2xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all pl-12 pr-12 text-right" 
                    />
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[9px] font-black text-primary/20 uppercase tracking-widest">KG</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-4">
          <Button 
            type="submit" 
            disabled={loading} 
            className="h-14 px-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-xl shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-[0.2em] text-[10px] gap-3"
          >
            {loading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> SAVING...</>
            ) : <><Save className="h-5 w-5" /> Save Changes</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
