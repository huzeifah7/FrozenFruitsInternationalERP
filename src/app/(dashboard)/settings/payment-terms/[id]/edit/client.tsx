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
  serverTimestamp 
} from '@/firebase/firestore-override';
import { 
  useFirestore, 
  useUser,
  errorEmitter,
  FirestorePermissionError
} from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { 
  ChevronLeft, 
  FileText, 
  Percent, 
  Clock,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FieldError } from '@/components/ui/field-error';

const termSchema = z.object({
  name: z.string().optional(),
  amount1: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number({ required_error: "Amount is required" }).min(0).max(100)
  ),
  delay1: z.coerce.number().min(0),
  amount2: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number({ required_error: "Amount is required" }).min(0).max(100)
  ),
  delay2: z.coerce.number().min(0),
}).refine(data => (data.amount1 + data.amount2) === 100, {
  message: "Total percentages must equal 100%",
  path: ["amount2"]
});

type TermFormValues = z.infer<typeof termSchema>;

export default function EditPaymentTermPage() {
  const router = useRouter();
  const params = useParams();
  const termId = params?.id as string;
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const form = useForm<TermFormValues>({
    resolver: zodResolver(termSchema),
    defaultValues: {
      amount1: "" as any,
      delay1: 0,
      amount2: "" as any,
      delay2: 2,
    }
  });

  useEffect(() => {
    if (!db || !termId) return;
    const fetchTerm = async () => {
      setFetching(true);
      try {
        const docRef = doc(db, 'payment_terms', termId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          form.reset({
            name: data.name || '',
            amount1: data.amount1 ?? ("" as any),
            delay1: data.delay1 ?? 0,
            amount2: data.amount2 ?? ("" as any),
            delay2: data.delay2 ?? 0,
          });
        }
      } catch (err) {
        console.error("Error fetching payment term", err);
      } finally {
        setFetching(false);
      }
    };
    fetchTerm();
  }, [db, termId, form]);

  const onSubmit = async (values: TermFormValues) => {
    if (!db || !user || !termId) return;
    setLoading(true);

    // Auto-generate name if empty
    let finalName = values.name;
    if (!finalName) {
      const part1 = values.delay1 === 0 ? `${values.amount1}% advance` : `${values.amount1}% ${values.delay1} weeks after reception`;
      const part2 = values.delay2 === 0 ? `${values.amount2}% advance` : `${values.amount2}% ${values.delay2} weeks after reception`;
      finalName = `${part1}, ${part2}`;
    }

    const dataToSave = {
      ...values,
      name: finalName,
      updatedAt: serverTimestamp(),
      updatedBy: user.email
    };

    try {
      const docRef = doc(db, 'payment_terms', termId);
      await updateDoc(docRef, dataToSave).catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: dataToSave
        }));
        throw err;
      });

      toast({
        title: "Payment Term Updated",
        description: `"${finalName}" has been successfully updated.`,
      });
      router.push('/settings/payment-terms');
    } catch (error) {
      // Handled globally
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-12 w-12 hover:bg-primary/10 transition-all">
          <ChevronLeft className="h-6 w-6 text-primary" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-primary uppercase tracking-tight">Edit Payment Term</h1>
          <p className="text-sm text-muted-foreground font-medium">Update split payment percentages and delivery-based delays.</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-primary/5 p-8 border-b border-primary/5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 bg-white rounded-2xl flex items-center justify-center shadow-lg text-primary border border-primary/5">
                <FileText size={28} />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-primary uppercase tracking-widest">Term Information</CardTitle>
                <CardDescription className="font-medium">Update the descriptive name or leave blank for auto-generation.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-10">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Configuration Name</Label>
              <Input 
                {...form.register('name')} 
                placeholder="e.g. 80% Advance, 20% 2 weeks after doc" 
                className="h-14 rounded-2xl bg-muted/30 border-none font-bold text-lg focus:bg-white transition-all focus:ring-2 focus:ring-primary/20" 
              />
              <p className="text-[10px] text-muted-foreground font-medium italic">Leaving this empty will auto-generate based on values below.</p>
            </div>

            <Separator className="bg-primary/5" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
              {/* Split 1 */}
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 bg-primary/10 rounded-full flex items-center justify-center text-[10px] font-bold text-primary">1</div>
                  <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest">Initial Payment Split</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold opacity-60">Amount (%)</Label>
                    <div className="relative">
                      <Input 
                        type="number" 
                        {...form.register('amount1')} 
                        error={!!form.formState.errors.amount1}
                        className="h-12 rounded-xl bg-muted/30 border-none font-bold pr-8" 
                      />
                      <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/40" />
                    </div>
                    <FieldError message={form.formState.errors.amount1?.message} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold opacity-60">Delay (Weeks)</Label>
                    <div className="relative">
                      <Input 
                        type="number" 
                        {...form.register('delay1')} 
                        error={!!form.formState.errors.delay1}
                        className="h-12 rounded-xl bg-muted/30 border-none font-bold pr-8" 
                      />
                      <Clock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/40" />
                    </div>
                    <FieldError message={form.formState.errors.delay1?.message} />
                  </div>
                </div>
              </div>

              {/* Split 2 */}
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 bg-accent/10 rounded-full flex items-center justify-center text-[10px] font-bold text-accent">2</div>
                  <h4 className="text-[10px] font-bold text-accent uppercase tracking-widest">Final Payment Split</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold opacity-60">Amount (%)</Label>
                    <div className="relative">
                      <Input 
                        type="number" 
                        {...form.register('amount2')} 
                        error={!!form.formState.errors.amount2}
                        className={`h-12 rounded-xl bg-muted/30 border-none font-bold pr-8 ${form.formState.errors.amount2 ? 'ring-2 ring-rose-500' : ''}`}
                      />
                      <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-accent/40" />
                    </div>
                    <FieldError message={form.formState.errors.amount2?.message} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold opacity-60">Delay (Weeks)</Label>
                    <div className="relative">
                      <Input 
                        type="number" 
                        {...form.register('delay2')} 
                        error={!!form.formState.errors.delay2}
                        className="h-12 rounded-xl bg-muted/30 border-none font-bold pr-8" 
                      />
                      <Clock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-accent/40" />
                    </div>
                    <FieldError message={form.formState.errors.delay2?.message} />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-emerald-500 h-5 w-5" />
            <p className="text-sm font-bold text-emerald-800 uppercase tracking-tight">Configuration Integrity Verified</p>
          </div>
          <div className="flex items-center gap-8">
            <Button type="button" variant="ghost" onClick={() => router.back()} className="font-bold text-muted-foreground uppercase tracking-widest hover:bg-emerald-100">
              Discard Changes
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="h-14 px-12 bg-primary hover:bg-primary/90 text-white font-bold shadow-2xl shadow-primary/20 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest"
            >
              {loading ? 'Processing...' : 'Save Term Configuration'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Separator({ className }: { className?: string }) {
  return <div className={`h-px w-full ${className}`} />;
}
